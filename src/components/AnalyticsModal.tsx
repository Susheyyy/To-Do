import { useEffect, useState, useMemo } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { api } from "../lib/api";
import { Mascot } from "./Mascot";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyGoal: number;
}

export function AnalyticsModal({ isOpen, onClose, dailyGoal }: AnalyticsModalProps) {
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [habitDates, setHabitDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<{ date: string; count: number; habits: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const today = new Date();
        const start = format(subDays(today, 365), "yyyy-MM-dd");
        const end = format(today, "yyyy-MM-dd");

        const [tasks, habitLogs] = await Promise.all([
          api.listCompletedBetween(start, end + " 23:59:59"),
          api.listHabitLogs(start, end),
        ]);

        if (mounted) {
          const taskCompletionDates = tasks
            .map((t) => t.completedAt ? t.completedAt.slice(0, 10) : null)
            .filter((d): d is string => d !== null);

          const habitLogDates = habitLogs.map((h) => h.loggedDate);

          setCompletedDates(taskCompletionDates);
          setHabitDates(habitLogDates);
        }
      } catch (err) {
        console.error("Failed to load analytics data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [isOpen]);


  const { days, activityMap, totalCompleted, totalHabits, currentStreak, bestDay } = useMemo(() => {
    const today = new Date();
    const intervalDays = eachDayOfInterval({
      start: subDays(today, 364),
      end: today,
    });

    const map = new Map<string, { tasks: number; habits: number }>();
    for (const d of intervalDays) {
      map.set(format(d, "yyyy-MM-dd"), { tasks: 0, habits: 0 });
    }

    for (const d of completedDates) {
      if (map.has(d)) {
        map.get(d)!.tasks += 1;
      }
    }

    for (const d of habitDates) {
      if (map.has(d)) {
        map.get(d)!.habits += 1;
      }
    }

    let totalComp = 0;
    let totalHab = 0;
    let maxDay = { date: "", count: 0 };

    for (const [date, val] of map.entries()) {
      totalComp += val.tasks;
      totalHab += val.habits;
      const combined = val.tasks + val.habits;
      if (combined > maxDay.count) {
        maxDay = { date, count: combined };
      }
    }


    let streak = 0;
    for (let i = intervalDays.length - 1; i >= 0; i--) {
      const dateStr = format(intervalDays[i], "yyyy-MM-dd");
      const dayData = map.get(dateStr);
      if (dayData && (dayData.tasks > 0 || dayData.habits > 0)) {
        streak++;
      } else if (i === intervalDays.length - 1) {

        continue;
      } else {
        break;
      }
    }

    return {
      days: intervalDays,
      activityMap: map,
      totalCompleted: totalComp,
      totalHabits: totalHab,
      currentStreak: streak,
      bestDay: maxDay,
    };
  }, [completedDates, habitDates]);

  if (!isOpen) return null;


  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  function getIntensity(count: number): string {
    if (count === 0) return "var(--heatmap-empty, rgba(255, 255, 255, 0.05))";
    if (count === 1) return "rgba(99, 102, 241, 0.35)";
    if (count === 2 || count === 3) return "rgba(99, 102, 241, 0.6)";
    if (count === 4 || count === 5) return "rgba(99, 102, 241, 0.85)";
    return "rgba(129, 140, 248, 1)";
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "840px",
          backgroundColor: "var(--color-surface, #1e1e24)",
          border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35)",
          color: "var(--color-text, #ffffff)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "var(--color-accent-subtle, rgba(99, 102, 241, 0.15))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mascot size={26} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Productivity Analytics</h2>
              <span style={{ fontSize: "12px", color: "var(--color-muted, #94a3b8)" }}>
                Activity & Heatmap over the last 365 days
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-muted, #94a3b8)",
              cursor: "pointer",
              fontSize: "18px",
              padding: "4px 8px",
              borderRadius: "6px",
            }}
          >
            ✕
          </button>
        </div>

        {}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          <div
            style={{
              background: "var(--color-bg, rgba(0,0,0,0.2))",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--color-muted, #94a3b8)", textTransform: "uppercase", fontWeight: 600 }}>
              Tasks Completed
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px", color: "#818cf8" }}>
              {totalCompleted}
            </div>
          </div>

          <div
            style={{
              background: "var(--color-bg, rgba(0,0,0,0.2))",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--color-muted, #94a3b8)", textTransform: "uppercase", fontWeight: 600 }}>
              Habits Checked
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px", color: "#34d399" }}>
              {totalHabits}
            </div>
          </div>

          <div
            style={{
              background: "var(--color-bg, rgba(0,0,0,0.2))",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--color-muted, #94a3b8)", textTransform: "uppercase", fontWeight: 600 }}>
              Current Streak
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px", color: "#f59e0b" }}>
              {currentStreak} {currentStreak === 1 ? "day" : "days"}
            </div>
          </div>

          <div
            style={{
              background: "var(--color-bg, rgba(0,0,0,0.2))",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--color-muted, #94a3b8)", textTransform: "uppercase", fontWeight: 600 }}>
              Daily Goal
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px", color: "#ec4899" }}>
              {dailyGoal} / day
            </div>
          </div>
        </div>

        {}
        <div
          style={{
            background: "var(--color-bg, rgba(0,0,0,0.2))",
            borderRadius: "12px",
            padding: "16px",
            border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Contribution Heatmap</span>
            {selectedDay ? (
              <span style={{ fontSize: "12px", color: "#818cf8", fontWeight: 500 }}>
                {selectedDay.date}: {selectedDay.count} task{selectedDay.count === 1 ? "" : "s"}, {selectedDay.habits} habit{selectedDay.habits === 1 ? "" : "s"}
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: "var(--color-muted, #94a3b8)" }}>
                Hover or click a block for details
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>
              Loading productivity metrics...
            </div>
          ) : (
            <div style={{ overflowX: "auto", paddingBottom: "6px" }}>
              <div style={{ display: "flex", gap: "3px" }}>
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {week.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const info = activityMap.get(dateStr) || { tasks: 0, habits: 0 };
                      const totalActivity = info.tasks + info.habits;
                      const bg = getIntensity(totalActivity);

                      return (
                        <div
                          key={dateStr}
                          title={`${dateStr}: ${info.tasks} tasks, ${info.habits} habits`}
                          onMouseEnter={() => setSelectedDay({ date: dateStr, count: info.tasks, habits: info.habits })}
                          style={{
                            width: "11px",
                            height: "11px",
                            borderRadius: "2px",
                            backgroundColor: bg,
                            cursor: "pointer",
                            transition: "transform 0.1s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "6px", marginTop: "12px", fontSize: "11px", color: "var(--color-muted, #94a3b8)" }}>
            <span>Less</span>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getIntensity(0) }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getIntensity(1) }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getIntensity(3) }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getIntensity(5) }} />
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: getIntensity(8) }} />
            <span>More</span>
          </div>
        </div>

        {}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--color-muted, #94a3b8)" }}>
          <span>
            {bestDay.count > 0 ? (
              <>Highest productivity on <strong>{bestDay.date}</strong> with {bestDay.count} completions.</>
            ) : (
              "Complete tasks to build your activity heatmap."
            )}
          </span>
          <button
            onClick={onClose}
            className="chip primary"
            style={{ padding: "6px 14px", fontSize: "12px", cursor: "pointer" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
