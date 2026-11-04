import { useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Icon } from "../../components/Icon";
import { useTasks, todayIso } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--color-priority-high, #ef4444)",
  medium: "var(--color-priority-medium, #f4a66e)",
  low: "var(--color-priority-low, #60a5fa)",
  none: "var(--color-muted)",
};

export function CalendarView() {
  const open = useTasks((s) => s.open);
  const createTask = useTasks((s) => s.createTask);
  const openTask = useUi((s) => s.openTask);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");

  const [blockingModal, setBlockingModal] = useState<{
    date: string;
    time: string;
  } | null>(null);
  const [blockTitle, setBlockTitle] = useState("");
  const [blockDuration, setBlockDuration] = useState("60");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const tasksForSelectedDay = open.filter((t) => t.dueDate === selectedDate);
  const today = todayIso();

  async function handleCreateTimeBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blockingModal || !blockTitle.trim()) return;
    await createTask({
      title: blockTitle.trim(),
      notes: `Time-block duration: ${blockDuration}m`,
      priority: "medium",
      dueDate: blockingModal.date,
      dueTime: blockingModal.time,
      projectId: null,
      sectionId: null,
      tags: ["timeblock"],
      recurRule: null,
    });
    setBlockTitle("");
    setBlockingModal(null);
  }

  function handleSlotClick(dateStr: string, hour: number) {
    const formattedHour = String(hour).padStart(2, "0") + ":00";
    setBlockingModal({ date: dateStr, time: formattedHour });
  }

  return (
    <div className="page wide">
      <header className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1>Calendar</h1>
            <div className="cal-nav-buttons">
              <button
                className="icon-btn"
                onClick={() => setCurrentDate((d) => subMonths(d, 1))}
                aria-label="Previous Month"
                title="Previous Month"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
              <span className="cal-month-title">{format(currentDate, "MMMM yyyy")}</span>
              <button
                className="icon-btn"
                onClick={() => setCurrentDate((d) => addMonths(d, 1))}
                aria-label="Next Month"
                title="Next Month"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </div>
          <div className="cal-view-toggles">
            <button
              className={`chip ${viewMode === "month" ? "active" : ""}`}
              onClick={() => setViewMode("month")}
            >
              Month View
            </button>
            <button
              className={`chip ${viewMode === "day" ? "active" : ""}`}
              onClick={() => setViewMode("day")}
            >
              Day View
            </button>
          </div>
        </div>
      </header>

      {viewMode === "month" && (
        <div className="cal-month-grid-container">
          <div className="cal-month-weekdays-header">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="cal-weekday-title">
                {day}
              </div>
            ))}
          </div>

          <div className="cal-month-grid">
            {monthDays.map((d) => {
              const dIso = format(d, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(d, currentDate);
              const isSelected = selectedDate === dIso;
              const isToday = dIso === today;
              const dayTasks = open.filter((t) => t.dueDate === dIso);

              return (
                <div
                  key={dIso}
                  className={`cal-month-cell ${!isCurrentMonth ? "other-month" : ""} ${
                    isSelected ? "selected-day" : ""
                  } ${isToday ? "today-cell" : ""}`}
                  onClick={() => {
                    setSelectedDate(dIso);
                  }}
                  onDoubleClick={() => {
                    setSelectedDate(dIso);
                    setViewMode("day");
                  }}
                >
                  <div className="cal-cell-header">
                    <span className={`cal-cell-day-num ${isToday ? "today-num-badge" : ""}`}>
                      {format(d, "d")}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="cal-cell-task-count">{dayTasks.length}</span>
                    )}
                  </div>
                  <div className="cal-cell-task-preview">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="cal-cell-chip"
                        style={{ borderLeftColor: PRIORITY_COLOR[t.priority] }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTask(t.id);
                        }}
                      >
                        {t.dueTime && <span className="chip-time">{t.dueTime}</span>}
                        <span className="chip-title">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="cal-cell-more">+{dayTasks.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cal-selected-agenda card" style={{ marginTop: 20 }}>
            <div className="cal-agenda-header">
              <h3>
                Tasks for {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
                {selectedDate === today && " (Today)"}
              </h3>
              <button
                className="chip primary"
                onClick={() => setViewMode("day")}
              >
                Time Block This Day
              </button>
            </div>
            {tasksForSelectedDay.length === 0 ? (
              <p className="muted" style={{ margin: "12px 0 0" }}>
                No tasks scheduled for this day. Double-click to open Time Blocking grid.
              </p>
            ) : (
              <div className="cal-agenda-list" style={{ marginTop: 12 }}>
                {tasksForSelectedDay.map((t) => (
                  <div
                    key={t.id}
                    className="cal-agenda-item"
                    onClick={() => openTask(t.id)}
                  >
                    <span
                      className="priority-indicator"
                      style={{ background: PRIORITY_COLOR[t.priority] }}
                    />
                    <span className="cal-agenda-time">
                      {t.dueTime ? t.dueTime : "All Day"}
                    </span>
                    <span className="cal-agenda-title">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "day" && (
        <div className="cal-day-scheduler card">
          <div className="cal-day-header-bar">
            <div>
              <h2>{format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</h2>
              <span className="muted" style={{ fontSize: 13 }}>
                Click any time slot below to schedule a time-block
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="chip"
                onClick={() => {
                  const prev = format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd");
                  setSelectedDate(prev);
                }}
              >
                Previous Day
              </button>
              <button
                className="chip"
                onClick={() => {
                  const next = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
                  setSelectedDate(next);
                }}
              >
                Next Day
              </button>
              <button className="chip" onClick={() => setViewMode("month")}>
                Back to Month
              </button>
            </div>
          </div>

          <div className="cal-day-time-grid">
            {HOURS.map((hour) => {
              const hourStr = String(hour).padStart(2, "0") + ":00";
              const slottedTasks = tasksForSelectedDay.filter(
                (t) => t.dueTime && t.dueTime.startsWith(String(hour).padStart(2, "0"))
              );

              return (
                <div
                  key={hour}
                  className="cal-day-hour-row"
                  onClick={() => handleSlotClick(selectedDate, hour)}
                >
                  <div className="cal-hour-tag">{hourStr}</div>
                  <div className="cal-hour-content">
                    {slottedTasks.map((t) => (
                      <div
                        key={t.id}
                        className="cal-scheduled-block"
                        style={{ borderLeftColor: PRIORITY_COLOR[t.priority] }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTask(t.id);
                        }}
                      >
                        <span className="time-badge">{t.dueTime}</span>
                        <span className="title-text">{t.title}</span>
                        {t.notes && <span className="notes-text">{t.notes}</span>}
                      </div>
                    ))}
                    {slottedTasks.length === 0 && (
                      <div className="cal-empty-slot-hint">+ Click to time block {hourStr}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {blockingModal && (
        <div className="modal-backdrop" onMouseDown={() => setBlockingModal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateTimeBlock}>
              <h2 style={{ margin: "0 0 16px" }}>
                Time Block: {blockingModal.date} at {blockingModal.time}
              </h2>
              <input
                autoFocus
                className="subtask-input"
                style={{ width: "100%", padding: "10px 12px", fontSize: 15 }}
                placeholder="Event / Task Title (e.g. Deep Work, Workout, Meeting)"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
                <label style={{ fontSize: 13, color: "var(--color-muted)" }}>
                  Duration:
                </label>
                <select
                  value={blockDuration}
                  onChange={(e) => setBlockDuration(e.target.value)}
                  className="habit-form-select"
                  style={{ width: "auto" }}
                >
                  <option value="15">15 mins</option>
                  <option value="30">30 mins</option>
                  <option value="45">45 mins</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
                <button
                  type="button"
                  className="chip muted"
                  onClick={() => setBlockingModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="chip primary">
                  Schedule Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
