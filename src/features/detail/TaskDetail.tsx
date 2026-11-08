import { FormEvent, useState } from "react";
import { addDays, addMinutes, format } from "date-fns";

import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { DatePickerPopover } from "../../components/DatePickerPopover";
import { Icon } from "../../components/Icon";
import { toInput, useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";
import type { Priority, Task, TaskInput } from "../../types/models";

export function TaskDetail() {
  const selectedId = useUi((s) => s.selectedTaskId);
  const closeTask = useUi((s) => s.closeTask);
  const task = useTasks((s) =>
    selectedId ? [...s.open, ...s.completedToday].find((t) => t.id === selectedId) : undefined
  );

  if (!selectedId || !task) return null;

  return (
    <aside className="detail-panel">
      <DetailBody key={task.id} task={task} onClose={closeTask} />
    </aside>
  );
}

function DetailBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateTask = useTasks((s) => s.updateTask);
  const deleteTask = useTasks((s) => s.deleteTask);
  const toggleTask = useTasks((s) => s.toggleTask);
  const addSubtask = useTasks((s) => s.addSubtask);
  const toggleSubtask = useTasks((s) => s.toggleSubtask);
  const projects = useTasks((s) => s.projects);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [tagText, setTagText] = useState(task.tags.map((t) => `@${t}`).join(" "));
  const [subtaskText, setSubtaskText] = useState("");

  const save = (patch: Partial<TaskInput>) => void updateTask(task.id, toInput(task, patch));
  const done = task.completedAt !== null;

  function saveTitle() {
    const next = title.trim();
    if (next && next !== task.title) save({ title: next });
    else setTitle(task.title);
  }

  function saveNotes() {
    const next = notes.trim() || null;
    if (next !== task.notes) save({ notes: next });
  }

  function saveTags() {
    const tags = tagText
      .split(/[\s,]+/)
      .map((t) => t.replace(/^@/, "").toLowerCase())
      .filter(Boolean);
    if (tags.join(",") !== task.tags.join(",")) save({ tags });
  }

  function submitSubtask(e: FormEvent) {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    void addSubtask(task.id, subtaskText.trim());
    setSubtaskText("");
  }

  return (
    <>
      <div className="detail-head">
        <button
          className={`check-btn ${done ? "checked" : ""}`}
          onClick={() => void toggleTask(task)}
          aria-label={done ? "Reopen task" : "Complete task"}
        >
          {done && <Icon name="check" size={12} />}
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Close details">
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="detail-body">
        <input
          className="detail-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Task title"
        />

        <div className="notes-container" style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary, #8e8e93)", textTransform: "uppercase" }}>
              Notes (Markdown supported)
            </span>
            {notes && (
              <button
                type="button"
                onClick={() => setIsEditingNotes(!isEditingNotes)}
                style={{
                  fontSize: "11px",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-accent, #6366f1)",
                  cursor: "pointer",
                }}
              >
                {isEditingNotes ? "Preview" : "Edit"}
              </button>
            )}
          </div>
          {isEditingNotes || !notes ? (
            <textarea
              className="detail-notes"
              placeholder="Add description, notes, or links... (Markdown supported)"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                saveNotes();
                if (notes.trim()) setIsEditingNotes(false);
              }}
              autoFocus={isEditingNotes}
            />
          ) : (
            <div
              onClick={() => setIsEditingNotes(true)}
              style={{
                minHeight: "60px",
                padding: "8px 10px",
                background: "var(--color-bg-secondary, #1a1a20)",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #2d2d38)",
                cursor: "pointer",
              }}
              title="Click to edit notes"
            >
              <MarkdownRenderer content={notes} />
            </div>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>Due date</span>
            <DatePickerPopover
              value={task.dueDate ?? null}
              onChange={(date) => save({ dueDate: date })}
            />
          </label>
          <label className="field">
            <span>Time</span>
            <input
              type="time"
              value={task.dueTime ?? ""}
              onChange={(e) => save({ dueTime: e.target.value || null })}
            />
          </label>
        </div>

        <div className="snooze-row">
          <span className="field-label">Snooze</span>
          <div className="snooze-buttons">
            <button
              className="chip"
              type="button"
              onClick={() => {
                const target = addMinutes(new Date(), 10);
                save({
                  dueDate: format(target, "yyyy-MM-dd"),
                  dueTime: format(target, "HH:mm"),
                });
              }}
            >
              +10 min
            </button>
            <button
              className="chip"
              type="button"
              onClick={() => {
                const target = addMinutes(new Date(), 60);
                save({
                  dueDate: format(target, "yyyy-MM-dd"),
                  dueTime: format(target, "HH:mm"),
                });
              }}
            >
              +1 hr
            </button>
            <button
              className="chip"
              type="button"
              onClick={() => {
                const target = addDays(new Date(), 1);
                save({
                  dueDate: format(target, "yyyy-MM-dd"),
                  dueTime: "09:00",
                });
              }}
            >
              Tomorrow 9am
            </button>
          </div>
        </div>

        <label className="field">
          <span>Priority</span>
          <select value={task.priority} onChange={(e) => save({ priority: e.target.value as Priority })}>
            <option value="high">Priority 1</option>
            <option value="medium">Priority 2</option>
            <option value="low">Priority 3</option>
            <option value="none">Priority 4</option>
          </select>
        </label>

        <label className="field">
          <span>Project</span>
          <select
            value={task.projectId ?? ""}
            onChange={(e) => save({ projectId: e.target.value || null, sectionId: null })}
          >
            <option value="">Inbox</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Labels</span>
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onBlur={saveTags}
            placeholder="@health @calls"
          />
        </label>

        <label className="field">
          <span>Repeat</span>
          <select
            value={task.recurRule ?? ""}
            onChange={(e) => save({ recurRule: e.target.value || null })}
          >
            <option value="">No repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>

        <div className="subtask-block">
          {task.subtasks.map((sub) => (
            <label key={sub.id} className="subtask">
              <input
                type="checkbox"
                checked={sub.completedAt !== null}
                onChange={(e) => void toggleSubtask(task.id, sub.id, e.target.checked)}
              />
              <span className={sub.completedAt ? "done" : ""}>{sub.title}</span>
            </label>
          ))}
          <form onSubmit={submitSubtask}>
            <input
              className="subtask-input"
              placeholder="Add subtask"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
            />
          </form>
        </div>
      </div>

      <div className="detail-foot">
        <button
          className="danger"
          onClick={() => {
            void deleteTask(task.id);
            onClose();
          }}
        >
          Delete task
        </button>
      </div>
    </>
  );
}