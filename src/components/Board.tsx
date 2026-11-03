import { useRef } from "react";
import { AddInline } from "./AddInline";
import { TaskRow } from "../features/today/TaskRow";
import { Layout, useUi } from "../stores/ui.store";
import type { Task } from "../types/models";

export interface Column {
  key: string;
  title: string;
  tasks: Task[];
  due?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
}

export function Board({ columns }: { columns: Column[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest(".task-row") ||
      target.closest(".check-btn")
    ) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let startX = e.pageX - container.offsetLeft;
    let scrollLeft = container.scrollLeft;
    let isDown = true;

    function onMouseMove(ev: MouseEvent) {
      if (!isDown || !container) return;
      ev.preventDefault();
      const x = ev.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      container.scrollLeft = scrollLeft - walk;
    }

    function onMouseUp() {
      isDown = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      ref={containerRef}
      className="board grab-scroll"
      onMouseDown={handleMouseDown}
    >
      {columns.map((col) => (
        <div key={col.key} className="board-col">
          <div className="board-col-header">
            <h2 className="group-title">
              {col.title}
              <span className="count-inline">{col.tasks.length}</span>
            </h2>
          </div>
          <div className="task-list">
            {col.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
          <div className="board-col-footer">
            <AddInline due={col.due ?? null} projectId={col.projectId ?? null} sectionId={col.sectionId ?? null} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LayoutSwitch() {
  const layout = useUi((s) => s.layout);
  const setLayout = useUi((s) => s.setLayout);
  const options: { id: Layout; label: string }[] = [
    { id: "list", label: "List" },
    { id: "board", label: "Board" },
  ];

  return (
    <div className="theme-chips">
      {options.map((o) => (
        <button
          key={o.id}
          className="chip"
          aria-pressed={layout === o.id}
          onClick={() => setLayout(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
