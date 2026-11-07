import { useEffect, useRef, useState } from "react";
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
  const overdueTasks = useTasks((s) => s.overdue);
  const completedToday = useTasks((s) => s.completedToday);
  const toggleTask = useTasks((s) => s.toggleTask);
  const load = useTasks((s) => s.load);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    void load();
  }, [load]);

  
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) {
          void load();
        } else if (!isDraggingRef.current) {
          void closeWindow();
        }
      })
      .then((unlisten) => {
        cleanup = unlisten;
      });
    return () => {
      cleanup?.();
    };
  }, [load]);

  
  useEffect(() => {
    function handleBlur() {
      if (!isDraggingRef.current) {
        void closeWindow();
      }
    }
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  
  useEffect(() => {
    let lastDate = format(new Date(), "yyyy-MM-dd");
    const interval = setInterval(() => {
      const now = format(new Date(), "yyyy-MM-dd");
      if (now !== lastDate) {
        lastDate = now;
        void load();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function startDrag() {
    isDraggingRef.current = true;
    try {
      await api.startDragging("quick-capture");
    } catch {
      await getCurrentWindow().startDragging();
    } finally {
      
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 300);
    }
  }

  async function closeWindow() {
    try {
      await api.hideWindow("quick-capture");
    } catch {
      void getCurrentWindow().hide();
    }
  }

  const currentDateHeader = format(new Date(), "MMMM d, EEEE");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  
  const pendingTasks = [...overdueTasks, ...todayTasks.filter((t) => !overdueTasks.some((o) => o.id === t.id))];
  const filteredTasks: Task[] = tab === "pending" ? pendingTasks : completedToday;

  return (
    <div className="popup-card">
      <div
        className="popup-topbar"
        data-tauri-drag-region
        onMouseDown={(e) => {
          
          if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
            void startDrag();
          }
        }}
      >
        <span className="popup-date" data-tauri-drag-region>{currentDateHeader}</span>
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
              const isOverdue = !isDone && task.dueDate !== null && task.dueDate < todayStr;
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
                    {isOverdue && <span className="popup-overdue-tag">(Overdue)</span>}
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
