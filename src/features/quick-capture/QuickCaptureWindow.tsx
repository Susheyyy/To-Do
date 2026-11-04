import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { format } from "date-fns";
import { Icon } from "../../components/Icon";
import { QuickAdd } from "../../components/QuickAdd";
import { api } from "../../lib/api";
import { useTasks } from "../../stores/tasks.store";
import type { Task } from "../../types/models";

type Tab = "pending" | "completed";

export function QuickCaptureWindow() {
  const [tab, setTab] = useState<Tab>("pending");
  const todayTasks = useTasks((s) => s.today);
  const completedToday = useTasks((s) => s.completedToday);
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

  async function closeWindow() {
    try {
      await api.hideWindow("quick-capture");
    } catch {
      void getCurrentWindow().hide();
    }
  }

  const currentDateHeader = format(new Date(), "MMMM d, EEEE");

  const pendingToday = todayTasks;
  const filteredTasks: Task[] = tab === "pending" ? pendingToday : completedToday;

  return (
    <div className="popup-card">
      <div className="popup-topbar">
        <span className="popup-date">{currentDateHeader}</span>
        <button
          className="popup-settings-btn"
          onClick={closeWindow}
          title="Close"
          aria-label="Close"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="popup-tabs">
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
      </div>

      <div className="popup-task-list">
        {filteredTasks.length === 0 ? (
          <div className="popup-empty-msg">No tasks here</div>
        ) : (
          <div className="popup-group-items">
            {filteredTasks.map((task) => {
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
        )}
      </div>

      <div className="popup-footer">
        <QuickAdd
          defaultDue={format(new Date(), "yyyy-MM-dd")}
          defaultProjectId={null}
          placeholder="Add new todo"
          variant="clean"
          autoFocus={false}
          onDone={() => void load()}
        />
      </div>
    </div>
  );
}
