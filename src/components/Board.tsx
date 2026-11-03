import { TaskRow } from "../features/today/TaskRow";
import { Layout, useUi } from "../stores/ui.store";
import type { Task } from "../types/models";

export interface Column {
  key: string;
  title: string;
  tasks: Task[];
}

export function Board({ columns }: { columns: Column[] }) {
  return (
    <div className="board">
      {columns.map((col) => (
        <div key={col.key} className="board-col">
          <h2 className="group-title">
            {col.title}
            <span className="count-inline">{col.tasks.length}</span>
          </h2>
          <div className="task-list">
            {col.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
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
        <button key={o.id} className="chip" aria-pressed={layout === o.id} onClick={() => setLayout(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}