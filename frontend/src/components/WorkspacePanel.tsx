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
  const [port, setPort] = useState<number | null>(null);
  const [path, setPath] = useState("");
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [noServer, setNoServer] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildProxyUrl = useCallback(
    (p: number, pa: string) => {
      const cleanPath = pa.replace(/^\/+/, "");
      return `/api/sandboxes/${sandboxId}/preview/${p}${cleanPath ? `/${cleanPath}` : ""}`;
    },
    [sandboxId]
  );

  const scanPorts = useCallback(async () => {
    if (!sandboxId) return;
    setScanning(true);
    try {
      const ports = await api.listPorts(sandboxId);
      if (ports.length > 0) {
        const detected = ports[0];
        setPort(detected);
        setNoServer(false);
        setCurrentUrl(buildProxyUrl(detected, ""));
        // Stop polling once we find a port
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else {
        setNoServer(true);
      }
    } catch {
      setNoServer(true);
    } finally {
      setScanning(false);
    }
  }, [sandboxId, buildProxyUrl]);

  // Poll for ports when no server is detected
  useEffect(() => {
    if (!sandboxId) return;

    // Initial scan
    scanPorts();

    // Poll every 3 seconds until a port is found
    pollRef.current = setInterval(scanPorts, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sandboxId, scanPorts]);

  // Reset when sandbox changes
  useEffect(() => {
    setPort(null);
    setPath("");
    setCurrentUrl(null);
    setNoServer(false);
  }, [sandboxId]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxId || !port) return;
    setCurrentUrl(buildProxyUrl(port, path.trim()));
  };

  const handleRefresh = () => {
    if (iframeRef.current && currentUrl) {
      iframeRef.current.src = currentUrl;
    }
  };

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
          disabled={!currentUrl}
          title="Refresh"
        >
          ↻
        </button>
        {port ? (
          <form className="browser-url-group" onSubmit={handleNavigate}>
            <span className="browser-url-prefix">:{port}/</span>
            <input
              className="browser-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder=""
            />
            <button type="submit" className="browser-go">Go</button>
          </form>
        ) : (
          <div className="browser-url-group">
            <span className="browser-url-prefix browser-scanning">
              {scanning ? "Scanning..." : "No server detected"}
            </span>
          </div>
        )}
      </div>
      <div className="browser-viewport">
        {currentUrl ? (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title="Sandbox Preview"
            className="browser-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : (
          <div className="browser-empty">
            {noServer ? (
              <>
                <p>No server running</p>
                <p className="browser-hint">
                  Start a server in the sandbox and it will appear here automatically
                </p>
              </>
            ) : (
              <p>Scanning for servers...</p>
            )}
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
