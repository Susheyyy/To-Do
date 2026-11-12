const requiredFields = {
  task: ["title"],
  subtask: ["task_id", "title"],
  project: ["name"],
  section: ["project_id", "name"],
  habit: ["name"],
  habit_log: ["habit_id", "logged_date"],
};
const deleteTypes = new Set(["task", "subtask", "habit_log"]);
const priorities = new Set(["none", "low", "medium", "high"]);
const frequencies = new Set(["daily", "weekdays", "weekly", "custom"]);
const optionalText = [
  "notes", "color", "icon", "custom_days", "project_id", "section_id",
  "series_id", "recur_rule", "due_date", "due_time",
];
const timestamps = ["created_at", "updated_at", "deleted_at", "completed_at"];

export function timestamp(value) {
  if (typeof value !== "string") return NaN;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z"
    : value;
  return Date.parse(normalized);
}

export function validChange(change) {
  if (!change || !Object.hasOwn(requiredFields, change.entity_type) ||
      typeof change.entity_id !== "string" || !change.entity_id ||
      !Number.isFinite(timestamp(change.updated_at))) return false;
  const isDelete = change.op_type === "delete";
  if (isDelete ? !deleteTypes.has(change.entity_type) : change.op_type !== "upsert") return false;
  if (isDelete && change.payload == null) return true;
  if (typeof change.payload !== "string") return false;
  let payload;
  try { payload = JSON.parse(change.payload); } catch { return false; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (isDelete) return true;

  return requiredFields[change.entity_type].every((key) => typeof payload[key] === "string" && payload[key].trim()) &&
    optionalText.every((key) => payload[key] == null || typeof payload[key] === "string") &&
    timestamps.every((key) => payload[key] == null || Number.isFinite(timestamp(payload[key]))) &&
    (!Object.hasOwn(payload, "priority") || priorities.has(payload.priority)) &&
    (!Object.hasOwn(payload, "frequency") || frequencies.has(payload.frequency)) &&
    (!Object.hasOwn(payload, "tags") ||
      (Array.isArray(payload.tags) && payload.tags.every((tag) => typeof tag === "string")));
}
