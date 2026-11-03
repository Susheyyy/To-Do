import { useEffect, useRef, useState } from "react";

import { useTasks } from "../stores/tasks.store";
import { SortKey, useUi } from "../stores/ui.store";
import type { Priority } from "../types/models";
import { Icon } from "./Icon";

export function DisplayMenu({
  showCompletedToggle = true,
  count = 2,
  showCalendar = true,
}: {
  showCompletedToggle?: boolean;
  count?: number;
  showCalendar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const layout = useUi((s) => s.layout);
  const setLayout = useUi((s) => s.setLayout);
  const showCompleted = useUi((s) => s.showCompleted);
  const setShowCompleted = useUi((s) => s.setShowCompleted);
  const sort = useUi((s) => s.sort);
  const setSort = useUi((s) => s.setSort);
  const filterPriority = useUi((s) => s.filterPriority);
  const setFilterPriority = useUi((s) => s.setFilterPriority);
  const filterTag = useUi((s) => s.filterTag);
  const setFilterTag = useUi((s) => s.setFilterTag);
  const openTasks = useTasks((s) => s.open);

  const allTags = Array.from(new Set(openTasks.flatMap((t) => t.tags))).sort();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  function resetAll() {
    setSort("manual");
    setFilterPriority("all");
    setFilterTag("all");
    setShowCompleted(false);
    setLayout("board");
  }

  const isFiltered = filterPriority !== "all" || filterTag !== "all" || sort !== "manual";

  return (
    <div className="popover-anchor" ref={anchorRef}>
      <button
        className="display-btn"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="View options"
      >
        <Icon name={layout === "board" ? "board" : "list"} size={16} />
        <span className="display-btn-text">Display: {count}</span>
        {isFiltered && <span className="display-btn-dot" />}
      </button>

      {open && (
        <div className="todoist-display-popover">
          <div className="popover-section-header">
            <span>Layout</span>
            <span className="orange-dot" />
          </div>

          <div className="layout-segmented-control">
            <button
              className={`layout-seg-btn ${layout === "list" ? "active" : ""}`}
              onClick={() => setLayout("list")}
            >
              <Icon name="list" size={16} />
              <span>List</span>
            </button>
            <button
              className={`layout-seg-btn ${layout === "board" ? "active" : ""}`}
              onClick={() => setLayout("board")}
            >
              <Icon name="board" size={16} />
              <span>Board</span>
            </button>
            {showCalendar && (
              <button
                className={`layout-seg-btn ${layout === "calendar" ? "active" : ""}`}
                onClick={() => setLayout("calendar")}
              >
                <Icon name="calendar" size={16} />
                <span>Calendar</span>
              </button>
            )}
          </div>

          {showCompletedToggle && (
            <div className="popover-setting-row">
              <span>Completed tasks</span>
              <label className="todoist-switch">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />
                <span className="switch-slider" />
              </label>
            </div>
          )}

          <div className="popover-divider" />

          <div className="popover-collapsible-title">
            <span>Sort</span>
            <span className="count-badge">{isFiltered ? "1" : "0"}</span>
          </div>

          <div className="popover-form-row">
            <span className="form-label">
              Grouping <span className="orange-dot" />
            </span>
            <select
              className="popover-select"
              value={sort === "priority" ? "priority" : "none"}
              onChange={(e) => {
                if (e.target.value === "priority") setSort("priority");
                else setSort("manual");
              }}
            >
              <option value="none">None</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          <div className="popover-form-row">
            <span className="form-label">Sorting</span>
            <select
              className="popover-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="manual">Smart</option>
              <option value="priority">Priority</option>
              <option value="due">Due date</option>
              <option value="name">Title</option>
            </select>
          </div>

          <div className="popover-divider" />

          <div className="popover-collapsible-title">
            <span>Filter</span>
          </div>

          <div className="popover-form-row">
            <span className="form-label">Priority</span>
            <select
              className="popover-select"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}
            >
              <option value="all">All</option>
              <option value="high">Priority 1</option>
              <option value="medium">Priority 2</option>
              <option value="low">Priority 3</option>
              <option value="none">Priority 4</option>
            </select>
          </div>

          <div className="popover-form-row">
            <span className="form-label">Label</span>
            <select
              className="popover-select"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="all">All</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  @{tag}
                </option>
              ))}
            </select>
          </div>

          <div className="popover-footer">
            <button className="reset-all-btn" onClick={resetAll}>
              Reset all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
