import { randomUUID } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";
import { timestamp } from "./protocol.mjs";

const { legacyFile } = workerData;
const databasePath = legacyFile + ".sqlite";
closeSync(openSync(databasePath, "a", 0o600));
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  CREATE TABLE IF NOT EXISTS relay_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    epoch TEXT NOT NULL,
    revision INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS changes (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    op_type TEXT NOT NULL,
    payload TEXT,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL,
    PRIMARY KEY(entity_type, entity_id)
  );
  CREATE INDEX IF NOT EXISTS changes_revision ON changes(revision);
`);

const getState = db.prepare("SELECT epoch, revision FROM relay_state WHERE singleton = 1");
const saveChange = db.prepare(`
  INSERT INTO changes(entity_type, entity_id, op_type, payload, updated_at, revision)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(entity_type, entity_id) DO UPDATE SET op_type = excluded.op_type,
    payload = excluded.payload, updated_at = excluded.updated_at, revision = excluded.revision
`);
const advance = db.prepare("UPDATE relay_state SET revision = ? WHERE singleton = 1");
const findChange = db.prepare("SELECT op_type, payload, updated_at FROM changes WHERE entity_type = ? AND entity_id = ?");
const pullChanges = db.prepare(`
  SELECT entity_type, entity_id, op_type, payload, updated_at
  FROM changes WHERE revision > ? ORDER BY revision
`);
const calendarItems = db.prepare(`
  SELECT entity_type, entity_id, op_type, payload FROM changes
  WHERE entity_type = 'task' AND op_type != 'delete'
`);
const count = db.prepare("SELECT COUNT(*) AS total FROM changes");

function transaction(action, begin = "BEGIN IMMEDIATE") {
  db.exec(begin);
  try {
    const value = action();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function migrateLegacy() {
  if (getState.get()) return;
  const legacy = existsSync(legacyFile) ? JSON.parse(readFileSync(legacyFile, "utf8")) : {};
  const current = typeof legacy.epoch === "string" && Number.isSafeInteger(legacy.revision) && Array.isArray(legacy.items);
  const items = current ? legacy.items : Object.values(legacy).map((item, index) => ({ ...item, revision: index + 1 }));
  const epoch = current ? legacy.epoch : randomUUID();
  const revision = current ? legacy.revision : items.length;
  db.prepare("INSERT INTO relay_state(singleton, epoch, revision) VALUES (1, ?, ?)").run(epoch, revision);
  for (const item of items) {
    if (typeof item.entity_type !== "string" || typeof item.entity_id !== "string") {
      console.warn("[Sync Relay] Unidentifiable record retained only in the legacy store.");
      continue;
    }
    const payload = typeof item.payload === "string" || item.payload == null
      ? item.payload ?? null : JSON.stringify(item.payload);
    saveChange.run(item.entity_type, item.entity_id, typeof item.op_type === "string" ? item.op_type : "upsert", payload,
      typeof item.updated_at === "string" ? item.updated_at : "", item.revision);
  }
}

transaction(migrateLegacy);
parentPort.postMessage({ epoch: getState.get().epoch });

function push(incoming) {
  return transaction(() => {
    let { revision } = getState.get();
    for (const { entity_type, entity_id, op_type, payload, updated_at } of incoming) {
      const existing = findChange.get(entity_type, entity_id);
      if (existing && timestamp(existing.updated_at) > timestamp(updated_at)) continue;
      if (existing?.updated_at === updated_at && existing.op_type === op_type &&
          existing.payload === (payload ?? null)) continue;
      saveChange.run(entity_type, entity_id, op_type, payload ?? null, updated_at, ++revision);
    }
    advance.run(revision);
    return { received: incoming.length };
  });
}

function pull(cursor) {
  return transaction(() => {
    const { epoch, revision } = getState.get();
    const [cursorEpoch, cursorRevision] = cursor.split(":");
    const from = Number(cursorRevision);
    const valid = cursorEpoch === epoch && Number.isSafeInteger(from) && from >= 0 && from <= revision;
    return { changes: pullChanges.all(valid ? from : -1), cursor: `${epoch}:${revision}` };
  }, "BEGIN");
}

const operations = { push, pull, count: () => count.get().total, calendar: () => calendarItems.all() };
parentPort.on("message", ({ id, operation, args }) => {
  try {
    parentPort.postMessage({ id, result: operations[operation](args) });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
