import React, { useState, useEffect, useRef } from "react";
import { Repo } from "../types";
import * as api from "../api";

interface RepoPanelProps {
  repos: Repo[];
  onAddRepo: (url: string) => void;
  onDeleteRepo: (repoId: string) => void;
  onRepoUpdated: (repo: Repo) => void;
}

function statusLabel(repo: Repo): string {
  if (repo.status === "ready") return `${repo.file_count} files`;
  if (repo.status === "indexing") return "indexing...";
  if (repo.status === "cloning") return "cloning...";
  return repo.status;
}

export default function RepoPanel({
  repos,
  onAddRepo,
  onDeleteRepo,
  onRepoUpdated,
}: RepoPanelProps) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll repos that are still cloning/indexing
  useEffect(() => {
    const inProgress = repos.filter(
      (r) => r.status === "cloning" || r.status === "indexing"
    );

    if (inProgress.length === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      for (const repo of inProgress) {
        try {
          const updated = await api.getRepo(repo.id);
          if (updated.status !== repo.status || updated.file_count !== repo.file_count) {
            onRepoUpdated(updated);
          }
        } catch {}
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [repos, onRepoUpdated]);

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
              <span className={`repo-status ${repo.status}`}>
                {statusLabel(repo)}
              </span>
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
