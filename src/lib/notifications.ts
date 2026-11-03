import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { format } from "date-fns";
import { useSettings } from "../stores/settings.store";
import { useTasks } from "../stores/tasks.store";

export function isQuietTime(
  now: Date,
  enabled: boolean,
  startStr: string,
  endStr: string
): boolean {
  if (!enabled) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = startStr.split(":").map(Number);
  const [eH, eM] = endStr.split(":").map(Number);
  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function NotificationManager() {
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const quietHoursEnabled = useSettings((s) => s.quietHoursEnabled);
  const quietHoursStart = useSettings((s) => s.quietHoursStart);
  const quietHoursEnd = useSettings((s) => s.quietHoursEnd);
  const morningBriefingEnabled = useSettings((s) => s.morningBriefingEnabled);
  const morningBriefingTime = useSettings((s) => s.morningBriefingTime);

  const openTasks = useTasks((s) => s.open);
  const todayTasks = useTasks((s) => s.today);
  const overdueTasks = useTasks((s) => s.overdue);

  const notifiedTasksRef = useRef<Set<string>>(new Set());
  const briefingDateRef = useRef<string>("");

  useEffect(() => {
    async function checkPermission() {
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === "granted";
        }
      } catch {
        // Fallback or non-tauri context
      }
    }
    void checkPermission();
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) return;

    const interval = setInterval(async () => {
      const now = new Date();
      const nowTimeStr = format(now, "HH:mm");
      const todayDateStr = format(now, "yyyy-MM-dd");

      const inQuiet = isQuietTime(
        now,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd
      );

      if (
        morningBriefingEnabled &&
        !inQuiet &&
        nowTimeStr === morningBriefingTime &&
        briefingDateRef.current !== todayDateStr
      ) {
        briefingDateRef.current = todayDateStr;
        const totalPending = todayTasks.length + overdueTasks.length;
        const body =
          totalPending === 0
            ? "You have no tasks scheduled for today!"
            : `You have ${totalPending} task${totalPending > 1 ? "s" : ""} due today (${overdueTasks.length} overdue).`;

        try {
          sendNotification({
            title: "Good Morning! Daily Briefing",
            body,
          });
        } catch {}
      }

      if (inQuiet) return;

      for (const task of openTasks) {
        if (task.completedAt) continue;
        if (!task.dueDate || !task.dueTime) continue;

        const taskKey = `${task.id}_${task.dueDate}_${task.dueTime}`;
        if (notifiedTasksRef.current.has(taskKey)) continue;

        if (task.dueDate === todayDateStr && task.dueTime === nowTimeStr) {
          notifiedTasksRef.current.add(taskKey);
          try {
            sendNotification({
              title: `Task Due: ${task.title}`,
              body: task.notes ? task.notes.slice(0, 80) : "This task is due now.",
            });
          } catch {}
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [
    notificationsEnabled,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    morningBriefingEnabled,
    morningBriefingTime,
    openTasks,
    todayTasks,
    overdueTasks,
  ]);

  return null;
}
