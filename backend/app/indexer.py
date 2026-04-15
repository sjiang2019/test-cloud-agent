import asyncio
import os
import shutil
import tempfile
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Repo, RepoFile

# Skip these directories when indexing
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    ".tox", ".mypy_cache", ".pytest_cache", "dist", "build",
    ".next", ".nuxt", "target", "vendor",
}

# Only index text-like files by extension
TEXT_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
    ".toml", ".cfg", ".ini", ".md", ".rst", ".txt", ".html", ".css",
    ".scss", ".less", ".xml", ".csv", ".sql", ".sh", ".bash", ".zsh",
    ".go", ".rs", ".java", ".c", ".h", ".cpp", ".hpp", ".rb", ".php",
    ".swift", ".kt", ".scala", ".r", ".jl", ".lua", ".vim", ".el",
    ".ex", ".exs", ".erl", ".hs", ".ml", ".mli", ".clj", ".cljs",
    ".lock", ".env", ".gitignore", ".dockerignore", ".editorconfig",
    "Makefile", "Dockerfile", "Procfile", "Gemfile", "Rakefile",
}

# Max file size to index (100KB)
MAX_FILE_SIZE = 100 * 1024


def _should_index(path: str, size: int) -> bool:
    if size > MAX_FILE_SIZE:
        return False
    _, ext = os.path.splitext(path)
    basename = os.path.basename(path)
    return ext.lower() in TEXT_EXTENSIONS or basename in TEXT_EXTENSIONS


async def clone_repo(url: str, dest: str) -> bool:
    """Shallow-clone a repo."""
    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", url, dest,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    return proc.returncode == 0


async def index_repo(repo_id: uuid.UUID) -> None:
    """Clone a repo, walk its files, and store contents in the database."""
    async with async_session() as db:
        result = await db.execute(select(Repo).where(Repo.id == repo_id))
        repo = result.scalar_one_or_none()
        if not repo:
            return

        repo.status = "cloning"
        await db.commit()

        tmp_dir = tempfile.mkdtemp(prefix="repo-")
        try:
            cloned = await clone_repo(repo.url, tmp_dir)
            if not cloned:
                repo.status = "error"
                await db.commit()
                return

            repo.status = "indexing"
            await db.commit()

            file_count = 0
            for root, dirs, files in os.walk(tmp_dir):
                # Filter out skipped directories in-place
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

                for fname in files:
                    fpath = os.path.join(root, fname)
                    rel_path = os.path.relpath(fpath, tmp_dir)

                    try:
                        size = os.path.getsize(fpath)
                    except OSError:
                        continue

                    if not _should_index(fpath, size):
                        continue

                    try:
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                    except (OSError, UnicodeDecodeError):
                        continue

                    repo_file = RepoFile(
                        repo_id=repo_id,
                        path=rel_path,
                        content=content,
                        size=size,
                    )
                    db.add(repo_file)
                    file_count += 1

            repo.file_count = file_count
            repo.status = "ready"
            await db.commit()

        except Exception:
            repo.status = "error"
            await db.commit()
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
