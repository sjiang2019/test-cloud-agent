import React, { useState } from "react";
import { Repo } from "../types";

interface RepoPanelProps {
  repos: Repo[];
  onAddRepo: (url: string) => void;
  onDeleteRepo: (repoId: string) => void;
}

export default function RepoPanel({
  repos,
  onAddRepo,
  onDeleteRepo,
}: RepoPanelProps) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await onAddRepo(trimmed);
      setUrl("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="repo-panel">
      <h3 className="repo-panel-title">Repos</h3>
      <form className="repo-add-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo"
          disabled={adding}
        />
        <button type="submit" disabled={!url.trim() || adding}>
          Add
        </button>
      </form>
      <ul className="repo-list">
        {repos.map((repo) => (
          <li key={repo.id} className="repo-item">
            <div className="repo-item-info">
              <span className="repo-name">{repo.name}</span>
              <span className={`repo-status ${repo.status}`}>{repo.status}</span>
            </div>
            <div className="repo-url">{repo.url}</div>
            <button
              className="repo-delete-btn"
              onClick={() => onDeleteRepo(repo.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {repos.length === 0 && (
          <li className="repo-list-empty">No repos added</li>
        )}
      </ul>
    </div>
  );
}
