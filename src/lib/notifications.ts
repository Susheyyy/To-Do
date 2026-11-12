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
  const load = useTasks((s) => s.load);

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
        await load();
        const currentOverdue = useTasks.getState().overdue;
        const currentToday = useTasks.getState().today;
        const totalPending = currentToday.length + currentOverdue.length;

        let body = "";
        if (totalPending === 0) {
          body = "You have no tasks scheduled for today!";
        } else if (currentOverdue.length > 0 && currentToday.length > 0) {
          body = `You have ${currentToday.length} task${currentToday.length > 1 ? "s" : ""} due today and ${currentOverdue.length} overdue task${currentOverdue.length > 1 ? "s" : ""}.`;
        } else if (currentOverdue.length > 0) {
          body = `You have ${currentOverdue.length} overdue task${currentOverdue.length > 1 ? "s" : ""} to catch up on!`;
        } else {
          body = `You have ${currentToday.length} task${currentToday.length > 1 ? "s" : ""} due today.`;
        }

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

        const [tH, tM] = task.dueTime.split(":").map(Number);
        const [nH, nM] = nowTimeStr.split(":").map(Number);
        const taskMinutes = tH * 60 + tM;
        const nowMinutes = nH * 60 + nM;
        const diffMinutes = nowMinutes - taskMinutes;

        if (task.dueDate === todayDateStr && diffMinutes >= 0 && diffMinutes <= 5) {
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
