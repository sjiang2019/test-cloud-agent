import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";

interface ChatWindowProps {
  messages: Message[];
  chatName: string;
  onSendMessage: (content: string) => void;
  isWaiting: boolean;
}

export default function ChatWindow({
  messages,
  chatName,
  onSendMessage,
  isWaiting,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isWaiting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isWaiting) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="status-dot" />
        <h2>{chatName}</h2>
      </div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === "user" ? "U" : "A"}
            </div>
            <div className="message-bubble">{msg.content}</div>
          </div>
        ))}
        {isWaiting && (
          <div className="typing-indicator">
            <div className="message-avatar">A</div>
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="message-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          disabled={isWaiting}
        />
        <button type="submit" disabled={!input.trim() || isWaiting}>
          Send
        </button>
      </form>
    </div>
  );
}
