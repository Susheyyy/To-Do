import http from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { validChange } from "./protocol.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TODO_SYNC_PORT || 4040);
const HOST = process.env.TODO_SYNC_HOST || "127.0.0.1";
const DB_FILE = process.env.TODO_SYNC_STORE || path.join(__dirname, "sync_store.json");
const token = process.env.TODO_SYNC_TOKEN;

if (!token || token.length < 24) {
  throw new Error("Set TODO_SYNC_TOKEN to a random secret of at least 24 characters.");
}

const digest = (value) => createHash("sha256").update(value).digest();
const tokenDigest = digest(token);
const feedToken = createHmac("sha256", token).update("calendar-feed").digest("hex");
const feedDigest = digest(feedToken);
const tokenMatches = (candidate, expected) => timingSafeEqual(digest(candidate), expected);

const worker = new Worker(new URL("./store-worker.mjs", import.meta.url), { workerData: { legacyFile: DB_FILE } });
const [{ epoch }] = await once(worker, "message");
const requests = new Map();
let nextRequestId = 0;
let workerFailure;
worker.on("message", ({ id, result, error }) => {
  const request = requests.get(id);
  if (!request) return;
  requests.delete(id);
  if (error) request.reject(new Error(error));
  else request.resolve(result);
});
function failWorker(error) {
  workerFailure = error;
  for (const { reject } of requests.values()) reject(error);
  requests.clear();
}
worker.on("error", failWorker);
worker.on("exit", (code) => failWorker(new Error(`Relay storage worker exited (${code}).`)));

function storage(operation, args) {
  if (workerFailure) return Promise.reject(workerFailure);
  if (requests.size >= 100) return Promise.reject(new Error("Relay storage is busy."));
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    requests.set(id, { resolve, reject });
    worker.postMessage({ id, operation, args });
  });
}

async function respondWithStorage(res, operation, args, send = (value) => sendJson(res, 200, value)) {
  try {
    send(await storage(operation, args));
  } catch (err) {
    console.error("[Sync Relay] Storage request failed:", err);
    sendJson(res, 503, { error: "Relay storage is unavailable." });
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function generateIcsFeed(items) {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TodoDesktopSync//NONSGML v1.0//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Todo Desktop Live Feed\r\nREFRESH-INTERVAL;VALUE=DURATION:PT15M\r\nX-PUBLISHED-TTL:PT15M\r\n";

  for (const item of items) {
    if (item.entity_type !== "task" || item.op_type === "delete" || !item.payload) {
      continue;
    }

    let task;
    try {
      task = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
    } catch {
      continue;
    }

    if (!task || task.deleted_at || task.completed_at || typeof task.due_date !== "string") {
      continue;
    }

    const cleanDate = task.due_date.replace(/-/g, "");
    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:${task.id || item.entity_id}@tododesktop.app\r\n`;
    ics += `DTSTAMP:${nowStamp}\r\n`;

    if (typeof task.due_time === "string" && /^\d{2}:\d{2}$/.test(task.due_time)) {
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

    if (typeof task.recur_rule === "string") {
      const r = task.recur_rule.toLowerCase();
      if (r === "daily") ics += "RRULE:FREQ=DAILY\r\n";
      else if (r === "weekly") ics += "RRULE:FREQ=WEEKLY\r\n";
      else if (r === "monthly") ics += "RRULE:FREQ=MONTHLY\r\n";
      else if (r === "weekdays") ics += "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\n";
    }

    const title = (typeof task.title === "string" ? task.title : "Untitled Task").replace(/\r?\n/g, " ");
    ics += `SUMMARY:${title}\r\n`;
    if (typeof task.notes === "string" && task.notes) {
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Todo-Sync-Group");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");
  const isCalendar = url.pathname === "/calendar.ics" || url.pathname === "/calendar";
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1] ?? "";
  const canReadFeed = isCalendar && tokenMatches(url.searchParams.get("key") ?? "", feedDigest);
  if (!canReadFeed && !tokenMatches(bearer, tokenDigest)) {
    sendJson(res, 401, { error: "A valid relay credential is required." });
    return;
  }

  if (url.pathname === "/health") {
    void respondWithStorage(res, "count", undefined, (itemsCount) =>
      sendJson(res, 200, { status: "ok", itemsCount, group_id: epoch }));
    return;
  }

  if (req.method === "GET" && (url.pathname === "/calendar.ics" || url.pathname === "/calendar")) {
    void respondWithStorage(res, "calendar", undefined, (items) => {
      const icsData = generateIcsFeed(items);
      res.writeHead(200, {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Disposition": 'inline; filename="todo-calendar.ics"',
      });
      res.end(icsData);
    });
    return;
  }

  if (url.pathname.startsWith("/sync/") && req.headers["x-todo-sync-group"] !== epoch) {
    sendJson(res, 409, { error: "Relay group identity does not match." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/sync/pull") {
    void respondWithStorage(res, "pull", url.searchParams.get("cursor") ?? "");
    return;
  }

  if (req.method === "POST" && url.pathname === "/sync/push") {
    const chunks = [];
    let size = 0;
    const maxBytes = 4 * 1024 * 1024;
    req.on("error", () => res.destroy());
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= maxBytes) chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > maxBytes) {
        sendJson(res, 413, { error: "Sync batch is too large." });
        return;
      }

      let incoming;
      try {
        incoming = JSON.parse(Buffer.concat(chunks).toString("utf8")).changes;
        if (!Array.isArray(incoming) || incoming.length > 100 || !incoming.every(validChange)) throw new Error();
      } catch {
        sendJson(res, 400, { error: "Invalid sync batch." });
        return;
      }

      void respondWithStorage(res, "push", incoming);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`[Sync Relay] Listening on ${HOST}:${server.address().port}. One relay instance serves one trusted group.`);
  console.log("[Sync Relay] Calendar subscription key:", feedToken);
});
