import { ReactNode } from "react";

import { TaskRow } from "../features/today/TaskRow";
import type { Task } from "../types/models";

export function Group({
  id,
  title,
  tasks,
  extra,
  footer,
  selectedIds,
  onSelectTask,
  showSelection = false,
}: {
  id?: string;
  title: string;
  tasks: Task[];
  extra?: ReactNode;
  footer?: ReactNode;
  selectedIds?: string[];
  onSelectTask?: (id: string) => void;
  showSelection?: boolean;
}) {
  return (
    <section id={id} className="group">
      <div className="group-header">
        <h2 className="group-title">
          {title}
          <span className="count-inline">{tasks.length}</span>
        </h2>
        {extra}
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isSelected={selectedIds?.includes(task.id)}
            showSelection={showSelection}
            onSelect={onSelectTask && (() => onSelectTask(task.id))}
          />
        ))}
      </div>
      {footer}
    </section>
  );
}