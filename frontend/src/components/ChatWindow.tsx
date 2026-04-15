import React, { useState, useRef, useEffect } from "react";
import { Message } from "../types";

interface ChatWindowProps {
  messages: Message[];
  chatName: string;
  onSendMessage: (content: string) => void;
  isWaiting: boolean;
}

function ToolCallMessage({ message }: { message: Message }) {
  if (!message.tool_calls) return null;

  return (
    <div className="message tool-call">
      <div className="message-avatar">A</div>
      <div className="tool-call-bubble">
        {message.content && (
          <div className="tool-call-thinking">{message.content}</div>
        )}
        {message.tool_calls.map((tc) => {
          const args = JSON.parse(tc.function.arguments);
          return (
            <div key={tc.id} className="tool-call-cmd">
              <span className="tool-call-label">bash</span>
              <code>{args.command}</code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToolResultMessage({ message }: { message: Message }) {
  return (
    <div className="message tool-result">
      <div className="tool-result-bubble">
        <pre>{message.content}</pre>
      </div>
    </div>
  );
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

  const renderMessage = (msg: Message) => {
    // Assistant message with tool calls
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      return <ToolCallMessage key={msg.id} message={msg} />;
    }

    // Tool result
    if (msg.role === "tool") {
      return <ToolResultMessage key={msg.id} message={msg} />;
    }

    // Regular user or assistant text message
    if (msg.role === "assistant" && !msg.content) return null;

    return (
      <div key={msg.id} className={`message ${msg.role}`}>
        <div className="message-avatar">
          {msg.role === "user" ? "U" : "A"}
        </div>
        <div className="message-bubble">{msg.content}</div>
      </div>
    );
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="status-dot" />
        <h2>{chatName}</h2>
      </div>
      <div className="messages">
        {messages.map(renderMessage)}
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
