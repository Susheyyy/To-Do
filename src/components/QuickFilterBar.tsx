import { useUi } from "../stores/ui.store";
import { useTasks } from "../stores/tasks.store";
import type { Priority } from "../types/models";

export function QuickFilterBar() {
  const filterPriority = useUi((s) => s.filterPriority);
  const setFilterPriority = useUi((s) => s.setFilterPriority);
  const filterTag = useUi((s) => s.filterTag);
  const setFilterTag = useUi((s) => s.setFilterTag);
  const openTasks = useTasks((s) => s.open);

  
  const allTags = Array.from(
    new Set(openTasks.flatMap((t) => t.tags).filter(Boolean))
  ).slice(0, 8); 

  const priorities: { key: Priority | "all"; label: string; color?: string }[] = [
    { key: "all", label: "All Priorities" },
    { key: "high", label: "P1", color: "#ef4444" },
    { key: "medium", label: "P2", color: "#f59e0b" },
    { key: "low", label: "P3", color: "#3b82f6" },
    { key: "none", label: "P4", color: "#8e8e93" },
  ];

  const hasActiveFilter = filterPriority !== "all" || filterTag !== "all";

  return (
    <div
      className="quick-filter-bar"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "6px",
        margin: "10px 0 16px 0",
        padding: "4px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {priorities.map((p) => {
          const active = filterPriority === p.key;
          return (
            <button
              key={p.key}
              type="button"
              className={`chip ${active ? "active" : ""}`}
              style={{
                fontSize: "12px",
                padding: "3px 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                borderColor: active ? "var(--color-accent, #6366f1)" : undefined,
                background: active ? "rgba(99, 102, 241, 0.15)" : undefined,
              }}
              onClick={() => setFilterPriority(active && p.key !== "all" ? "all" : p.key)}
            >
              {p.color && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: p.color,
                    display: "inline-block",
                  }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>

      {allTags.length > 0 && <span style={{ color: "var(--color-border, #333)", margin: "0 4px" }}>|</span>}

      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
        {allTags.map((tag) => {
          const active = filterTag === tag;
          return (
            <button
              key={tag}
              type="button"
              className={`chip ${active ? "active" : ""}`}
              style={{
                fontSize: "12px",
                padding: "3px 8px",
                borderColor: active ? "var(--color-accent, #6366f1)" : undefined,
                background: active ? "rgba(99, 102, 241, 0.15)" : undefined,
              }}
              onClick={() => setFilterTag(active ? "all" : tag)}
            >
              #{tag}
            </button>
          );
        })}
      </div>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            setFilterPriority("all");
            setFilterTag("all");
          }}
          style={{
            fontSize: "11px",
            color: "#ef4444",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
            marginLeft: "4px",
          }}
        >
          Reset filters
        </button>
      )}
    </div>
  );
}
