import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Sandbox
from app.sandbox import create_container, exec_command, stop_container
from app.schemas import ExecRequest, ExecResponse, SandboxCreate, SandboxResponse

router = APIRouter(prefix="/api/sandboxes", tags=["sandboxes"])


@router.get("", response_model=list[SandboxResponse])
async def list_sandboxes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sandbox).order_by(Sandbox.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=SandboxResponse, status_code=201)
async def create_sandbox(body: SandboxCreate, db: AsyncSession = Depends(get_db)):
    sandbox = Sandbox()
    db.add(sandbox)
    await db.flush()

    try:
        container_id = await create_container(image=body.image)
    except Exception as e:
        sandbox.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to create container: {e}")

    sandbox.container_id = container_id
    sandbox.status = "running"
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


@router.get("/{sandbox_id}", response_model=SandboxResponse)
async def get_sandbox(sandbox_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
    sandbox = result.scalar_one_or_none()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    return sandbox


@router.post("/{sandbox_id}/exec", response_model=ExecResponse)
async def execute_in_sandbox(
    sandbox_id: uuid.UUID, body: ExecRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
    sandbox = result.scalar_one_or_none()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    if sandbox.status != "running":
        raise HTTPException(status_code=400, detail="Sandbox is not running")

    exit_code, stdout, stderr = await exec_command(
        sandbox.container_id, body.command, timeout=body.timeout
    )
    return ExecResponse(exit_code=exit_code, stdout=stdout, stderr=stderr)


@router.delete("/{sandbox_id}", status_code=204)
async def delete_sandbox(sandbox_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
    sandbox = result.scalar_one_or_none()
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    if sandbox.container_id:
        await stop_container(sandbox.container_id)

    await db.delete(sandbox)
    await db.commit()
