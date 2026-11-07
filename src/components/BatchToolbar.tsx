import { addDays, format } from "date-fns";
import { Icon } from "./Icon";
import { useTasks } from "../stores/tasks.store";
import type { Priority } from "../types/models";

interface Props {
  selectedIds: string[];
  onClear: () => void;
}

export function BatchToolbar({ selectedIds, onClear }: Props) {
  const batchToggle = useTasks((s) => s.batchToggle);
  const batchDelete = useTasks((s) => s.batchDelete);
  const batchReschedule = useTasks((s) => s.batchReschedule);
  const batchSetPriority = useTasks((s) => s.batchSetPriority);
  const batchMoveProject = useTasks((s) => s.batchMoveProject);
  const projects = useTasks((s) => s.projects);

  if (selectedIds.length === 0) return null;

  async function handleComplete() {
    await batchToggle(selectedIds, true);
    onClear();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} selected tasks?`)) return;
    await batchDelete(selectedIds);
    onClear();
  }

  async function handleTomorrow() {
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
    await batchReschedule(selectedIds, tomorrowStr);
    onClear();
  }

  async function handlePriority(p: Priority) {
    await batchSetPriority(selectedIds, p);
    onClear();
  }

  async function handleProject(projectId: string | null) {
    await batchMoveProject(selectedIds, projectId);
    onClear();
  }

  return (
    <div
      className="batch-floating-toolbar"
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        background: "var(--color-bg-secondary, #1a1a22)",
        border: "1px solid var(--color-border, #333340)",
        borderRadius: "14px",
        padding: "8px 16px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            background: "var(--color-accent, #6366f1)",
            color: "#ffffff",
            padding: "2px 8px",
            borderRadius: "6px",
          }}
        >
          {selectedIds.length}
        </span>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-secondary, #a1a1aa)" }}>
          selected
        </span>
      </div>

      <div style={{ height: "16px", width: "1px", background: "var(--color-border, #333340)" }} />

      <button
        type="button"
        className="chip"
        onClick={handleComplete}
        style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
      >
        <Icon name="check" size={13} />
        Complete
      </button>

      <button
        type="button"
        className="chip"
        onClick={handleTomorrow}
        style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
      >
        <Icon name="sun" size={13} />
        Tomorrow
      </button>

      {/* Priority Dropdown */}
      <select
        className="chip"
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) handlePriority(e.target.value as Priority);
        }}
        style={{ fontSize: "12px", padding: "4px 8px" }}
      >
        <option value="" disabled>Priority</option>
        <option value="high">P1 (High)</option>
        <option value="medium">P2 (Medium)</option>
        <option value="low">P3 (Low)</option>
        <option value="none">P4 (None)</option>
      </select>

      {/* Project Dropdown */}
      <select
        className="chip"
        defaultValue=""
        onChange={(e) => {
          if (e.target.value !== "") handleProject(e.target.value === "none" ? null : e.target.value);
        }}
        style={{ fontSize: "12px", padding: "4px 8px" }}
      >
        <option value="" disabled>Move Project</option>
        <option value="none">Inbox</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="chip"
        onClick={handleDelete}
        style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#ef4444" }}
      >
        <Icon name="trash" size={13} />
        Delete
      </button>

      <button
        type="button"
        onClick={onClear}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-secondary, #8e8e93)",
          cursor: "pointer",
          fontSize: "14px",
          padding: "2px 4px",
          marginLeft: "4px",
        }}
        title="Deselect all"
      >
        ✕
      </button>
    </div>
  );
}

