import http from "node:http";

const PORT = 4040;

// In-memory document storage for cross-device sync relay
// In production, backed by SQLite, PostgreSQL (Supabase), or Redis
const store = new Map<string, {
  entity_type: string;
  entity_id: string;
  op_type: string;
  payload: string | null;
  updated_at: string;
}>();

const server = http.createServer((req, res) => {
  // Enable CORS for web, mobile PWA, and desktop clients
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", itemsCount: store.size, timestamp: new Date().toISOString() }));
    return;
  }

  // Pull changes: GET /sync/pull?since=ISO_TIMESTAMP
  if (req.method === "GET" && url.pathname === "/sync/pull") {
    const since = url.searchParams.get("since");
    const changes: any[] = [];
    for (const item of store.values()) {
      if (!since || item.updated_at > since) {
        changes.push(item);
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ changes, server_time: new Date().toISOString() }));
    return;
  }

  // Push changes: POST /sync/push
  if (req.method === "POST" && url.pathname === "/sync/push") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const incomingChanges = Array.isArray(parsed.changes) ? parsed.changes : [];
        let acceptedCount = 0;

        for (const change of incomingChanges) {
          const key = `${change.entity_type}:${change.entity_id}`;
          const existing = store.get(key);

          // Last-Write-Wins (LWW) conflict resolution
          if (!existing || change.updated_at >= existing.updated_at) {
            store.set(key, {
              entity_type: change.entity_type,
              entity_id: change.entity_id,
              op_type: change.op_type,
              payload: change.payload,
              updated_at: change.updated_at || new Date().toISOString(),
            });
            acceptedCount++;
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: acceptedCount, server_time: new Date().toISOString() }));
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`[Sync Relay] Todo Cross-Device Sync Server running on http://localhost:${PORT}`);
});

