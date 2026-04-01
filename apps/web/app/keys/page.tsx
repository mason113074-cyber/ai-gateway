"use client";

import { useEffect, useState } from "react";

const API_BASE = "/api/gateway";

const PERMISSION_OPTIONS = [
  "proxy",
  "read:agents",
  "read:logs",
  "read:audit",
  "read:costs",
  "read:keys",
  "read:rate-limits",
  "write:agents",
  "write:budgets",
  "write:rate-limits",
  "write:policies",
  "manage:keys",
  "admin",
] as const;

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
];

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  allowedModels: string[] | null;
  teamId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function KeysPage() {
  const [items, setItems] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [createPermissions, setCreatePermissions] = useState<string[]>(["read:keys", "read:audit"]);
  const [createTeamId, setCreateTeamId] = useState("");
  const [createAllowedModels, setCreateAllowedModels] = useState<string[]>([]);
  const [createRateLimit, setCreateRateLimit] = useState("");
  const [createExpiresAt, setCreateExpiresAt] = useState("");
  const [rawKeyModal, setRawKeyModal] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/keys`);
      if (!res.ok) throw new Error("Failed to load keys");
      const data = (await res.json()) as { items: ApiKeyRecord[] };
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const togglePermission = (p: string) => {
    setCreatePermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const toggleModel = (m: string) => {
    setCreateAllowedModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          permissions: createPermissions,
          teamId: createTeamId.trim() || undefined,
          allowedModels: createAllowedModels.length > 0 ? createAllowedModels : undefined,
          rateLimit: createRateLimit ? Number(createRateLimit) : undefined,
          expiresAt: createExpiresAt || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Create failed");
      }
      const data = (await res.json()) as ApiKeyRecord & { rawKey?: string };
      if (data.rawKey) setRawKeyModal(data.rawKey);
      setCreateName("");
      setCreatePermissions(["read:keys", "read:audit"]);
      setCreateTeamId("");
      setCreateAllowedModels([]);
      setCreateRateLimit("");
      setCreateExpiresAt("");
      loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Revoke failed");
      setRevokeId(null);
      loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    }
  };

  const copyRawKey = () => {
    if (rawKeyModal) {
      navigator.clipboard.writeText(rawKeyModal);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <h1>API Keys</h1>
      <p className="muted">
        Create and manage API keys. Raw key is shown only once at creation.
      </p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <section className="card">
        <h2>Create key</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <label>
            Name
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Production service"
            />
          </label>
          <label>
            Permissions
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {PERMISSION_OPTIONS.map((p) => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={createPermissions.includes(p)}
                    onChange={() => togglePermission(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </label>
          <label>
            Team scope (optional)
            <input
              value={createTeamId}
              onChange={(e) => setCreateTeamId(e.target.value)}
              placeholder="team-id or leave empty"
            />
          </label>
          <label>
            Model allowlist (optional — leave empty for all)
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {MODEL_OPTIONS.map((m) => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={createAllowedModels.includes(m)}
                    onChange={() => toggleModel(m)}
                  />
                  {m}
                </label>
              ))}
            </div>
          </label>
          <label>
            Rate limit (req/min, optional)
            <input
              type="number"
              min={1}
              value={createRateLimit}
              onChange={(e) => setCreateRateLimit(e.target.value)}
              placeholder="unlimited"
            />
          </label>
          <label>
            Expiry (ISO date, optional)
            <input
              type="date"
              value={createExpiresAt}
              onChange={(e) => setCreateExpiresAt(e.target.value)}
            />
          </label>
          <button type="submit">Create key</button>
        </form>
      </section>

      <section className="table-card">
        <h2>Keys</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="muted">No API keys yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Permissions</th>
                <th>Team</th>
                <th>Last used</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td><code>{k.keyPrefix}…</code></td>
                  <td>
                    {k.permissions.map((p) => (
                      <span key={p} className="badge" style={{ marginRight: 4 }}>
                        {p}
                      </span>
                    ))}
                  </td>
                  <td>{k.teamId ?? "—"}</td>
                  <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}</td>
                  <td>{new Date(k.createdAt).toLocaleString()}</td>
                  <td>
                    {revokeId === k.id ? (
                      <span>
                        <button
                          type="button"
                          className="error"
                          onClick={() => handleRevoke(k.id)}
                        >
                          Confirm revoke
                        </button>{" "}
                        <button type="button" onClick={() => setRevokeId(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="error"
                        onClick={() => setRevokeId(k.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {rawKeyModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setRawKeyModal(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Save your API key</h2>
            <p className="muted">
              This is the only time you will see the full key. Store it securely.
            </p>
            <pre
              style={{
                padding: 12,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 8,
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {rawKeyModal}
            </pre>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={copyRawKey}>
                Copy
              </button>
              <button type="button" onClick={() => setRawKeyModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
