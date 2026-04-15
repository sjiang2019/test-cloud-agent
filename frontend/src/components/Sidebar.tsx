import React, { useState } from "react";
import { Chat, Repo } from "../types";

interface SidebarProps {
  chats: Chat[];
  repos: Repo[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: (repoId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Sidebar({
  chats,
  repos,
  selectedChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
  const [showRepoSelect, setShowRepoSelect] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  const readyRepos = repos.filter((r) => r.status === "ready");

  const handleRepoSelect = async (repoId: string) => {
    setCreatingChat(true);
    try {
      await onNewChat(repoId);
    } finally {
      setShowRepoSelect(false);
      setCreatingChat(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Sessions</h2>
        <button
          className="new-chat-btn"
          onClick={() => setShowRepoSelect(!showRepoSelect)}
          disabled={readyRepos.length === 0 || creatingChat}
        >
          + New
        </button>
      </div>
      {showRepoSelect && (
        <div className="repo-select-dropdown">
          <p className="repo-select-label">Select a repo:</p>
          {readyRepos.map((repo) => (
            <button
              key={repo.id}
              className="repo-select-item"
              onClick={() => handleRepoSelect(repo.id)}
              disabled={creatingChat}
            >
              {repo.name}
            </button>
          ))}
        </div>
      )}
      <ul className="chat-list">
        {chats.map((chat) => (
          <li
            key={chat.id}
            className={`chat-item ${chat.id === selectedChatId ? "active" : ""}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="chat-item-top">
              <span className="chat-name">{chat.title}</span>
              <span className="chat-time">{formatTime(chat.updated_at)}</span>
            </div>
            <div className="chat-item-bottom">
              <button
                className="delete-chat-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {chats.length === 0 && (
          <li className="chat-list-empty">No sessions yet</li>
        )}
      </ul>
    </aside>
  );
}
