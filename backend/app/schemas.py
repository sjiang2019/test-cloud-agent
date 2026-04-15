import uuid
from datetime import datetime

from pydantic import BaseModel


class MessageCreate(BaseModel):
    role: str
    content: str


class MessageResponse(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class ChatCreate(BaseModel):
    title: str = "New Chat"


class ChatResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatDetail(ChatResponse):
    messages: list[MessageResponse] = []
