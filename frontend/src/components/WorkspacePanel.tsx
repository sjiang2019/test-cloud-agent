import React, { useState, useRef, useEffect } from "react";

interface ShellEntry {
  command: string;
  stdout: string;
  stderr: string;
}

interface WorkspacePanelProps {
  onExecCommand?: (command: string) => Promise<{ exit_code: number; stdout: string; stderr: string }>;
}

type Tab = "shell" | "browser" | "editor" | "planner";

export default function WorkspacePanel({ onExecCommand }: WorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("shell");
  const [shellHistory, setShellHistory] = useState<ShellEntry[]>([]);
  const [shellInput, setShellInput] = useState("");
  const [running, setRunning] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [shellHistory]);

  const handleShellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = shellInput.trim();
    if (!cmd || running || !onExecCommand) return;

    setShellInput("");
    setRunning(true);

    try {
      const result = await onExecCommand(cmd);
      setShellHistory((prev) => [
        ...prev,
        { command: cmd, stdout: result.stdout, stderr: result.stderr },
      ]);
    } catch {
      setShellHistory((prev) => [
        ...prev,
        { command: cmd, stdout: "", stderr: "Error: failed to execute command" },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "shell", label: "Shell" },
    { key: "browser", label: "Browser" },
    { key: "editor", label: "Editor" },
    { key: "planner", label: "Planner" },
  ];

  return (
    <aside className="workspace-panel">
      <div className="workspace-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`workspace-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="workspace-content">
        {activeTab === "shell" && (
          <div className="shell-container">
            <div className="shell-output">
              {shellHistory.map((entry, i) => (
                <div key={i} className="shell-entry">
                  <div className="shell-command">{entry.command}</div>
                  {entry.stdout && <div className="shell-stdout">{entry.stdout}</div>}
                  {entry.stderr && <div className="shell-stderr">{entry.stderr}</div>}
                </div>
              ))}
              <div ref={outputEndRef} />
            </div>
            <form className="shell-input-row" onSubmit={handleShellSubmit}>
              <span className="shell-prompt">$</span>
              <input
                value={shellInput}
                onChange={(e) => setShellInput(e.target.value)}
                placeholder={onExecCommand ? "Enter command..." : "No sandbox connected"}
                disabled={running || !onExecCommand}
              />
            </form>
          </div>
        )}
        {activeTab === "browser" && (
          <div className="tab-placeholder">Browser preview coming soon</div>
        )}
        {activeTab === "editor" && (
          <div className="tab-placeholder">Code editor coming soon</div>
        )}
        {activeTab === "planner" && (
          <div className="tab-placeholder">Planner coming soon</div>
        )}
      </div>
    </aside>
  );
}
