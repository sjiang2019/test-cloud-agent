import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import RepoPanel from "./components/RepoPanel";
import WorkspacePanel from "./components/WorkspacePanel";
import { Chat, Message, Repo } from "./types";
import * as api from "./api";
import "./App.css";

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [sandboxId, setSandboxId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listChats(), api.listRepos()]).then(([chatData, repoData]) => {
      setChats(chatData);
      setRepos(repoData);
      if (chatData.length > 0) {
        setSelectedChatId(chatData[0].id);
      }
      setLoading(false);
    });
  }, []);

  // Create a sandbox on mount
  useEffect(() => {
    api.createSandbox().then((sb) => setSandboxId(sb.id)).catch(() => {});
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    const detail = await api.getChat(chatId);
    setMessages(detail.messages);
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      loadMessages(selectedChatId);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, loadMessages]);

  const handleNewChat = async () => {
    const chat = await api.createChat();
    setChats((prev) => [chat, ...prev]);
    setSelectedChatId(chat.id);
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedChatId) return;

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: "temp-" + Date.now(),
      chat_id: selectedChatId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsWaiting(true);

    try {
      await api.addMessage(selectedChatId, content);
      await loadMessages(selectedChatId);
    } finally {
      setIsWaiting(false);
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === selectedChatId
          ? { ...chat, updated_at: new Date().toISOString() }
          : chat
      )
    );
  };

  const handleDeleteChat = async (chatId: string) => {
    await api.deleteChat(chatId);
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(chats.find((c) => c.id !== chatId)?.id ?? null);
    }
  };

  const handleAddRepo = async (url: string) => {
    const repo = await api.createRepo(url);
    setRepos((prev) => [repo, ...prev]);
  };

  const handleDeleteRepo = async (repoId: string) => {
    await api.deleteRepo(repoId);
    setRepos((prev) => prev.filter((r) => r.id !== repoId));
  };

  const handleExecCommand = sandboxId
    ? (command: string) => api.execCommand(sandboxId, command)
    : undefined;

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  if (loading) {
    return <div className="app loading">Loading...</div>;
  }

  return (
    <div className="app">
      <div className="left-panel">
        <Sidebar
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />
        <RepoPanel
          repos={repos}
          onAddRepo={handleAddRepo}
          onDeleteRepo={handleDeleteRepo}
        />
      </div>
      <div className="center-panel">
        {selectedChat ? (
          <ChatWindow
            messages={messages}
            chatName={selectedChat.title}
            onSendMessage={handleSendMessage}
            isWaiting={isWaiting}
          />
        ) : (
          <div className="no-chat-selected">
            <p>Select a session or start a new one</p>
          </div>
        )}
      </div>
      <WorkspacePanel onExecCommand={handleExecCommand} />
    </div>
  );
}

export default App;
