import React, { useState, useRef, useEffect, useCallback } from "react";
import * as api from "../api";

interface ShellEntry {
  command: string;
  stdout: string;
  stderr: string;
}

interface WorkspacePanelProps {
  sandboxId: string | null;
  onExecCommand?: (command: string) => Promise<{ exit_code: number; stdout: string; stderr: string }>;
}

type Tab = "shell" | "browser" | "editor" | "planner";

function BrowserTab({ sandboxId }: { sandboxId: string | null }) {
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Poll for VNC availability, then build the noVNC iframe URL
  useEffect(() => {
    if (!sandboxId) return;

    setVncUrl(null);
    setLoading(true);
    let found = false;

    const check = async () => {
      if (found) return;
      const info = await api.getVncInfo(sandboxId);
      if (info) {
        found = true;
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        // noVNC web client served by websockify --web /usr/share/novnc
        const url = `http://${info.host}:${info.port}/vnc_lite.html?autoconnect=true&resize=scale&reconnect=true&reconnect_delay=1000`;
        setVncUrl(url);
        setLoading(false);
      }
    };

    check();
    pollRef.current = setInterval(check, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sandboxId]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && vncUrl) {
      iframeRef.current.src = vncUrl;
    }
  }, [vncUrl]);

  if (!sandboxId) {
    return <div className="tab-placeholder">No sandbox connected</div>;
  }

  return (
    <div className="browser-container">
      <div className="browser-bar">
        <button
          type="button"
          className="browser-refresh"
          onClick={handleRefresh}
          disabled={!vncUrl}
          title="Reconnect"
        >
          ↻
        </button>
        <div className="browser-url-group">
          <span className={`vnc-status-dot ${vncUrl ? "connected" : "connecting"}`} />
          <span className="browser-url-prefix">
            {vncUrl ? "Sandbox Browser (Firefox)" : "Connecting to sandbox browser..."}
          </span>
        </div>
      </div>
      <div className="browser-viewport">
        {vncUrl ? (
          <iframe
            ref={iframeRef}
            src={vncUrl}
            title="Sandbox Browser"
            className="browser-iframe"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="browser-empty">
            <div className="vnc-spinner" />
            <p>{loading ? "Starting sandbox browser..." : "Waiting for VNC..."}</p>
            <p className="browser-hint">
              Launching Firefox inside the sandbox environment
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePanel({ sandboxId, onExecCommand }: WorkspacePanelProps) {
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
          <BrowserTab sandboxId={sandboxId} />
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
