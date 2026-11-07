import { ReactNode, useRef } from "react";
import { AddInline } from "./AddInline";
import { TaskRow } from "../features/today/TaskRow";
import { toInput, useTasks } from "../stores/tasks.store";
import type { Priority, Task } from "../types/models";

export interface Column {
  key: string;
  title: string;
  tasks: Task[];
  due?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
}

export function Board({
  columns,
  extraColumn,
}: {
  columns: Column[];
  extraColumn?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateTask = useTasks((s) => s.updateTask);
  const openTasks = useTasks((s) => s.open);

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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(col: Column, e: React.DragEvent) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = openTasks.find((t) => t.id === taskId);
    if (!task) return;

    
    if (["high", "medium", "low", "none"].includes(col.key)) {
      void updateTask(task.id, toInput(task, { priority: col.key as Priority }));
    } else if (col.projectId !== undefined) {
      void updateTask(task.id, toInput(task, { projectId: col.projectId, sectionId: col.sectionId ?? null }));
    }
  }

  return (
    <div
      ref={containerRef}
      className="board grab-scroll"
      onMouseDown={handleMouseDown}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          className="board-col"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(col, e)}
        >
          <div className="board-col-header">
            <h2 className="group-title">
              {col.title}
              <span className="count-inline">{col.tasks.length}</span>
            </h2>
          </div>
          <div className="task-list">
            {col.tasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", task.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <TaskRow task={task} />
              </div>
            ))}
          </div>
          <div className="board-col-footer">
            <AddInline due={col.due ?? null} projectId={col.projectId ?? null} sectionId={col.sectionId ?? null} />
          </div>
        </div>
      ))}
      {extraColumn}
    </div>
  );
}
