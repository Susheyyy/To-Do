import type { ClockFormat } from "../stores/settings.store";

export function formatTime(hhmm: string, clock: ClockFormat): string {
  const [h, m] = hhmm.split(":").map(Number);
  const minutes = String(m).padStart(2, "0");
  if (clock === "24h") {
    return `${String(h).padStart(2, "0")}:${minutes}`;
  }
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${minutes}${suffix}`;
}