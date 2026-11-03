import { useState } from "react";

import { SortKey, useUi } from "../stores/ui.store";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Due date" },
  { id: "name", label: "Name" },
];

export function DisplayMenu({ showCompletedToggle = true }: { showCompletedToggle?: boolean }) {
  const [open, setOpen] = useState(false);
  const showCompleted = useUi((s) => s.showCompleted);
  const setShowCompleted = useUi((s) => s.setShowCompleted);
  const sort = useUi((s) => s.sort);
  const setSort = useUi((s) => s.setSort);

  return (
    <div className="popover-anchor">
      <button className="chip" aria-expanded={open} onClick={() => setOpen(!open)}>
        Display
      </button>
      {open && (
        <div className="popover">
          {showCompletedToggle && (
            <label className="popover-row">
              <span>Show completed</span>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
            </label>
          )}
          <div className="popover-label">Sort by</div>
          {SORTS.map((s) => (
            <button
              key={s.id}
              className={`popover-item ${sort === s.id ? "active" : ""}`}
              onClick={() => {
                setSort(s.id);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}