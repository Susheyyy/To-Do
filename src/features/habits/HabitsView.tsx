import { useEffect, useState } from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { Icon } from "../../components/Icon";
import { useHabits } from "../../stores/habits.store";
import type { Habit, HabitFrequency, HabitInput } from "../../types/models";

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Weekly",
  custom: "Custom",
};

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

  function isLogged(habitId: string, date: string) {
    return logs.some((l) => l.habitId === habitId && l.loggedDate === date);
  }

  function streakCount(habit: Habit): number {
    let streak = 0;
    let cur = parseISO(today);
    while (true) {
      const d = format(cur, "yyyy-MM-dd");
      if (!isLogged(habit.id, d)) break;
      streak++;
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

  function openAdd() {
    setForm({ name: "", color: HABIT_COLORS[0], icon: null, frequency: "daily", customDays: null, targetStreak: 1 });
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

  const weekLabels = grid.filter((_, i) => i % 7 === 0 || i === grid.length - 1);

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
        <div className="habit-form-card">
          <input
            className="habit-form-input"
            autoFocus
            placeholder="Habit name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitForm();
              if (e.key === "Escape") { setAdding(false); setEditing(null); }
            }}
          />
          <div className="habit-form-row">
            <span className="habit-form-label">Frequency</span>
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
          <div className="habit-form-row">
            <span className="habit-form-label">Color</span>
            <div className="habit-color-row">
              {HABIT_COLORS.map((c) => (
                <button
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
            <button className="chip" onClick={() => void submitForm()}>
              {editing ? "Save" : "Add habit"}
            </button>
            <button className="chip muted" onClick={() => { setAdding(false); setEditing(null); }}>
              Cancel
            </button>
            {editing && (
              <button
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
                  <span
                    className="habit-dot"
                    style={{ background: habit.color ?? "var(--color-accent)" }}
                  />
                  <span className="habit-name-text">{habit.name}</span>
                  <span className="habit-freq">{FREQ_LABELS[habit.frequency]}</span>
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

