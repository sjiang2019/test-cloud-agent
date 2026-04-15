import React from "react";
import { Chat } from "../types";

interface SidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
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
  selectedChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Sessions</h2>
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
