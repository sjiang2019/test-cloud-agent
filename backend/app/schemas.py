import uuid
from datetime import datetime

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    role: str
    content: str | None = None
    tool_calls: list | None = None
    tool_call_id: str | None = None
    created_at: datetime


class ChatCreate(BaseModel):
    repo_id: uuid.UUID
    title: str = "New Chat"


class ChatResponse(BaseModel):
    id: uuid.UUID
    title: str
    repo_id: uuid.UUID
    sandbox_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ChatDetail(ChatResponse):
    messages: list[MessageResponse] = []


# ── Repo ────────────────────────────────────────────────

class RepoCreate(BaseModel):
    url: str


class RepoResponse(BaseModel):
    id: uuid.UUID
    url: str
    name: str
    status: str
    file_count: int
    created_at: datetime
    updated_at: datetime


class RepoFileResponse(BaseModel):
    id: uuid.UUID
    repo_id: uuid.UUID
    path: str
    size: int
    created_at: datetime


# ── Sandbox ──────────────────────────────────────────────

class SandboxCreate(BaseModel):
    image: str = "cloud-agent-sandbox:latest"


class SandboxResponse(BaseModel):
    id: uuid.UUID
    container_id: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class ExecRequest(BaseModel):
    command: str
    timeout: int = 30  # seconds


class ExecResponse(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
