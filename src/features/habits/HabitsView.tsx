import { useEffect, useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { Icon } from "../../components/Icon";
import { useHabits } from "../../stores/habits.store";
import type { Habit, HabitFrequency, HabitInput } from "../../types/models";

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily: "Every day",
  weekdays: "Weekdays (Mon-Fri)",
  weekly: "Weekly (Once a week)",
  custom: "Custom Days",
};

const WEEKDAY_KEYS = [
  { key: "1", label: "Mon" },
  { key: "2", label: "Tue" },
  { key: "3", label: "Wed" },
  { key: "4", label: "Thu" },
  { key: "5", label: "Fri" },
  { key: "6", label: "Sat" },
  { key: "0", label: "Sun" },
];

const HABIT_COLORS = [
  "#f4a6c8", "#f4c16e", "#7ecfb5", "#84c1f4", "#b8a9f4",
  "#f4a06e", "#f47f7f", "#a9d4a4", "#7fb8f4", "#d4a9f4",
];

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function buildGrid(days = 28): string[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) =>
    format(subDays(today, days - 1 - i), "yyyy-MM-dd")
  );
}

export function HabitsView() {
  const habits = useHabits((s) => s.habits);
  const logs = useHabits((s) => s.logs);
  const load = useHabits((s) => s.load);
  const loadLogs = useHabits((s) => s.loadLogs);
  const logHabit = useHabits((s) => s.logHabit);
  const unlogHabit = useHabits((s) => s.unlogHabit);
  const createHabit = useHabits((s) => s.createHabit);
  const updateHabit = useHabits((s) => s.updateHabit);
  const deleteHabit = useHabits((s) => s.deleteHabit);

  const [editing, setEditing] = useState<Habit | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<HabitInput>({
    name: "",
    color: HABIT_COLORS[0],
    icon: null,
    frequency: "daily",
    customDays: null,
    targetStreak: 1,
  });

  const grid = buildGrid(28);
  const today = todayIso();

  useEffect(() => {
    void load();
    const start = grid[0];
    const end = grid[grid.length - 1];
    void loadLogs(start, end);
  }, []);

  
  const logSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) {
      s.add(`${l.habitId}:${l.loggedDate}`);
    }
    return s;
  }, [logs]);

  function isLogged(habitId: string, date: string) {
    return logSet.has(`${habitId}:${date}`);
  }

  function streakCount(habit: Habit): number {
    let streak = 0;
    let cur = parseISO(today);

    
    function isScheduledDay(dateObj: Date): boolean {
      const dayOfWeek = dateObj.getDay(); 
      if (habit.frequency === "weekdays") {
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      }
      if (habit.frequency === "weekly") {
        return true; 
      }
      if (habit.frequency === "custom" && habit.customDays) {
        const allowed = habit.customDays.split(",").map((s) => s.trim());
        return allowed.includes(String(dayOfWeek));
      }
      
      return true;
    }

    
    const todayStr = format(cur, "yyyy-MM-dd");
    if (!isLogged(habit.id, todayStr) && !isScheduledDay(cur)) {
      cur = subDays(cur, 1);
    } else if (!isLogged(habit.id, todayStr) && isScheduledDay(cur)) {
      
      const yesterday = subDays(cur, 1);
      const yStr = format(yesterday, "yyyy-MM-dd");
      if (isLogged(habit.id, yStr)) {
        cur = yesterday;
      }
    }

    
    for (let i = 0; i < 365; i++) {
      const d = format(cur, "yyyy-MM-dd");
      const scheduled = isScheduledDay(cur);
      const logged = isLogged(habit.id, d);

      if (scheduled) {
        if (logged) {
          streak++;
        } else {
          
          break;
        }
      } else {
        
        
        if (logged) {
          streak++;
        }
      }
      cur = subDays(cur, 1);
    }
    return streak;
  }

  function toggleDay(habit: Habit, date: string) {
    if (isLogged(habit.id, date)) {
      void unlogHabit(habit.id, date);
    } else {
      void logHabit(habit.id, date);
    }
  }

  function formatFrequencyLabel(habit: Habit): string {
    if (habit.frequency !== "custom" || !habit.customDays) {
      return FREQ_LABELS[habit.frequency] || "Every day";
    }
    const days = habit.customDays.split(",");
    const map: Record<string, string> = { "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "0": "Sun" };
    return days.map((d) => map[d] || d).join(", ");
  }

  function openAdd() {
    setForm({ name: "", color: HABIT_COLORS[0], icon: null, frequency: "daily", customDays: "1,2,3,4,5", targetStreak: 1 });
    setEditing(null);
    setAdding(true);
  }

  function openEdit(habit: Habit) {
    setForm({
      name: habit.name,
      color: habit.color,
      icon: habit.icon,
      frequency: habit.frequency,
      customDays: habit.customDays,
      targetStreak: habit.targetStreak,
    });
    setEditing(habit);
    setAdding(true);
  }

  async function submitForm() {
    if (!form.name.trim()) return;
    if (editing) {
      await updateHabit(editing.id, form);
    } else {
      await createHabit(form);
    }
    setAdding(false);
    setEditing(null);
    const start = grid[0];
    const end = grid[grid.length - 1];
    void loadLogs(start, end);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-title-row">
          <h1>Habits</h1>
          <button className="icon-btn" onClick={openAdd} title="Add habit" aria-label="Add habit">
            <Icon name="plus" size={18} />
          </button>
        </div>
      </header>

      {adding && (
        <div className="habit-form-card card">
          <div className="habit-field-group">
            <label className="habit-field-label">Habit Name</label>
            <input
              className="habit-form-input"
              autoFocus
              placeholder="e.g. Morning Yoga, Read 10 pages..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitForm();
                if (e.key === "Escape") { setAdding(false); setEditing(null); }
              }}
            />
          </div>

          <div className="habit-field-group">
            <label className="habit-field-label">Frequency</label>
            <select
              className="habit-form-select"
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as HabitFrequency }))}
            >
              {(Object.entries(FREQ_LABELS) as [HabitFrequency, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {form.frequency === "custom" && (
            <div className="habit-field-group">
              <label className="habit-field-label">Select Active Days</label>
              <div className="habit-days-picker">
                {WEEKDAY_KEYS.map((day) => {
                  const activeDays = (form.customDays ? form.customDays.split(",") : []);
                  const isSelected = activeDays.includes(day.key);
                  return (
                    <button
                      type="button"
                      key={day.key}
                      className={`habit-day-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        const next = isSelected
                          ? activeDays.filter((k) => k !== day.key)
                          : [...activeDays, day.key];
                        setForm((f) => ({ ...f, customDays: next.join(",") }));
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="habit-field-group">
            <label className="habit-field-label">Color Badge</label>
            <div className="habit-color-row">
              {HABIT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`habit-color-dot${form.color === c ? " selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="habit-form-actions">
            <button type="button" className="chip primary" onClick={() => void submitForm()}>
              {editing ? "Save Changes" : "Add Habit"}
            </button>
            <button type="button" className="chip muted" onClick={() => { setAdding(false); setEditing(null); }}>
              Cancel
            </button>
            {editing && (
              <button
                type="button"
                className="chip danger-chip"
                onClick={() => { void deleteHabit(editing.id); setAdding(false); setEditing(null); }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {habits.length === 0 && !adding && (
        <div className="empty-state">
          <p>No habits yet. Click the + to add one.</p>
        </div>
      )}

      {habits.length > 0 && (
        <div className="habit-grid-wrap">
          <div className="habit-grid-header">
            <div className="habit-grid-name-col" />
            <div className="habit-grid-days">
              {grid.map((d) => (
                <div
                  key={d}
                  className={`habit-day-label${d === today ? " today" : ""}`}
                  title={format(parseISO(d), "EEE d MMM")}
                >
                  {format(parseISO(d), "d") === "1" || d === grid[0] ? format(parseISO(d), "MMM d") : format(parseISO(d), "d")}
                </div>
              ))}
            </div>
            <div className="habit-streak-col" />
          </div>

          {habits.map((habit) => {
            const streak = streakCount(habit);
            return (
              <div key={habit.id} className="habit-row">
                <button
                  className="habit-name-cell"
                  onClick={() => openEdit(habit)}
                  title="Edit habit"
                >
                  <span className="habit-dot" style={{ background: habit.color ?? "var(--color-accent)" }} />
                  <span className="habit-name-text">{habit.name}</span>
                  <span className="habit-freq">{formatFrequencyLabel(habit)}</span>
                </button>
                <div className="habit-grid-days">
                  {grid.map((d) => {
                    const logged = isLogged(habit.id, d);
                    const isFuture = d > today;
                    return (
                      <button
                        key={d}
                        className={`habit-cell${logged ? " logged" : ""}${d === today ? " today" : ""}${isFuture ? " future" : ""}`}
                        style={logged ? { background: habit.color ?? "var(--color-accent)" } : undefined}
                        onClick={() => !isFuture && toggleDay(habit, d)}
                        disabled={isFuture}
                        aria-label={`${habit.name} ${d}`}
                        title={format(parseISO(d), "EEE d MMM")}
                      />
                    );
                  })}
                </div>
                <div className="habit-streak-col">
                  {streak > 0 && (
                    <span className="habit-streak" style={{ color: habit.color ?? "var(--color-accent)" }}>
                      {streak}d
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

