import { FormEvent, useState } from "react";
import { addDays, format } from "date-fns";

import { Icon } from "../../components/Icon";
import { tagColor } from "../../lib/projectColors";
import { formatTime } from "../../lib/time";
import { playCompletionSound } from "../../lib/sound";
import { getRelativeDueDate } from "../../lib/relativeDate";
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

export function TaskRow({
  task,
  isFocused,
  isSelected,
  onSelect,
}: {
  task: Task;
  isFocused?: boolean;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}) {
  const clock = useSettings((s) => s.clock);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const toggleTask = useTasks((s) => s.toggleTask);
  const updateTask = useTasks((s) => s.updateTask);
  const deleteTask = useTasks((s) => s.deleteTask);
  const createTask = useTasks((s) => s.createTask);
  const addSubtask = useTasks((s) => s.addSubtask);
  const toggleSubtask = useTasks((s) => s.toggleSubtask);
  const projects = useTasks((s) => s.projects);
  const openTask = useUi((s) => s.openTask);

  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const done = task.completedAt !== null;
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const relDue = getRelativeDueDate(task.dueDate);

  function complete() {
    if (done) {
      void toggleTask(task);
      return;
    }
    if (soundEnabled) {
      playCompletionSound();
    }
    setLeaving(true);
    window.setTimeout(() => void toggleTask(task), 260);
  }

  function duplicate() {
    void createTask({
      title: `${task.title} (Copy)`,
      notes: task.notes,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      projectId: task.projectId,
      sectionId: task.sectionId,
      tags: [...task.tags],
      recurRule: task.recurRule,
    });
  }

  function snoozeDays(days: number) {
    const nextDate = format(addDays(new Date(), days), "yyyy-MM-dd");
    void updateTask(task.id, toInput(task, { dueDate: nextDate }));
    setSnoozeOpen(false);
  }

  function submitSubtask(e: FormEvent) {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    void addSubtask(task.id, subtaskText.trim());
    setSubtaskText("");
  }

  const classes = [
    "task-row",
    leaving ? "leaving" : "",
    done ? "is-done" : "",
    isFocused ? "focused-task-row" : "",
    isSelected ? "selected-batch-row" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      role="listitem"
      onClick={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          onSelect?.(e);
        }
      }}
    >
      <div className="task-main">
        <button
          className={`check-btn priority-${task.priority} ${done ? "checked" : ""}`}
          onClick={complete}
          role="checkbox"
          aria-checked={done}
          aria-label={done ? "Reopen task" : "Complete task"}
        >
          {done && <Icon name="check" size={12} />}
        </button>

        <div className="task-body">
          <span className="task-title" onClick={() => openTask(task.id)}>
            {task.title}
          </span>
          <div className="task-meta">
            {task.dueDate && relDue && (
              <span className={`meta-due ${relDue.colorClass}`}>
                <Icon name="calendar" size={12} />
                <span>
                  {relDue.label}
                  {task.dueTime ? ` ${formatTime(task.dueTime, clock)}` : ""}
                </span>
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag} className="meta-tag" style={{ color: tagColor(tag) }}>
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

        {}
        <div style={{ position: "relative" }}>
          <button
            className="icon-btn"
            onClick={() => setSnoozeOpen(!snoozeOpen)}
            title="Reschedule / Snooze"
            aria-label="Reschedule / Snooze"
          >
            <Icon name="sun" size={15} />
          </button>
          {snoozeOpen && (
            <div
              className="quick-snooze-popover"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                zIndex: 40,
                background: "var(--color-bg-secondary, #1e1e24)",
                border: "1px solid var(--color-border, #2d2d38)",
                borderRadius: "8px",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
                minWidth: "120px",
              }}
            >
              <button
                type="button"
                className="chip"
                style={{ textAlign: "left", justifyContent: "flex-start", padding: "6px 8px" }}
                onClick={() => snoozeDays(1)}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className="chip"
                style={{ textAlign: "left", justifyContent: "flex-start", padding: "6px 8px" }}
                onClick={() => snoozeDays(3)}
              >
                In 3 Days
              </button>
              <button
                type="button"
                className="chip"
                style={{ textAlign: "left", justifyContent: "flex-start", padding: "6px 8px" }}
                onClick={() => snoozeDays(7)}
              >
                Next Week
              </button>
              <button
                type="button"
                className="chip"
                style={{ textAlign: "left", justifyContent: "flex-start", padding: "6px 8px", color: "var(--color-text-secondary, #8e8e93)" }}
                onClick={() => {
                  void updateTask(task.id, toInput(task, { dueDate: null, dueTime: null }));
                  setSnoozeOpen(false);
                }}
              >
                Clear Due Date
              </button>
            </div>
          )}
        </div>

        {}
        <button
          className="icon-btn"
          onClick={duplicate}
          title="Duplicate Task"
          aria-label="Duplicate Task"
        >
          <Icon name="clipboard" size={15} />
        </button>

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