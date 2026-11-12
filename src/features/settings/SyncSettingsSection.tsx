import { useEffect, useState } from "react";
import { relayCredential, syncWithRelay } from "../../lib/relaySync";
import { api, isTauri } from "../../lib/api";

export function SyncSettingsSection() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:4040");
  const [token, setToken] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [quarantinedCount, setQuarantinedCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadStatus(true);
    const interval = setInterval(() => void loadStatus(), 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadStatus(loadFields = false) {
    try {
      const status = await api.getSyncStatus();
      setSyncEnabled(status.enabled);
      if (loadFields && status.server_url) {
        setServerUrl(status.server_url);
        setToken(relayCredential(status.server_url));
      }
      setDeviceId(status.device_id);
      setUnsyncedCount(status.unsynced_count);
      setQuarantinedCount(status.quarantined_count);
      setLastSyncedAt(status.last_synced_at);
    } catch (e) {
      console.error("Failed to load sync status:", e);
    }
  }

  async function toggleSync(on: boolean) {
    setLoading(true);
    try {
      await api.setSyncConfig(on);
      setSyncEnabled(on);
      await loadStatus();
      setSyncStatusMsg(on ? "Enter your relay details and choose Sync Now." : "Sync paused.");
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
      const url = new URL(serverUrl);
      if (url.username || url.password || url.search || url.hash) {
        throw new Error("Enter the relay base URL without credentials, a query, or a fragment.");
      }
      await syncWithRelay({ url: url.href, token });
      await loadStatus();
      setSyncStatusMsg("Sync complete!");
    } catch (e) {
      setSyncStatusMsg(`Sync error: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  if (!isTauri) return <p className="muted">Cross-device sync is available in the desktop app.</p>;

  return (
    <div className="sync-settings" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="settings-row">
        <div>
          <span className="settings-label" style={{ fontWeight: 600 }}>Enable Cross-Device Sync</span>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
            Use the same relay URL and token on each desktop to sync tasks, projects, and habits.
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
                onChange={(e) => {
                  setServerUrl(e.target.value);
                  setToken("");
                }}
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
                onClick={() => void triggerManualSync()}
                disabled={loading}
              >
                Sync Now
              </button>
            </div>
          </div>

          <label className="settings-row">
            <span className="settings-label">Relay access token</span>
            <input type="password" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
          </label>

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
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-text-secondary, #8e8e93)" }}>
              <span>Pending changes: {unsyncedCount}</span>
              <span>Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
        </>
      )}

      {quarantinedCount > 0 && (
        <p role="status" className="error-text">Could not apply {quarantinedCount} downloaded record(s). Other changes can still sync.</p>
      )}

      {syncStatusMsg && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-accent, #6366f1)" }}>
          {syncStatusMsg}
        </p>
      )}
    </div>
  );
}
