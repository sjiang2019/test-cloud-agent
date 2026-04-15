import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Chat, Message
from app.schemas import ChatCreate, ChatDetail, ChatResponse, MessageCreate, MessageResponse

router = APIRouter(prefix="/api/chats", tags=["chats"])

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


@router.get("", response_model=list[ChatResponse])
async def list_chats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chat).order_by(Chat.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ChatResponse, status_code=201)
async def create_chat(body: ChatCreate, db: AsyncSession = Depends(get_db)):
    chat = Chat(title=body.title)
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
    await db.delete(chat)
    await db.commit()


@router.post("/{chat_id}/messages", response_model=MessageResponse, status_code=201)
async def add_message(
    chat_id: uuid.UUID, body: MessageCreate, db: AsyncSession = Depends(get_db)
):
    # Verify chat exists and load messages
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id).options(selectinload(Chat.messages))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Save user message
    user_message = Message(chat_id=chat_id, role="user", content=body.content)
    db.add(user_message)
    await db.flush()

    # Build conversation history for OpenAI
    history = [{"role": m.role, "content": m.content} for m in chat.messages]
    history.append({"role": "user", "content": body.content})

    # Call OpenAI
    completion = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=history,
    )
    assistant_content = completion.choices[0].message.content

    # Save assistant reply
    assistant_message = Message(chat_id=chat_id, role="assistant", content=assistant_content)
    db.add(assistant_message)
    await db.commit()
    await db.refresh(assistant_message)

    return assistant_message
