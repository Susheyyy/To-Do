import { FormEvent, useState } from "react";
import { format, parseISO } from "date-fns";

import { Icon } from "../../components/Icon";
import { toInput, useTasks } from "../../stores/tasks.store";
import type { Priority, Task } from "../../types/models";
import { formatTime } from "../../lib/time";
import { useSettings } from "../../stores/settings.store";

const NEXT_PRIORITY: Record<Priority, Priority> = {
  medium: "high",
  high: "low",
  low: "medium",
};

export function TaskRow({ task }: { task: Task }) {
  const toggleTask = useTasks((s) => s.toggleTask);
  const updateTask = useTasks((s) => s.updateTask);
  const deleteTask = useTasks((s) => s.deleteTask);
  const addSubtask = useTasks((s) => s.addSubtask);
  const toggleSubtask = useTasks((s) => s.toggleSubtask);

  const clock = useSettings((s) => s.clock);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [open, setOpen] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");

  function saveTitle() {
    setEditing(false);
    const title = draft.trim();
    if (!title || title === task.title) {
      setDraft(task.title);
      return;
    }
    void updateTask(task.id, toInput(task, { title }));
  }

  function submitSubtask(e: FormEvent) {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    void addSubtask(task.id, subtaskText);
    setSubtaskText("");
  }

  return (
    <div className="task-row card">
      <div className="task-main">
        <button className="check-btn" onClick={() => void toggleTask(task)} aria-label="Complete task" />

        <div className="task-body">
          {editing ? (
            <input
              className="title-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setDraft(task.title);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <span
              className="task-title"
              onDoubleClick={() => {
                setDraft(task.title);
                setEditing(true);
              }}
            >
              {task.title}
            </span>
          )}

          <div className="task-meta">
            {task.dueDate && (
              <span>
                {format(parseISO(task.dueDate), "d MMM")}
                {task.dueTime ? ` ${formatTime(task.dueTime, clock)}` : ""}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag} className="pill">
                @{tag}
              </span>
            ))}
          </div>
        </div>

        <button
          className="icon-btn"
          onClick={() => void updateTask(task.id, toInput(task, { priority: NEXT_PRIORITY[task.priority] }))}
          aria-label={`Priority ${task.priority}`}
          title="Change priority"
        >
          <span className={`priority-${task.priority}`}>
            <Icon name="flag" size={16} />
          </span>
        </button>

        <button
          className="icon-btn"
          onClick={() => setOpen(!open)}
          aria-label="Show subtasks"
          aria-expanded={open}
        >
          <span className={open ? "chevron open" : "chevron"}>
            <Icon name="chevron" size={16} />
          </span>
        </button>

        <button className="icon-btn" onClick={() => void deleteTask(task.id)} aria-label="Delete task">
          <Icon name="trash" size={16} />
        </button>
      </div>

      {open && (
        <div className="subtasks">
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
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              placeholder="Add a subtask"
              aria-label="New subtask"
            />
          </form>
        </div>
      )}
    </div>
  );
}