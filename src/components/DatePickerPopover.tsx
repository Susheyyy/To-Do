import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { Icon } from "./Icon";

interface Props {
  value: string | null;
  onChange: (dateStr: string | null) => void;
}

export function DatePickerPopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const initial = value ? parseISO(value) : new Date();
  const [viewMonth, setViewMonth] = useState(initial);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedDate = value ? parseISO(value) : null;

  function selectDate(d: Date) {
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  }

  function clearDate(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "var(--color-bg-secondary, #1a1a20)",
          border: "1px solid var(--color-border, #2d2d38)",
          borderRadius: "8px",
          color: value ? "var(--color-text-primary, #ffffff)" : "var(--color-text-secondary, #8e8e93)",
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Icon name="calendar" size={14} />
          {value ? format(parseISO(value), "MMM d, yyyy") : "No due date"}
        </span>
        {value && (
          <span
            onClick={clearDate}
            style={{ color: "var(--color-text-secondary, #8e8e93)", fontSize: "14px", padding: "0 4px" }}
            title="Clear date"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "6px",
            zIndex: 60,
            background: "var(--color-bg-secondary, #1a1a20)",
            border: "1px solid var(--color-border, #333340)",
            borderRadius: "12px",
            padding: "12px",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            width: "260px",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              style={{ width: "24px", height: "24px" }}
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{format(viewMonth, "MMMM yyyy")}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              style={{ width: "24px", height: "24px" }}
            >
              <Icon name="chevronRight" size={14} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "4px" }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} style={{ fontSize: "10px", color: "var(--color-text-secondary, #8e8e93)", fontWeight: 700 }}>
                {d}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {days.map((d) => {
              const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
              const isCurrentMonth = isSameMonth(d, viewMonth);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => selectDate(d)}
                  style={{
                    padding: "6px 0",
                    background: isSelected ? "var(--color-accent, #6366f1)" : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : isCurrentMonth
                      ? "var(--color-text-primary, #ffffff)"
                      : "var(--color-text-secondary, #555560)",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: isSelected ? 700 : 400,
                  }}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

