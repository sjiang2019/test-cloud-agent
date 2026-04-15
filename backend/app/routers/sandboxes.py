import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Sandbox
from app.sandbox import create_container, exec_command, get_vnc_host_port, stop_container
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
        container_id = await create_container(image=body.image, network_enabled=True)
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


@router.get("/{sandbox_id}/ports")
async def list_ports(
    sandbox_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """List TCP ports with listening servers inside the sandbox."""
    result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
    sandbox = result.scalar_one_or_none()
    if not sandbox or not sandbox.container_id:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    if sandbox.status != "running":
        raise HTTPException(status_code=400, detail="Sandbox is not running")

    # ss -tlnp: TCP, listening, numeric, show process
    # Filter out Docker's internal DNS (127.0.0.11)
    exit_code, stdout, _ = await exec_command(
        sandbox.container_id,
        "ss -tlnp 2>/dev/null | tail -n +2 | grep -v '127.0.0.11' | awk '{print $4}' | grep -oE '[0-9]+$' | sort -un",
        timeout=5,
    )
    if exit_code != 0 or not stdout.strip():
        return {"ports": []}

    ports = [int(p) for p in stdout.strip().split("\n") if p.isdigit()]
    return {"ports": ports}


@router.get("/{sandbox_id}/vnc")
async def get_vnc_info(
    sandbox_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Return the host port for the VNC WebSocket connection."""
    result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
    sandbox = result.scalar_one_or_none()
    if not sandbox or not sandbox.container_id:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    if sandbox.status != "running":
        raise HTTPException(status_code=400, detail="Sandbox is not running")

    host_port = await get_vnc_host_port(sandbox.container_id)
    if not host_port:
        raise HTTPException(status_code=503, detail="VNC not available yet")

    return {"host": "localhost", "port": host_port}


@router.websocket("/{sandbox_id}/vnc-ws")
async def vnc_websocket_proxy(sandbox_id: uuid.UUID, ws: WebSocket):
    """WebSocket proxy: browser <-> websockify inside the container.

    This allows the frontend to connect through the backend API instead of
    requiring direct access to the Docker-mapped host port.
    """
    # Look up sandbox
    from app.database import async_session
    async with async_session() as db:
        result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
        sandbox = result.scalar_one_or_none()
        if not sandbox or not sandbox.container_id or sandbox.status != "running":
            await ws.close(code=4004, reason="Sandbox not found or not running")
            return
        container_id = sandbox.container_id

    host_port = await get_vnc_host_port(container_id)
    if not host_port:
        await ws.close(code=4003, reason="VNC not available")
        return

    await ws.accept()

    import websockets

    vnc_url = f"ws://localhost:{host_port}"
    try:
        async with websockets.connect(vnc_url, subprotocols=["binary"]) as vnc_ws:
            async def forward_client_to_vnc():
                try:
                    while True:
                        data = await ws.receive_bytes()
                        await vnc_ws.send(data)
                except WebSocketDisconnect:
                    pass

            async def forward_vnc_to_client():
                try:
                    async for msg in vnc_ws:
                        if isinstance(msg, bytes):
                            await ws.send_bytes(msg)
                        else:
                            await ws.send_text(msg)
                except WebSocketDisconnect:
                    pass

            # Run both directions concurrently; when either ends, cancel the other
            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(forward_client_to_vnc()),
                    asyncio.create_task(forward_vnc_to_client()),
                ],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
    except Exception:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


@router.get("/{sandbox_id}/preview/{port:int}/{path:path}")
@router.get("/{sandbox_id}/preview/{port:int}")
async def preview_proxy(
    sandbox_id: uuid.UUID,
    port: int,
    request: Request,
    path: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Proxy HTTP from a port inside the sandbox by exec'ing curl in the container."""
    result = await db.execute(select(Sandbox).where(Sandbox.id == sandbox_id))
    sandbox = result.scalar_one_or_none()
    if not sandbox or not sandbox.container_id:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    if sandbox.status != "running":
        raise HTTPException(status_code=400, detail="Sandbox is not running")

    query_string = str(request.query_params)
    target_url = f"http://localhost:{port}/{path}"
    if query_string:
        target_url += f"?{query_string}"

    # Use curl inside the container to fetch the page and capture headers + body
    curl_cmd = (
        f"curl -s -i --max-time 10 '{target_url}'"
    )
    exit_code, stdout, stderr = await exec_command(
        sandbox.container_id, curl_cmd, timeout=15
    )

    if exit_code != 0:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot reach port {port}: {stderr or 'connection refused'}",
        )

    # Parse the raw HTTP response: split headers from body at the blank line
    header_end = stdout.find("\r\n\r\n")
    if header_end == -1:
        header_end = stdout.find("\n\n")
        sep_len = 2
    else:
        sep_len = 4

    if header_end == -1:
        return Response(content=stdout.encode(), status_code=200)

    raw_headers = stdout[:header_end]
    body = stdout[header_end + sep_len:]

    # Extract content-type from headers
    content_type = "text/html"
    for line in raw_headers.split("\n"):
        if line.lower().startswith("content-type:"):
            content_type = line.split(":", 1)[1].strip()
            break

    return Response(content=body.encode(), media_type=content_type)
