"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_BASE = "/api/gateway";

type AgentRecord = {
  id: string;
  name: string;
  owner: string;
  sponsor: string;
  status: string;
  allowedTools: string[];
  allowedDataScopes: string[];
  description: string;
};

export default function AgentEditPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/gateway/agents`);
    const data = (await res.json()) as { items: AgentRecord[] };
    const found = data.items?.find((a) => a.id === id) ?? null;
    setAgent(found);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agent) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/gateway/agents/${agent.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: agent.name,
          owner: agent.owner,
          sponsor: agent.sponsor,
          status: agent.status,
          allowedTools: agent.allowedTools,
          allowedDataScopes: agent.allowedDataScopes,
          description: agent.description,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      setMessage("Saved.");
    } catch {
      setMessage("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main><p>Loading...</p></main>;
  if (!agent) return <main><p>Agent not found.</p><Link href="/agents">Back to agents</Link></main>;

  return (
    <main>
      <h1>Edit agent</h1>
      <Link href="/agents">← Back to agents</Link>
      {message && <p className={message === "Saved." ? "success" : "error"}>{message}</p>}
      <form onSubmit={handleSubmit} className="card" style={{ marginTop: 16 }}>
        <label>
          Name
          <input
            value={agent.name}
            onChange={(e) => setAgent((a) => a ? { ...a, name: e.target.value } : a)}
          />
        </label>
        <label>
          Owner
          <input
            value={agent.owner}
            onChange={(e) => setAgent((a) => a ? { ...a, owner: e.target.value } : a)}
          />
        </label>
        <label>
          Sponsor
          <input
            value={agent.sponsor}
            onChange={(e) => setAgent((a) => a ? { ...a, sponsor: e.target.value } : a)}
          />
        </label>
        <label>
          Status
          <select
            value={agent.status}
            onChange={(e) => setAgent((a) => a ? { ...a, status: e.target.value } : a)}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
        <label>
          Allowed tools (comma-separated)
          <input
            value={agent.allowedTools.join(", ")}
            onChange={(e) =>
              setAgent((a) =>
                a
                  ? {
                      ...a,
                      allowedTools: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }
                  : a
              )
            }
          />
        </label>
        <label>
          Allowed data scopes (comma-separated)
          <input
            value={agent.allowedDataScopes.join(", ")}
            onChange={(e) =>
              setAgent((a) =>
                a
                  ? {
                      ...a,
                      allowedDataScopes: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }
                  : a
              )
            }
          />
        </label>
        <label>
          Description
          <textarea
            value={agent.description}
            onChange={(e) => setAgent((a) => a ? { ...a, description: e.target.value } : a)}
            rows={2}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </main>
  );
}
