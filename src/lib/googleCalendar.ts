import type { Task } from "../types/models";

const CLIENT_ID_KEY = "gcal_client_id";
const ACCESS_TOKEN_KEY = "gcal_access_token";
const CALENDAR_ID_KEY = "gcal_calendar_id";

export interface GCalConfig {
  clientId: string;
  isConnected: boolean;
  calendarId: string | null;
}

export function getGCalConfig(): GCalConfig {
  const clientId = localStorage.getItem(CLIENT_ID_KEY) || "";
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const calendarId = localStorage.getItem(CALENDAR_ID_KEY);
  return {
    clientId,
    isConnected: Boolean(token),
    calendarId,
  };
}

export function saveGCalClientId(clientId: string): void {
  localStorage.setItem(CLIENT_ID_KEY, clientId.trim());
}

export function disconnectGCal(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(CALENDAR_ID_KEY);
}

export function initGoogleAuth(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin;
    const scope = "https://www.googleapis.com/auth/calendar";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      authUrl,
      "google_auth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    const timer = window.setInterval(() => {
      try {
        if (!popup || popup.closed) {
          window.clearInterval(timer);
          reject(new Error("Sign in window was closed"));
          return;
        }

        const hash = popup.location.hash;
        if (hash && hash.includes("access_token=")) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          window.clearInterval(timer);
          popup.close();

          if (accessToken) {
            localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
            resolve(accessToken);
          } else {
            reject(new Error("No access token found in response"));
          }
        }
      } catch {
      }
    }, 500);
  });
}

export async function ensureTodoCalendar(accessToken: string): Promise<string> {
  const existingCalId = localStorage.getItem(CALENDAR_ID_KEY);
  if (existingCalId) return existingCalId;

  const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const data = await listRes.json();
    const existing = data.items?.find((c: any) => c.summary === "Todo Desktop");
    if (existing) {
      localStorage.setItem(CALENDAR_ID_KEY, existing.id);
      return existing.id;
    }
  }

  const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary: "Todo Desktop" }),
  });

  if (!createRes.ok) {
    return "primary";
  }

  const newCal = await createRes.json();
  localStorage.setItem(CALENDAR_ID_KEY, newCal.id);
  return newCal.id;
}

export async function syncTaskToGoogle(task: Task): Promise<void> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token || !task.dueDate) return;

  try {
    const calendarId = await ensureTodoCalendar(token);
    const eventBody: any = {
      summary: task.title,
      description: task.notes || "",
    };

    if (task.dueTime) {
      const [h, m] = task.dueTime.split(":").map(Number);
      const endM = (m + 30) % 60;
      const endH = h + Math.floor((m + 30) / 60);
      const pad = (n: number) => String(n).padStart(2, "0");
      
      eventBody.start = {
        dateTime: `${task.dueDate}T${task.dueTime}:00`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      eventBody.end = {
        dateTime: `${task.dueDate}T${pad(endH)}:${pad(endM)}:00`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    } else {
      eventBody.start = { date: task.dueDate };
      eventBody.end = { date: task.dueDate };
    }

    if (task.recurRule) {
      const r = task.recurRule.toLowerCase();
      if (r === "daily") eventBody.recurrence = ["RRULE:FREQ=DAILY"];
      else if (r === "weekly") eventBody.recurrence = ["RRULE:FREQ=WEEKLY"];
      else if (r === "monthly") eventBody.recurrence = ["RRULE:FREQ=MONTHLY"];
      else if (r === "weekdays") eventBody.recurrence = ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"];
    }

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );
  } catch (err) {
    console.error("Failed to sync task with Google Calendar:", err);
  }
}

