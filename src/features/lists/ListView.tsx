import { addDays, format, parseISO } from "date-fns";

import { useTheme } from "../../app/ThemeProvider";
import { AddInline } from "../../components/AddInline";
import { Board } from "../../components/Board";
import { DisplayMenu } from "../../components/DisplayMenu";
import { Group } from "../../components/Group";
import { Icon } from "../../components/Icon";
import { Mascot } from "../../components/Mascot";
import { sortTasks } from "../../lib/sortTasks";
import { todayIso, useTasks } from "../../stores/tasks.store";
import { ListId, useUi } from "../../stores/ui.store";
import type { Priority, Task } from "../../types/models";

const TITLES: Record<ListId, string> = {
  inbox: "Inbox",
  today: "Today",
  upcoming: "Upcoming",
  filters: "Filters & Labels",
};

const PRIORITY_COLUMNS: { key: Priority; title: string }[] = [
  { key: "high", title: "Priority 1" },
  { key: "medium", title: "Priority 2" },
  { key: "low", title: "Priority 3" },
  { key: "none", title: "Priority 4" },
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
  const filterPriority = useUi((s) => s.filterPriority);
  const filterTag = useUi((s) => s.filterTag);

  function applyFilters(list: Task[]): Task[] {
    let res = list;
    if (filterPriority !== "all") {
      res = res.filter((t) => t.priority === filterPriority);
    }
    if (filterTag !== "all") {
      res = res.filter((t) => t.tags.includes(filterTag));
    }
    return sortTasks(res, sort);
  }

  const rawDueNow = [...overdue, ...today];
  const dueNow = applyFilters(rawDueNow);
  const inbox = applyFilters(open.filter((t) => !t.dueDate && !t.projectId));
  const days = Array.from({ length: 7 }, (_, i) => dayIso(i));
  const tasksOn = (d: string) => applyFilters(open.filter((t) => t.dueDate === d));
  const later = applyFilters(open.filter((t) => t.dueDate !== null && t.dueDate > days[6]));

  const isEmpty =
    (id === "inbox" && inbox.length === 0) ||
    (id === "today" && dueNow.length === 0 && (!showCompleted || completedToday.length === 0));

  const totalCount = id === "today" ? rawDueNow.length : id === "inbox" ? open.filter((t) => !t.dueDate && !t.projectId).length : open.length;

  return (
    <div className={`page ${id === "today" && layout === "board" ? "wide" : ""}`}>
      <div className="view-navigation-bar">
        <div />
        <div className="header-tools">
          <DisplayMenu
            showCompletedToggle={id === "today"}
            count={totalCount}
            showCalendar={id !== "today"}
          />
        </div>
      </div>

      <header className="page-header">
        <div className="page-title-row">
          <h1>{TITLES[id]}</h1>
        </div>
        {id === "today" && (
          <div className="page-sub-row">
            <span className="page-sub">{format(new Date(), "EEEE, d MMMM")}</span>
            <span className="page-sub-dot">·</span>
            <span className="page-sub">
              {rawDueNow.length} pending · {completedToday.length} done today
            </span>
          </div>
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

      {id === "today" && layout === "list" && (
        <div className="page-add-inline">
          <AddInline due={todayIso()} />
        </div>
      )}

      {id === "inbox" && layout === "list" && (
        <div className="page-add-inline">
          <AddInline due={null} />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: 16 }}>
        {id === "inbox" && inbox.length > 0 && <Group title="Inbox" tasks={inbox} />}

        {id === "today" && layout === "list" && (
          <>
            {overdue.length > 0 && <Group title="Overdue" tasks={applyFilters(overdue)} />}
            {today.length > 0 && <Group title="Today" tasks={applyFilters(today)} />}
            {showCompleted && completedToday.length > 0 && (
              <Group title="Completed" tasks={applyFilters(completedToday)} />
            )}
          </>
        )}

        {id === "today" && layout === "board" && (
          <Board
            columns={PRIORITY_COLUMNS.map((c) => ({
              key: c.key,
              title: c.title,
              due: todayIso(),
              tasks: dueNow.filter((t) => t.priority === c.key),
            }))}
          />
        )}

        {id !== "today" && layout === "calendar" && (
          <div className="calendar-view-placeholder">
            <div className="week-strip" style={{ marginTop: 0 }}>
              {days.map((d) => (
                <div key={d} className="calendar-col">
                  <div className="calendar-col-header">
                    <span className="week-name">{format(parseISO(d), "EEE")}</span>
                    <span className="week-num">{format(parseISO(d), "d")}</span>
                  </div>
                  <div className="calendar-task-list">
                    {tasksOn(d).map((task) => (
                      <div key={task.id} className="calendar-task-card">
                        <span className={`priority-${task.priority}`}>
                          <Icon name="flag" size={12} />
                        </span>
                        <span className="calendar-task-title">{task.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {id === "upcoming" && (
          <>
            {overdue.length > 0 && (
              <Group
                title="Overdue"
                tasks={applyFilters(overdue)}
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
