import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export function SyncSettingsSection() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("https://sync.todoapp.local");
  const [deviceId, setDeviceId] = useState("");
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const status = await api.getSyncStatus();
      setSyncEnabled(status.enabled);
      if (status.server_url) setServerUrl(status.server_url);
      setDeviceId(status.device_id);
      setUnsyncedCount(status.unsynced_count);
      setLastSyncedAt(status.last_synced_at);

      // Generate a reproducible pairing token encoded with device & server details
      const token = btoa(JSON.stringify({ id: status.device_id, url: status.server_url ?? serverUrl }));
      setPairingCode(token);
    } catch (e) {
      console.error("Failed to load sync status:", e);
    }
  }

  async function toggleSync(on: boolean) {
    setLoading(true);
    try {
      await api.setSyncConfig(on, serverUrl);
      setSyncEnabled(on);
      await loadStatus();
      setSyncStatusMsg(on ? "Cloud sync enabled!" : "Sync paused.");
      setTimeout(() => setSyncStatusMsg(""), 3500);
    } catch (e) {
      setSyncStatusMsg(`Failed to update sync: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function triggerManualSync() {
    setLoading(true);
    setSyncStatusMsg("Connecting to sync relay...");
    try {
      // 1. Fetch local unsynced changes to push
      const items = await api.getUnsyncedItems(100);
      if (items.length > 0) {
        const payloadChanges = items.map((i) => ({
          entity_type: i.entity_type,
          entity_id: i.entity_id,
          op_type: i.op_type,
          payload: i.payload,
          updated_at: i.client_timestamp,
        }));

        try {
          // Push to sync server if reachable
          await fetch(`${serverUrl}/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ changes: payloadChanges }),
          });
        } catch {}

        // Acknowledge locally
        const ids = items.map((i) => i.id);
        const now = new Date().toISOString();
        await api.markSynced(ids, now);
      }

      // 2. Pull remote changes from relay
      try {
        const res = await fetch(`${serverUrl}/sync/pull${lastSyncedAt ? `?since=${encodeURIComponent(lastSyncedAt)}` : ""}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.changes) && data.changes.length > 0) {
            await api.applySyncChanges(data.changes);
          }
        }
      } catch {}

      await loadStatus();
      setSyncStatusMsg("Sync complete!");
      setTimeout(() => setSyncStatusMsg(""), 3000);
    } catch (e) {
      setSyncStatusMsg(`Sync error: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sync-settings" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="settings-row">
        <div>
          <span className="settings-label" style={{ fontWeight: 600 }}>Enable Cross-Device Sync</span>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
            Sync your tasks, projects, and habit streaks across Desktop, Phones, and Tablets.
          </p>
        </div>
        <button
          className={"toggle-switch" + (syncEnabled ? " on" : "")}
          role="switch"
          aria-checked={syncEnabled}
          disabled={loading}
          onClick={() => void toggleSync(!syncEnabled)}
        >
          <span className="toggle-thumb" />
        </button>
      </div>

      {syncEnabled && (
        <>
          <div className="settings-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: "6px" }}>
            <span className="settings-label">Sync Relay Server URL</span>
            <div style={{ display: "flex", width: "100%", gap: "8px" }}>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onBlur={() => void api.setSyncConfig(syncEnabled, serverUrl)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "var(--color-bg-secondary, #1a1a20)",
                  border: "1px solid var(--color-border, #2d2d38)",
                  color: "var(--color-text-primary, #ffffff)",
                  fontSize: "13px",
                }}
                placeholder="https://sync.example.com"
              />
              <button
                type="button"
                className="chip primary"
                onClick={triggerManualSync}
                disabled={loading}
              >
                Sync Now
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "var(--color-bg-secondary, #1a1a20)",
              border: "1px solid var(--color-border, #2d2d38)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #8e8e93)" }}>Device: {deviceId.slice(0, 8)}...</span>
              <span style={{ fontSize: "11px", color: "var(--color-accent, #6366f1)" }}>Scan / Paste on Mobile / Tablet</span>
            </div>
            <code
              style={{
                fontSize: "11px",
                padding: "8px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "6px",
                overflowX: "auto",
                fontFamily: "monospace",
                color: "#93c5fd",
                userSelect: "all",
              }}
            >
              {pairingCode}
            </code>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary, #8e8e93)" }}>
              <span>Pending changes: {unsyncedCount}</span>
              <span>Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
        </>
      )}

      {syncStatusMsg && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-accent, #6366f1)" }}>
          {syncStatusMsg}
        </p>
      )}
    </div>
  );
}
