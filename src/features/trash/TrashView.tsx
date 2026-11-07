import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { useTasks } from "../../stores/tasks.store";
import type { Task } from "../../types/models";

export function TrashView() {
  const [trashTasks, setTrashTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const loadStore = useTasks((s) => s.load);

  async function fetchTrash() {
    setLoading(true);
    try {
      const items = await api.listTrash();
      setTrashTasks(items);
    } catch (e) {
      console.error("Failed to load trash:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTrash();
  }, []);

  async function handleRestore(id: string) {
    try {
      await api.restoreTask(id);
      setTrashTasks((prev) => prev.filter((t) => t.id !== id));
      void loadStore();
    } catch (e) {
      console.error("Failed to restore task:", e);
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!window.confirm("Permanently delete this task? This action cannot be undone.")) return;
    try {
      await api.permanentDeleteTask(id);
      setTrashTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  }

  async function handleEmptyTrash() {
    if (!window.confirm("Empty entire trash bin? All deleted items will be lost forever.")) return;
    try {
      await api.emptyTrash();
      setTrashTasks([]);
    } catch (e) {
      console.error("Failed to empty trash:", e);
    }
  }

  return (
    <div className="view-container trash-view" style={{ padding: "28px 32px", overflowY: "auto", flex: 1 }}>
      <header className="view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "#ef4444" }}>
              <Icon name="trash" size={24} />
            </span>
            Trash
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "var(--color-text-secondary, #8e8e93)", fontSize: "14px" }}>
            Items in trash can be restored or permanently removed.
          </p>
        </div>
        {trashTasks.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <Icon name="trash" size={14} />
            Empty Trash
          </button>
        )}
      </header>

      {loading ? (
        <div style={{ color: "var(--color-text-secondary, #8e8e93)", padding: "20px 0" }}>Loading trash...</div>
      ) : trashTasks.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", color: "var(--color-text-secondary, #8e8e93)" }}>
          <div style={{ opacity: 0.3, marginBottom: "12px" }}>
            <Icon name="trash" size={48} />
          </div>
          <p style={{ fontSize: "15px", margin: 0 }}>Trash is empty</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {trashTasks.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "var(--color-bg-secondary, #1e1e24)",
                border: "1px solid var(--color-border, #2d2d38)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, flex: 1, marginRight: "16px" }}>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-primary, #ffffff)", textDecoration: "line-through", opacity: 0.8 }}>
                  {t.title}
                </span>
                {t.notes && (
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #8e8e93)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.notes}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => handleRestore(t.id)}
                  title="Restore task"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "var(--color-bg-tertiary, #2a2a30)",
                    border: "1px solid var(--color-border, #3a3a48)",
                    color: "var(--color-text-primary, #ffffff)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <Icon name="undo" size={13} />
                  Restore
                </button>
                <button
                  onClick={() => handlePermanentDelete(t.id)}
                  title="Delete permanently"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
