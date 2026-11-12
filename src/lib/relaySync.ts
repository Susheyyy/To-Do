import { api, isTauri } from "./api";

const credentialKey = (url: string) => `todo_sync_token:${new URL(url).href.replace(/\/$/, "")}`;

export function relayCredential(url: string) {
  return localStorage.getItem(credentialKey(url)) ?? "";
}

let pending: Promise<void> | undefined;

export function syncWithRelay(configuration?: { url: string; token: string }): Promise<void> {
  if (!configuration && pending) return pending;
  const previous = pending?.catch(() => undefined) ?? Promise.resolve();
  const operation = previous.then(() => transfer(configuration)).finally(() => {
    if (pending === operation) pending = undefined;
  });
  pending = operation;
  return operation;
}

async function transfer(configuration?: { url: string; token: string }) {
  if (!isTauri) throw new Error("Cross-device sync requires the desktop app.");
  const status = await api.getSyncStatus();
  const configuredUrl = configuration?.url ?? status.server_url;
  if ((!status.enabled && !configuration) || !configuredUrl) throw new Error("Enable sync and save a relay URL first.");
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Use HTTPS for a remote sync relay.");
  }
  const token = configuration?.token.trim() ?? relayCredential(url.href);
  if (!token) throw new Error("Enter the relay access token in Settings.");
  const base = url.href.replace(/\/$/, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(base + path, {
      ...init,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Relay request failed (${response.status}).`);
    return response.json();
  };

  const health = await request("/health");
  if (typeof health?.group_id !== "string") throw new Error("Update the relay before syncing.");
  await api.setSyncConfig(configuration ? true : null, url.href, health.group_id);
  if (!(await api.getSyncStatus()).enabled) return;
  if (configuration) localStorage.setItem(credentialKey(url.href), token);
  headers["X-Todo-Sync-Group"] = health.group_id;

  let pushError: unknown;
  try {
    while (true) {
      const items = await api.getUnsyncedItems(50);
      if (!items.length) break;
      const changes = items.map(({ id: _id, client_timestamp, ...item }) => ({
        ...item,
        updated_at: client_timestamp,
      }));
      const result = await request("/sync/push", { method: "POST", body: JSON.stringify({ changes }) });
      if (result?.received !== items.length) throw new Error("The relay did not acknowledge the upload.");
      await api.markSynced(items.map((item) => item.id), new Date().toISOString());
    }
  } catch (error) {
    pushError = error;
  }

  const query = status.pull_cursor ? `?cursor=${encodeURIComponent(status.pull_cursor)}` : "";
  const result = await request(`/sync/pull${query}`);
  if (!Array.isArray(result?.changes) || typeof result?.cursor !== "string") {
    throw new Error("The relay returned an invalid download.");
  }
  if (!result.cursor.startsWith(health.group_id + ":")) throw new Error("Relay group changed during sync.");
  await api.applySyncChanges(result.changes, result.cursor);
  if (pushError) throw pushError;
}

export function startRelaySync() {
  if (!isTauri) return;
  const tick = async () => {
    const status = await api.getSyncStatus();
    if (status.enabled) await syncWithRelay();
  };
  const run = () => void tick().catch((err) => console.warn("Background sync failed:", err));
  run();
  const timer = window.setInterval(run, 30000);
  return () => window.clearInterval(timer);
}
