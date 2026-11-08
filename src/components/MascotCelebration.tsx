import { useEffect, useState } from "react";
import { Mascot } from "./Mascot";
import { useTasks } from "../stores/tasks.store";
import { useSettings } from "../stores/settings.store";
import { playCelebrationSound } from "../lib/sound";

export function MascotCelebration() {
  const completedToday = useTasks((s) => s.completedToday.length);
  const dailyGoal = useSettings((s) => s.dailyGoal);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const [celebrating, setCelebrating] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    
    if (completedToday >= dailyGoal && dailyGoal > 0 && !hasCelebrated) {
      setCelebrating(true);
      setHasCelebrated(true);
      if (soundEnabled) {
        playCelebrationSound();
      }
      const t = setTimeout(() => {
        setCelebrating(false);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [completedToday, dailyGoal, hasCelebrated, soundEnabled]);

  if (!celebrating) return null;

  return (
    <div
      className="mascot-celebration-toast"
      style={{
        position: "fixed",
        bottom: "32px",
        right: "32px",
        zIndex: 9999,
        background: "var(--color-bg-secondary, #1e1e24)",
        border: "2px solid var(--color-accent, #6366f1)",
        borderRadius: "16px",
        padding: "16px 20px",
        boxShadow: "0 16px 36px rgba(99, 102, 241, 0.35)",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        animation: "slideInBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}
    >
      <div style={{ transform: "scale(1.2)" }}>
        <Mascot size={42} />
      </div>
      <div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary, #ffffff)" }}>
          🎉 Daily Goal Crushed!
        </div>
        <div style={{ fontSize: "13px", color: "var(--color-text-secondary, #8e8e93)" }}>
          You completed {completedToday} of {dailyGoal} goals today. Awesome work!
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCelebrating(false)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-secondary, #8e8e93)",
          cursor: "pointer",
          fontSize: "16px",
          marginLeft: "8px",
        }}
      >
        ✕
      </button>
    </div>
  );
}

