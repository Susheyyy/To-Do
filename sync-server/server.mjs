import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4040;
const DB_FILE = path.join(__dirname, "sync_store.json");

let store = new Map();

function loadStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      store = new Map(Object.entries(data));
      console.log(`[Sync Relay] Restored ${store.size} synced entities from disk.`);
    }
  } catch (err) {
    console.error("[Sync Relay] Failed to read store file:", err);
  }
}

function persistStore() {
  try {
    const obj = Object.fromEntries(store);
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("[Sync Relay] Failed to persist store to disk:", err);
  }
}

loadStore();

function generateIcsFeed() {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TodoDesktopSync//NONSGML v1.0//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Todo Desktop Live Feed\r\nREFRESH-INTERVAL;VALUE=DURATION:PT15M\r\nX-PUBLISHED-TTL:PT15M\r\n";

  for (const item of store.values()) {
    if (item.entity_type !== "task" || item.op_type === "delete" || !item.payload) {
      continue;
    }

    let task;
    try {
      task = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
    } catch {
      continue;
    }

    if (!task || task.completed_at || !task.due_date) {
      continue;
    }

    const cleanDate = task.due_date.replace(/-/g, "");
    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:${task.id || item.entity_id}@tododesktop.app\r\n`;
    ics += `DTSTAMP:${nowStamp}\r\n`;

    if (task.due_time) {
      const cleanTime = task.due_time.replace(/:/g, "") + "00";
      ics += `DTSTART:${cleanDate}T${cleanTime}\r\n`;
      const [h, m] = task.due_time.split(":").map(Number);
      const endM = (m + 30) % 60;
      const endH = h + Math.floor((m + 30) / 60);
      const pad = (n) => String(n).padStart(2, "0");
      ics += `DTEND:${cleanDate}T${pad(endH)}${pad(endM)}00\r\n`;
    } else {
      ics += `DTSTART;VALUE=DATE:${cleanDate}\r\n`;
    }

    if (task.recur_rule) {
      const r = task.recur_rule.toLowerCase();
      if (r === "daily") ics += "RRULE:FREQ=DAILY\r\n";
      else if (r === "weekly") ics += "RRULE:FREQ=WEEKLY\r\n";
      else if (r === "monthly") ics += "RRULE:FREQ=MONTHLY\r\n";
      else if (r === "weekdays") ics += "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\n";
    }

    const title = (task.title || "Untitled Task").replace(/\r?\n/g, " ");
    ics += `SUMMARY:${title}\r\n`;
    if (task.notes) {
      const notes = task.notes.replace(/\r?\n/g, "\\n");
      ics += `DESCRIPTION:${notes}\r\n`;
    }

    const prio = task.priority === "p1" ? 1 : task.priority === "p2" ? 5 : task.priority === "p3" ? 9 : 0;
    if (prio > 0) {
      ics += `PRIORITY:${prio}\r\n`;
    }

    ics += "END:VEVENT\r\n";
  }

  ics += "END:VCALENDAR\r\n";
  return ics;
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", itemsCount: store.size, timestamp: new Date().toISOString() }));
    return;
  }

  if (req.method === "GET" && (url.pathname === "/calendar.ics" || url.pathname === "/calendar")) {
    const icsData = generateIcsFeed();
    res.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Disposition": 'inline; filename="todo-calendar.ics"',
    });
    res.end(icsData);
    return;
  }

  if (req.method === "GET" && url.pathname === "/sync/pull") {
    const since = url.searchParams.get("since");
    const changes = [];
    for (const item of store.values()) {
      if (!since || item.updated_at > since) {
        changes.push(item);
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ changes, server_time: new Date().toISOString() }));
    return;
  }

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

        if (acceptedCount > 0) {
          persistStore();
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: acceptedCount, server_time: new Date().toISOString() }));
      } catch (err) {
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
  console.log(`[Sync Relay] Live iCalendar Subscription Feed available at http://localhost:${PORT}/calendar.ics`);
});
