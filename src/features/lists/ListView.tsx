import { useMemo } from "react";
import { addDays, format, parseISO } from "date-fns";

import { useTheme } from "../../app/ThemeProvider";
import { Board, LayoutSwitch } from "../../components/Board";
import { QuickAdd } from "../../components/QuickAdd";
import { todayIso, useTasks } from "../../stores/tasks.store";
import { ListId, useUi } from "../../stores/ui.store";
import type { Priority, Task } from "../../types/models";
import { TaskRow } from "../today/TaskRow";
import { Mascot } from "../../components/Mascot";

const TITLES: Record<ListId, string> = {
  inbox: "Inbox",
  today: "Today",
  upcoming: "Upcoming",
};

const PRIORITY_COLUMNS: { key: Priority; title: string }[] = [
  { key: "high", title: "High" },
  { key: "medium", title: "Medium" },
  { key: "low", title: "Low" },
];

function defaultDue(id: ListId): string | null {
  if (id === "today") return todayIso();
  if (id === "upcoming") return format(addDays(new Date(), 1), "yyyy-MM-dd");
  return null;
}

function Group({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <section>
      <h2 className="group-title">
        {title}
        <span className="count-inline">{tasks.length}</span>
      </h2>
      <div className="task-list">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

export function ListView({ id }: { id: ListId }) {
  const { theme } = useTheme();
  const open = useTasks((s) => s.open);
  const today = useTasks((s) => s.today);
  const overdue = useTasks((s) => s.overdue);
  const completedToday = useTasks((s) => s.completedToday);
  const error = useTasks((s) => s.error);
  const layout = useUi((s) => s.layout);

  const dueNow = [...overdue, ...today];
  const inbox = open.filter((t) => !t.dueDate);

  const upcomingByDate = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of open) {
      if (task.dueDate && task.dueDate > todayIso()) {
        (groups[task.dueDate] ??= []).push(task);
      }
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [open]);

  const isEmpty =
    (id === "inbox" && inbox.length === 0) ||
    (id === "today" && dueNow.length === 0) ||
    (id === "upcoming" && upcomingByDate.length === 0);

  const wide = id === "today" && layout === "board";

  return (
    <div className={`page ${wide ? "wide" : ""}`}>
      <header className="page-header">
        <div className="page-title-row">
          <h1>{TITLES[id]}</h1>
          {id === "today" && <LayoutSwitch />}
        </div>
        {id === "today" && (
          <>
            <p className="page-sub">{format(new Date(), "EEEE, d MMMM")}</p>
            <p className="page-sub">
              {dueNow.length} pending · {completedToday.length} done today
            </p>
          </>
        )}
      </header>

      <QuickAdd defaultDue={defaultDue(id)} />

      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: 16 }}>
        {id === "inbox" && inbox.length > 0 && <Group title="Inbox" tasks={inbox} />}

        {id === "today" && layout === "list" && (
          <>
            {overdue.length > 0 && <Group title="Overdue" tasks={overdue} />}
            {today.length > 0 && <Group title="Today" tasks={today} />}
          </>
        )}

        {id === "today" && layout === "board" && (
          <Board
            columns={PRIORITY_COLUMNS.map((c) => ({
              key: c.key,
              title: c.title,
              tasks: dueNow.filter((t) => t.priority === c.key),
            }))}
          />
        )}

        {id === "upcoming" &&
          upcomingByDate.map(([date, tasks]) => (
            <Group key={date} title={format(parseISO(date), "EEEE, d MMM")} tasks={tasks} />
          ))}

             {isEmpty && (
          <div className="empty-state">
            <Mascot size={64} />
            <p>{theme.copy.empty}</p>
          </div>
        )}
      </div>
    </div>
  );
}