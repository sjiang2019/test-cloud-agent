import React from "react";
import { Chat } from "../types";

interface SidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Sidebar({
  chats,
  selectedChatId,
  onSelectChat,
  onNewChat,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New
        </button>
      </div>
      <ul className="chat-list">
        {chats.map((chat) => (
          <li
            key={chat.id}
            className={`chat-item ${chat.id === selectedChatId ? "active" : ""}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="chat-item-top">
              <span className="chat-name">{chat.name}</span>
              <span className="chat-time">{formatTime(chat.timestamp)}</span>
            </div>
            <p className="chat-preview">{chat.lastMessage}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
