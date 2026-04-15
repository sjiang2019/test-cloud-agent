import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { Chat, Message } from "./types";
import "./App.css";

const MOCK_CHATS: Chat[] = [
  {
    id: "1",
    name: "Project Planning",
    lastMessage: "Let's outline the next sprint",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "2",
    name: "Code Review",
    lastMessage: "The PR looks good to me",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: "3",
    name: "Bug Triage",
    lastMessage: "Found the root cause of the crash",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  "1": [
    {
      id: "m1",
      chatId: "1",
      content: "Hey, can you help me plan the next sprint?",
      sender: "user",
      timestamp: new Date(Date.now() - 1000 * 60 * 35),
    },
    {
      id: "m2",
      chatId: "1",
      content:
        "Sure! What are the main priorities we should focus on this sprint?",
      sender: "assistant",
      timestamp: new Date(Date.now() - 1000 * 60 * 34),
    },
    {
      id: "m3",
      chatId: "1",
      content: "Let's outline the next sprint",
      sender: "user",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
    },
  ],
  "2": [
    {
      id: "m4",
      chatId: "2",
      content: "Can you review the auth module changes?",
      sender: "user",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    },
    {
      id: "m5",
      chatId: "2",
      content: "The PR looks good to me",
      sender: "assistant",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    },
  ],
  "3": [
    {
      id: "m6",
      chatId: "3",
      content: "Users are reporting a crash on the dashboard page",
      sender: "user",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25),
    },
    {
      id: "m7",
      chatId: "3",
      content:
        "I'll investigate. Can you share the error logs?",
      sender: "assistant",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24.5),
    },
    {
      id: "m8",
      chatId: "3",
      content: "Found the root cause of the crash",
      sender: "assistant",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
  ],
};

let nextId = 100;

function App() {
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [messages, setMessages] = useState<Record<string, Message[]>>(MOCK_MESSAGES);
  const [selectedChatId, setSelectedChatId] = useState<string | null>("1");

  const handleNewChat = () => {
    const id = String(nextId++);
    const newChat: Chat = {
      id,
      name: `New Chat`,
      lastMessage: "",
      timestamp: new Date(),
    };
    setChats((prev) => [newChat, ...prev]);
    setMessages((prev) => ({ ...prev, [id]: [] }));
    setSelectedChatId(id);
  };

  const handleSendMessage = (content: string) => {
    if (!selectedChatId) return;

    const newMessage: Message = {
      id: `m${nextId++}`,
      chatId: selectedChatId,
      content,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMessage],
    }));

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === selectedChatId
          ? { ...chat, lastMessage: content, timestamp: new Date() }
          : chat
      )
    );
  };

  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const currentMessages = selectedChatId ? messages[selectedChatId] || [] : [];

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        selectedChatId={selectedChatId}
        onSelectChat={setSelectedChatId}
        onNewChat={handleNewChat}
      />
      {selectedChat ? (
        <ChatWindow
          messages={currentMessages}
          chatName={selectedChat.name}
          onSendMessage={handleSendMessage}
        />
      ) : (
        <div className="no-chat-selected">
          <p>Select a chat or start a new one</p>
        </div>
      )}
    </div>
  );
}

export default App;
