from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from app.database import Base, engine
from app.routers import chats, repos, sandboxes


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(chats.router)
app.include_router(repos.router)
app.include_router(sandboxes.router)


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}
