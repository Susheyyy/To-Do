import { FormEvent, useState } from "react";

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

        <textarea
          className="detail-notes"
          placeholder="Description"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />

        <div className="field-row">
          <label className="field">
            <span>Due date</span>
            <input
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => save({ dueDate: e.target.value || null })}
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