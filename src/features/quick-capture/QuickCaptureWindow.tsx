import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { format } from "date-fns";
import { Icon } from "../../components/Icon";
import { QuickAdd } from "../../components/QuickAdd";
import { useTasks } from "../../stores/tasks.store";
import type { Task } from "../../types/models";

type Tab = "todo" | "pending" | "completed" | "cancelled";

export function QuickCaptureWindow() {
  const [tab, setTab] = useState<Tab>("todo");
  const todayTasks = useTasks((s) => s.today);
  const overdueTasks = useTasks((s) => s.overdue);
  const openTasks = useTasks((s) => s.open);
  const completedToday = useTasks((s) => s.completedToday);
  const projects = useTasks((s) => s.projects);
  const toggleTask = useTasks((s) => s.toggleTask);
  const load = useTasks((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) void getCurrentWindow().hide();
      })
      .then((unlisten) => {
        cleanup = unlisten;
      });
    return () => {
      cleanup?.();
    };
  }, []);

  async function openMainWindow() {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const main = await WebviewWindow.getByLabel("main");
      if (main) {
        await main.show();
        await main.setFocus();
      }
    } catch {}
  }

  const currentDateHeader = format(new Date(), "MMMM d, EEEE");

  let filteredTasks: Task[] = [];
  if (tab === "todo") {
    filteredTasks = [...overdueTasks, ...todayTasks];
  } else if (tab === "pending") {
    filteredTasks = openTasks;
  } else if (tab === "completed") {
    filteredTasks = completedToday;
  } else {
    filteredTasks = [];
  }

  const grouped = new Map<string, Task[]>();
  grouped.set("No Project", []);
  for (const p of projects) {
    grouped.set(p.name, []);
  }

  for (const t of filteredTasks) {
    if (!t.projectId) {
      grouped.get("No Project")?.push(t);
    } else {
      const p = projects.find((proj) => proj.id === t.projectId);
      const name = p ? p.name : "No Project";
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)?.push(t);
    }
  }

  const nonZeroGroups = Array.from(grouped.entries()).filter(([_, items]) => items.length > 0);

  return (
    <div className="popup-card">
      <div className="popup-topbar">
        <span className="popup-date">{currentDateHeader}</span>
        <button
          className="popup-settings-btn"
          onClick={openMainWindow}
          title="Open To-Do"
          aria-label="Open main app"
        >
          <Icon name="gear" size={14} />
        </button>
      </div>

      <div className="popup-tabs">
        <button
          className={`popup-tab ${tab === "todo" ? "active" : ""}`}
          onClick={() => setTab("todo")}
        >
          To-do
        </button>
        <button
          className={`popup-tab ${tab === "pending" ? "active" : ""}`}
          onClick={() => setTab("pending")}
        >
          Pending
        </button>
        <button
          className={`popup-tab ${tab === "completed" ? "active" : ""}`}
          onClick={() => setTab("completed")}
        >
          Completed
        </button>
        <button
          className={`popup-tab ${tab === "cancelled" ? "active" : ""}`}
          onClick={() => setTab("cancelled")}
        >
          Cancelled
        </button>
      </div>

      <div className="popup-task-list">
        {nonZeroGroups.length === 0 ? (
          <div className="popup-empty-msg">No tasks here</div>
        ) : (
          nonZeroGroups.map(([groupName, tasks]) => (
            <div key={groupName} className="popup-group">
              {groupName !== "No Project" && (
                <div className="popup-group-header">
                  <span className="popup-bullet">•</span>
                  <span className="popup-group-name">{groupName}</span>
                </div>
              )}
              <div className="popup-group-items">
                {tasks.map((task) => {
                  const isDone = task.completedAt !== null;
                  return (
                    <label key={task.id} className="popup-item">
                      <input
                        type="checkbox"
                        className="popup-checkbox"
                        checked={isDone}
                        onChange={() => void toggleTask(task)}
                      />
                      <span className={`popup-item-title ${isDone ? "is-done" : ""}`}>
                        {task.title}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="popup-footer">
        <QuickAdd
          defaultDue={null}
          defaultProjectId={null}
          placeholder="Add new todo"
          autoFocus={false}
          onDone={() => void load()}
        />
      </div>
    </div>
  );
}
