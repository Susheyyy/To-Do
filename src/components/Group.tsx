import { ReactNode } from "react";

import { TaskRow } from "../features/today/TaskRow";
import type { Task } from "../types/models";

export function Group({
  id,
  title,
  tasks,
  extra,
  footer,
}: {
  id?: string;
  title: string;
  tasks: Task[];
  extra?: ReactNode;
  footer?: ReactNode;
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
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
      {footer}
    </section>
  );
}