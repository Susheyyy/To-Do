import { FormEvent, useState } from "react";
import { format, parseISO } from "date-fns";

import { Icon } from "../../components/Icon";
import { formatTime } from "../../lib/time";
import { useSettings } from "../../stores/settings.store";
import { toInput, useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";
import type { Priority, Task } from "../../types/models";

const NEXT_PRIORITY: Record<Priority, Priority> = {
  high: "medium",
  medium: "low",
  low: "none",
  none: "high",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: "Priority 1",
  medium: "Priority 2",
  low: "Priority 3",
  none: "Priority 4",
};

export function TaskRow({ task }: { task: Task }) {
  const clock = useSettings((s) => s.clock);
  const toggleTask = useTasks((s) => s.toggleTask);
  const updateTask = useTasks((s) => s.updateTask);
  const deleteTask = useTasks((s) => s.deleteTask);
  const addSubtask = useTasks((s) => s.addSubtask);
  const toggleSubtask = useTasks((s) => s.toggleSubtask);
  const projects = useTasks((s) => s.projects);
  const openTask = useUi((s) => s.openTask);

  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const done = task.completedAt !== null;
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;

  function complete() {
    if (done) {
      void toggleTask(task);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => void toggleTask(task), 260);
  }

  function submitSubtask(e: FormEvent) {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    void addSubtask(task.id, subtaskText.trim());
    setSubtaskText("");
  }

  const classes = ["task-row", leaving ? "leaving" : "", done ? "is-done" : ""].join(" ");

  return (
    <div className={classes}>
      <div className="task-main">
        <button
          className={`check-btn priority-${task.priority} ${done ? "checked" : ""}`}
          onClick={complete}
          aria-label={done ? "Reopen task" : "Complete task"}
        >
          {done && <Icon name="check" size={12} />}
        </button>

        <div className="task-body">
          <span className="task-title" onClick={() => openTask(task.id)}>
            {task.title}
          </span>
          <div className="task-meta">
            {task.dueDate && (
              <span className="meta-due">
                <Icon name="calendar" size={12} />
                <span>
                  {format(parseISO(task.dueDate), "d MMM")}
                  {task.dueTime ? ` ${formatTime(task.dueTime, clock)}` : ""}
                </span>
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag} className="meta-tag">
                <Icon name="tag" size={12} />
                <span>{tag}</span>
              </span>
            ))}
            {project && (
              <span className="meta-project">
                # {project.name}
              </span>
            )}
          </div>
        </div>

        <button
          className="icon-btn"
          onClick={() => void updateTask(task.id, toInput(task, { priority: NEXT_PRIORITY[task.priority] }))}
          aria-label={PRIORITY_LABELS[task.priority]}
          title={PRIORITY_LABELS[task.priority]}
        >
          <span className={`priority-${task.priority}`}>
            <Icon name="flag" size={16} />
          </span>
        </button>

        <button
          className="icon-btn"
          onClick={() => setExpanded(!expanded)}
          aria-label="Show subtasks"
          aria-expanded={expanded}
        >
          <span className={expanded ? "chevron open" : "chevron"}>
            <Icon name="chevron" size={16} />
          </span>
        </button>

        <button className="icon-btn" onClick={() => void deleteTask(task.id)} aria-label="Delete task">
          <Icon name="trash" size={16} />
        </button>
      </div>

      {expanded && (
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