import asyncio
import logging
import os

import aiodocker

logger = logging.getLogger(__name__)

# Resource limits for sandbox containers
SANDBOX_MEMORY_LIMIT = 1024 * 1024 * 1024  # 1 GB (browser needs more RAM)
SANDBOX_CPU_PERIOD = 100_000
SANDBOX_CPU_QUOTA = 200_000  # 2 CPUs
SANDBOX_PIDS_LIMIT = 512

# VNC websockify port inside the container
VNC_CONTAINER_PORT = 6080


async def create_container(
    image: str = "cloud-agent-sandbox:latest",
    network_enabled: bool = False,
) -> str:
    """Create and start a sandbox container. Returns the container ID."""
    env = []
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        env.append(f"GITHUB_TOKEN={github_token}")
        env.append(f"GH_TOKEN={github_token}")

    async with aiodocker.Docker() as docker:
        config = {
            "Image": image,
            "Cmd": ["sleep", "infinity"],
            "AttachStdout": False,
            "AttachStderr": False,
            "Tty": False,
            "Env": env,
            "NetworkDisabled": not network_enabled,
            "ExposedPorts": {
                f"{VNC_CONTAINER_PORT}/tcp": {},
            },
            "HostConfig": {
                "Memory": SANDBOX_MEMORY_LIMIT,
                "CpuPeriod": SANDBOX_CPU_PERIOD,
                "CpuQuota": SANDBOX_CPU_QUOTA,
                "PidsLimit": SANDBOX_PIDS_LIMIT,
                "ReadonlyRootfs": False,
                "SecurityOpt": ["no-new-privileges"],
                "PortBindings": {
                    f"{VNC_CONTAINER_PORT}/tcp": [{"HostPort": ""}],  # dynamic host port
                },
            },
        }
        container = await docker.containers.create_or_replace(
            name=None, config=config
        )
        await container.start()
        info = await container.show()
        return info["Id"]


SANDBOX_NETWORK = "cloud-agent-sandbox-net"


async def _ensure_sandbox_network() -> str:
    """Ensure an internal-only Docker network exists. Returns the network ID."""
    async with aiodocker.Docker() as docker:
        try:
            network = await docker.networks.get(SANDBOX_NETWORK)
            return network.id
        except aiodocker.exceptions.DockerError:
            pass
        network = await docker.networks.create({
            "Name": SANDBOX_NETWORK,
            "Internal": True,  # no outbound internet
            "Driver": "bridge",
        })
        return network.id


async def disable_network(container_id: str) -> None:
    """Move container from default bridge to internal-only sandbox network."""
    await _ensure_sandbox_network()
    async with aiodocker.Docker() as docker:
        container = docker.containers.container(container_id)
        info = await container.show()

        # Connect to sandbox network first
        sandbox_net = await docker.networks.get(SANDBOX_NETWORK)
        await sandbox_net.connect({"Container": container_id})

        # Then disconnect from all other networks
        networks = info.get("NetworkSettings", {}).get("Networks", {})
        for net_name in networks:
            if net_name == SANDBOX_NETWORK:
                continue
            net = await docker.networks.get(net_name)
            await net.disconnect({"Container": container_id})


async def exec_command(
    container_id: str, command: str, timeout: int = 30
) -> tuple[int, str, str]:
    """Execute a command inside a sandbox container.

    Returns (exit_code, stdout, stderr).
    """
    async with aiodocker.Docker() as docker:
        container = docker.containers.container(container_id)

        exec_inst = await container.exec(
            cmd=["/bin/bash", "-c", command],
            stdout=True,
            stderr=True,
        )

        stdout_chunks: list[bytes] = []
        stderr_chunks: list[bytes] = []

        async def collect_output():
            async with exec_inst.start(detach=False) as stream:
                while True:
                    msg = await stream.read_out()
                    if msg is None:
                        break
                    # stream type 1 = stdout, 2 = stderr
                    if msg.stream == 1:
                        stdout_chunks.append(msg.data)
                    elif msg.stream == 2:
                        stderr_chunks.append(msg.data)

        try:
            await asyncio.wait_for(collect_output(), timeout=timeout)
        except asyncio.TimeoutError:
            return (
                -1,
                b"".join(stdout_chunks).decode(errors="replace"),
                "Error: command timed out after {} seconds".format(timeout),
            )

        inspect = await exec_inst.inspect()
        exit_code = inspect.get("ExitCode", -1)

        stdout = b"".join(stdout_chunks).decode(errors="replace")
        stderr = b"".join(stderr_chunks).decode(errors="replace")

        return (exit_code, stdout, stderr)


async def get_container_ip(container_id: str) -> str | None:
    """Get the container's IP address on the bridge network."""
    async with aiodocker.Docker() as docker:
        container = docker.containers.container(container_id)
        info = await container.show()
        networks = info.get("NetworkSettings", {}).get("Networks", {})
        for net in networks.values():
            ip = net.get("IPAddress")
            if ip:
                return ip
        # Fallback: top-level IPAddress
        return info.get("NetworkSettings", {}).get("IPAddress") or None


async def get_vnc_host_port(container_id: str) -> int | None:
    """Get the host-mapped port for the VNC websockify inside the container."""
    async with aiodocker.Docker() as docker:
        container = docker.containers.container(container_id)
        info = await container.show()
        ports = info.get("NetworkSettings", {}).get("Ports", {})
        bindings = ports.get(f"{VNC_CONTAINER_PORT}/tcp")
        if bindings and len(bindings) > 0:
            host_port = bindings[0].get("HostPort")
            if host_port:
                return int(host_port)
    return None


async def stop_container(container_id: str) -> None:
    """Stop and remove a sandbox container."""
    async with aiodocker.Docker() as docker:
        container = docker.containers.container(container_id)
        try:
            await container.kill()
        except aiodocker.exceptions.DockerError:
            pass  # already stopped
        try:
            await container.delete(force=True)
        except aiodocker.exceptions.DockerError as e:
            logger.warning("Failed to remove container %s: %s", container_id, e)
