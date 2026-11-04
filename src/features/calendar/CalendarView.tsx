import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { Icon } from "../../components/Icon";
import { useTasks, todayIso } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function timeToFraction(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h * 60 + m) / (24 * 60);
}

export function CalendarView() {
  const open = useTasks((s) => s.open);
  const setView = useUi((s) => s.setView);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayIso();

  const tasksWithTime = open.filter((t) => t.dueDate && t.dueTime);
  const tasksAllDay = open.filter((t) => t.dueDate && !t.dueTime);

  function getTasksForDay(dayIso: string, withTime: boolean) {
    if (withTime) return tasksWithTime.filter((t) => t.dueDate === dayIso);
    return tasksAllDay.filter((t) => t.dueDate === dayIso);
  }

  const PRIORITY_COLOR: Record<string, string> = {
    high: "var(--color-priority-high, #ef4444)",
    medium: "var(--color-priority-medium, #f4a66e)",
    low: "var(--color-priority-low, #60a5fa)",
    none: "var(--color-muted)",
  };

  return (
    <div className="page wide">
      <header className="page-header">
        <div className="page-title-row">
          <h1>Calendar</h1>
        </div>
        <div className="page-sub-row">
          <span className="page-sub">{format(weekStart, "MMMM yyyy")}</span>
        </div>
      </header>

      <div className="cal-wrap">
        <div className="cal-header-row">
          <div className="cal-time-gutter" />
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            return (
              <div key={iso} className={`cal-day-header${iso === today ? " cal-today" : ""}`}>
                <span className="cal-day-name">{format(d, "EEE")}</span>
                <span className={`cal-day-num${iso === today ? " cal-today-num" : ""}`}>{format(d, "d")}</span>
                <div className="cal-allday-tasks">
                  {getTasksForDay(iso, false).map((t) => (
                    <div
                      key={t.id}
                      className="cal-task-chip"
                      style={{ borderLeftColor: PRIORITY_COLOR[t.priority] }}
                      onClick={() => useUi.getState().openTask(t.id)}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cal-body">
          <div className="cal-time-col">
            {HOURS.map((h) => (
              <div key={h} className="cal-hour-label">
                {h === 0 ? "" : `${h}:00`}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const dayTasks = getTasksForDay(iso, true);
            return (
              <div key={iso} className="cal-day-col">
                {HOURS.map((h) => (
                  <div key={h} className="cal-hour-slot" />
                ))}
                {dayTasks.map((t) => {
                  const frac = timeToFraction(t.dueTime!);
                  const topPct = frac * 100;
                  return (
                    <div
                      key={t.id}
                      className="cal-event"
                      style={{
                        top: `${topPct}%`,
                        borderLeftColor: PRIORITY_COLOR[t.priority],
                        background: `${PRIORITY_COLOR[t.priority]}22`,
                      }}
                      onClick={() => useUi.getState().openTask(t.id)}
                      title={`${t.dueTime} ${t.title}`}
                    >
                      <span className="cal-event-time">{t.dueTime}</span>
                      <span className="cal-event-title">{t.title}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

