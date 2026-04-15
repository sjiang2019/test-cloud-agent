import asyncio
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Repo
from app.schemas import RepoCreate, RepoResponse

router = APIRouter(prefix="/api/repos", tags=["repos"])


def extract_repo_name(url: str) -> str:
    """Extract a readable name from a git repo URL."""
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    name = path.split("/")[-1] if "/" in path else path
    return name or "unknown"


@router.get("", response_model=list[RepoResponse])
async def list_repos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo).order_by(Repo.created_at.desc()))
    return result.scalars().all()


async def check_repo_accessible(url: str) -> bool:
    """Check if a git repo URL is reachable via git ls-remote."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "ls-remote", "--exit-code", url,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=15)
        return proc.returncode == 0
    except (asyncio.TimeoutError, OSError):
        return False


@router.post("", response_model=RepoResponse, status_code=201)
async def create_repo(body: RepoCreate, db: AsyncSession = Depends(get_db)):
    name = extract_repo_name(body.url)
    reachable = await check_repo_accessible(body.url)
    status = "ready" if reachable else "error"
    repo = Repo(url=body.url, name=name, status=status)
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return repo


@router.delete("/{repo_id}", status_code=204)
async def delete_repo(repo_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    await db.delete(repo)
    await db.commit()
