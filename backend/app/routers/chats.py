import json
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Chat, Message, Repo, Sandbox
from app.sandbox import create_container, disable_network, exec_command, stop_container
from app.schemas import ChatCreate, ChatDetail, ChatResponse, MessageCreate, MessageResponse

router = APIRouter(prefix="/api/chats", tags=["chats"])
logger = logging.getLogger(__name__)

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """\
You are a software engineering agent working inside a sandboxed environment.
The repository has been cloned to /home/sandbox/repo. Your working directory is /home/sandbox/repo.

You have a bash tool to run commands in the sandbox. Use it to explore the codebase, \
run tests, make changes, and debug issues. Always cd into /home/sandbox/repo or use \
absolute paths.

Think step-by-step. When the user asks you to do something:
1. Explore the relevant code first to understand the current state.
2. Make changes as needed.
3. Verify your changes work (run tests, linters, etc. if available).
4. Summarize what you did.
"""

BASH_TOOL = {
    "type": "function",
    "function": {
        "name": "bash",
        "description": "Run a shell command in the sandbox. The repo is at /home/sandbox/repo.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The bash command to execute",
                },
            },
            "required": ["command"],
        },
    },
}

MAX_AGENT_STEPS = 20


@router.get("", response_model=list[ChatResponse])
async def list_chats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chat).order_by(Chat.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ChatResponse, status_code=201)
async def create_chat(body: ChatCreate, db: AsyncSession = Depends(get_db)):
    # Verify repo exists
    result = await db.execute(select(Repo).where(Repo.id == body.repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    # Create sandbox with network enabled for git clone
    sandbox = Sandbox()
    db.add(sandbox)
    await db.flush()

    try:
        container_id = await create_container(network_enabled=True)
    except Exception as e:
        sandbox.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to create sandbox: {e}")

    sandbox.container_id = container_id
    sandbox.status = "running"

    # Clone the repo into the sandbox
    clone_cmd = f"git clone {repo.url} /home/sandbox/repo"
    exit_code, stdout, stderr = await exec_command(container_id, clone_cmd, timeout=120)
    if exit_code != 0:
        logger.error("git clone failed: %s", stderr)
        await stop_container(container_id)
        sandbox.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to clone repo: {stderr}")

    # Disable network after clone
    await disable_network(container_id)

    # Create the chat linked to repo and sandbox
    title = body.title if body.title != "New Chat" else repo.name
    chat = Chat(title=title, repo_id=repo.id, sandbox_id=sandbox.id)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


@router.get("/{chat_id}", response_model=ChatDetail)
async def get_chat(chat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id).options(selectinload(Chat.messages))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.delete("/{chat_id}", status_code=204)
async def delete_chat(chat_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Clean up sandbox container
    if chat.sandbox_id:
        sb_result = await db.execute(select(Sandbox).where(Sandbox.id == chat.sandbox_id))
        sandbox = sb_result.scalar_one_or_none()
        if sandbox and sandbox.container_id:
            await stop_container(sandbox.container_id)
        if sandbox:
            await db.delete(sandbox)

    await db.delete(chat)
    await db.commit()


def _msg_to_openai(m: Message) -> dict:
    """Convert a DB message to the OpenAI API format."""
    if m.role == "tool":
        return {
            "role": "tool",
            "tool_call_id": m.tool_call_id,
            "content": m.content or "",
        }
    if m.role == "assistant" and m.tool_calls:
        msg: dict = {"role": "assistant", "content": m.content or ""}
        msg["tool_calls"] = m.tool_calls
        return msg
    return {"role": m.role, "content": m.content or ""}


@router.post(
    "/{chat_id}/messages",
    response_model=list[MessageResponse],
    status_code=201,
)
async def add_message(
    chat_id: uuid.UUID, body: MessageCreate, db: AsyncSession = Depends(get_db)
):
    # Verify chat exists and load messages + sandbox
    result = await db.execute(
        select(Chat)
        .where(Chat.id == chat_id)
        .options(selectinload(Chat.messages), selectinload(Chat.sandbox))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if not chat.sandbox or not chat.sandbox.container_id:
        raise HTTPException(status_code=400, detail="Chat has no running sandbox")

    container_id = chat.sandbox.container_id

    # Save user message
    user_message = Message(chat_id=chat_id, role="user", content=body.content)
    db.add(user_message)
    await db.flush()

    # Build conversation history
    history: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in chat.messages:
        history.append(_msg_to_openai(m))
    history.append({"role": "user", "content": body.content})

    new_messages: list[Message] = []

    # ReAct loop
    for _ in range(MAX_AGENT_STEPS):
        completion = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=history,
            tools=[BASH_TOOL],
        )

        choice = completion.choices[0]
        assistant_msg = choice.message

        # Save assistant message
        tool_calls_json = None
        if assistant_msg.tool_calls:
            tool_calls_json = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in assistant_msg.tool_calls
            ]

        db_assistant = Message(
            chat_id=chat_id,
            role="assistant",
            content=assistant_msg.content,
            tool_calls=tool_calls_json,
        )
        db.add(db_assistant)
        await db.flush()
        new_messages.append(db_assistant)

        # Add to history
        hist_entry: dict = {
            "role": "assistant",
            "content": assistant_msg.content or "",
        }
        if tool_calls_json:
            hist_entry["tool_calls"] = tool_calls_json
        history.append(hist_entry)

        # If no tool calls, agent is done
        if not assistant_msg.tool_calls:
            break

        # Execute each tool call
        for tc in assistant_msg.tool_calls:
            args = json.loads(tc.function.arguments)
            command = args.get("command", "")

            exit_code, stdout, stderr = await exec_command(
                container_id, command, timeout=60
            )

            tool_result = f"exit_code: {exit_code}\n"
            if stdout:
                tool_result += f"stdout:\n{stdout}\n"
            if stderr:
                tool_result += f"stderr:\n{stderr}\n"

            db_tool = Message(
                chat_id=chat_id,
                role="tool",
                content=tool_result,
                tool_call_id=tc.id,
            )
            db.add(db_tool)
            await db.flush()
            new_messages.append(db_tool)

            history.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": tool_result,
            })

    await db.commit()
    for m in new_messages:
        await db.refresh(m)

    return new_messages
