import { addDays, format, parseISO } from "date-fns";

import { useTheme } from "../../app/ThemeProvider";
import { AddInline } from "../../components/AddInline";
import { Board, LayoutSwitch } from "../../components/Board";
import { DisplayMenu } from "../../components/DisplayMenu";
import { Group } from "../../components/Group";
import { Mascot } from "../../components/Mascot";
import { QuickAdd } from "../../components/QuickAdd";
import { sortTasks } from "../../lib/sortTasks";
import { todayIso, useTasks } from "../../stores/tasks.store";
import { ListId, useUi } from "../../stores/ui.store";
import type { Priority } from "../../types/models";

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

const dayIso = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

export function ListView({ id }: { id: ListId }) {
  const { theme } = useTheme();
  const open = useTasks((s) => s.open);
  const today = useTasks((s) => s.today);
  const overdue = useTasks((s) => s.overdue);
  const completedToday = useTasks((s) => s.completedToday);
  const error = useTasks((s) => s.error);
  const rescheduleOverdue = useTasks((s) => s.rescheduleOverdue);
  const layout = useUi((s) => s.layout);
  const showCompleted = useUi((s) => s.showCompleted);
  const sort = useUi((s) => s.sort);

  const dueNow = [...overdue, ...today];
  const inbox = sortTasks(open.filter((t) => !t.dueDate && !t.projectId), sort);
  const days = Array.from({ length: 7 }, (_, i) => dayIso(i));
  const tasksOn = (d: string) => sortTasks(open.filter((t) => t.dueDate === d), sort);
  const later = sortTasks(open.filter((t) => t.dueDate !== null && t.dueDate > days[6]), sort);

  const isEmpty =
    (id === "inbox" && inbox.length === 0) ||
    (id === "today" && dueNow.length === 0 && (!showCompleted || completedToday.length === 0));

  return (
    <div className={`page ${id === "today" && layout === "board" ? "wide" : ""}`}>
      <header className="page-header">
        <div className="page-title-row">
          <h1>{TITLES[id]}</h1>
          <div className="header-tools">
            <DisplayMenu showCompletedToggle={id === "today"} />
            {id === "today" && <LayoutSwitch />}
          </div>
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

      {id === "upcoming" && (
        <div className="week-strip">
          {days.map((d) => (
            <button
              key={d}
              className="week-day"
              onClick={() =>
                document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <span className="week-name">{format(parseISO(d), "EEE")}</span>
              <span className="week-num">{format(parseISO(d), "d")}</span>
              {tasksOn(d).length > 0 && <span className="week-dot" />}
            </button>
          ))}
        </div>
      )}

      {id !== "upcoming" && <QuickAdd defaultDue={id === "today" ? todayIso() : null} />}

      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: 16 }}>
        {id === "inbox" && inbox.length > 0 && <Group title="Inbox" tasks={inbox} />}

        {id === "today" && layout === "list" && (
          <>
            {overdue.length > 0 && <Group title="Overdue" tasks={sortTasks(overdue, sort)} />}
            {today.length > 0 && <Group title="Today" tasks={sortTasks(today, sort)} />}
            {showCompleted && completedToday.length > 0 && (
              <Group title="Completed" tasks={completedToday} />
            )}
          </>
        )}

        {id === "today" && layout === "board" && (
          <Board
            columns={PRIORITY_COLUMNS.map((c) => ({
              key: c.key,
              title: c.title,
              tasks: sortTasks(dueNow.filter((t) => t.priority === c.key), sort),
            }))}
          />
        )}

        {id === "upcoming" && (
          <>
            {overdue.length > 0 && (
              <Group
                title="Overdue"
                tasks={sortTasks(overdue, sort)}
                extra={
                  <button className="chip" onClick={() => void rescheduleOverdue()}>
                    Reschedule to today
                  </button>
                }
              />
            )}
            {days.map((d, i) => (
              <Group
                key={d}
                id={`day-${d}`}
                title={i === 0 ? `Today · ${format(parseISO(d), "EEEE, d MMM")}` : format(parseISO(d), "EEEE, d MMM")}
                tasks={tasksOn(d)}
                footer={<AddInline due={d} />}
              />
            ))}
            {later.length > 0 && <Group title="Later" tasks={later} />}
          </>
        )}

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