import { Chat, ChatDetail, Message, Repo } from "./types";

const CHATS = "/api/chats";
const SANDBOXES = "/api/sandboxes";
const REPOS_BASE = "/api/repos";

export async function listChats(): Promise<Chat[]> {
  const res = await fetch(CHATS);
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function createChat(repoId: string, title = "New Chat"): Promise<Chat> {
  const res = await fetch(CHATS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_id: repoId, title }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export async function getChat(chatId: string): Promise<ChatDetail> {
  const res = await fetch(`${CHATS}/${chatId}`);
  if (!res.ok) throw new Error("Failed to fetch chat");
  return res.json();
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`${CHATS}/${chatId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete chat");
}

export async function addMessage(
  chatId: string,
  content: string
): Promise<Message[]> {
  const res = await fetch(`${CHATS}/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

// ── Sandboxes ──

export async function createSandbox(): Promise<{ id: string; container_id: string; status: string }> {
  const res = await fetch(SANDBOXES, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to create sandbox");
  return res.json();
}

export async function execCommand(
  sandboxId: string,
  command: string,
  timeout = 30
): Promise<{ exit_code: number; stdout: string; stderr: string }> {
  const res = await fetch(`${SANDBOXES}/${sandboxId}/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, timeout }),
  });
  if (!res.ok) throw new Error("Failed to execute command");
  return res.json();
}

export async function listPorts(
  sandboxId: string
): Promise<number[]> {
  const res = await fetch(`${SANDBOXES}/${sandboxId}/ports`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.ports;
}

// ── VNC ──

export async function getVncInfo(
  sandboxId: string
): Promise<{ host: string; port: number } | null> {
  const res = await fetch(`${SANDBOXES}/${sandboxId}/vnc`);
  if (!res.ok) return null;
  return res.json();
}

// ── Repos ──

export async function listRepos(): Promise<Repo[]> {
  const res = await fetch(REPOS_BASE);
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

export async function createRepo(url: string): Promise<Repo> {
  const res = await fetch(REPOS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("Failed to add repo");
  return res.json();
}

export async function getRepo(repoId: string): Promise<Repo> {
  const res = await fetch(`${REPOS_BASE}/${repoId}`);
  if (!res.ok) throw new Error("Failed to fetch repo");
  return res.json();
}

export async function deleteRepo(repoId: string): Promise<void> {
  const res = await fetch(`${REPOS_BASE}/${repoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete repo");
}
