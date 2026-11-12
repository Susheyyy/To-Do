import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { api, isTauri } from "./api";
import { addDays, addMinutes, format } from "date-fns";
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
    signal: AbortSignal.timeout(15000),
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
    signal: AbortSignal.timeout(15000),
  });

  if (!createRes.ok) {
    throw new Error(`Could not create the Todo Desktop calendar (${createRes.status}).`);
  }

  const newCal = await createRes.json();
  localStorage.setItem(CALENDAR_ID_KEY, newCal.id);
  return newCal.id;
}

const eventIdsKey = "gcal_task_event_ids";
export const useCalendarSyncStatus = create<{ error: string | null }>(() => ({ error: null }));

let delivery: Promise<void> | undefined;
export function deliverCalendarChanges() {
  if (!isTauri) return;
  if (delivery) return delivery;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return;
  delivery = (async () => {
    const { changes, error } = await api.getCalendarChanges();
    useCalendarSyncStatus.setState({ error });
    for (const { revision, taskId, task } of changes) {
      if (token !== localStorage.getItem(ACCESS_TOKEN_KEY)) return;
      try {
        await writeTaskEvent(token, taskId, task, revision);
      } catch (error) {
        if (token !== localStorage.getItem(ACCESS_TOKEN_KEY)) return;
        const message = String(error);
        await api.deferCalendarChange(revision, message);
        useCalendarSyncStatus.setState({ error: message });
        continue;
      }
      if (token !== localStorage.getItem(ACCESS_TOKEN_KEY)) return;
      await api.acknowledgeCalendarChange(revision);
    }
  })().catch((error) => {
    useCalendarSyncStatus.setState({ error: String(error) });
  }).finally(() => { delivery = undefined; });
  return delivery;
}

export function startCalendarDelivery() {
  if (!isTauri) return;
  const tick = () => { void deliverCalendarChanges(); };
  tick();
  const listener = listen("tasks-changed", tick).catch(() => undefined);
  const timer = window.setInterval(tick, 15000);
  return () => {
    window.clearInterval(timer);
    void listener.then((unlisten) => unlisten?.());
  };
}

async function writeTaskEvent(token: string, id: string, task: Task | null, revision: number) {
  const calendarId = await ensureTodoCalendar(token);
  const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const eventIds: Record<string, string> = JSON.parse(localStorage.getItem(eventIdsKey) ?? "{}");
  const key = JSON.stringify([calendarId, id]);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const request = (url: string, init?: RequestInit) =>
    fetch(url, { ...init, headers, signal: AbortSignal.timeout(15000) });

  let eventId = eventIds[key];
  if (!eventId) {
    const query = new URLSearchParams({ privateExtendedProperty: `todoTaskId=${id}`, maxResults: "1" });
    const matches = await request(`${eventsUrl}?${query}`);
    if (!matches.ok) throw new Error(`Could not look up the calendar event (${matches.status}).`);
    eventId = (await matches.json()).items?.[0]?.id;
  }
  const eventUrl = eventId ? `${eventsUrl}/${encodeURIComponent(eventId)}` : null;

  if (!task?.dueDate || task.completedAt) {
    if (!eventUrl) return;
    const result = await request(eventUrl, { method: "DELETE" });
    if (!result.ok && result.status !== 404 && result.status !== 410) {
      throw new Error(`Could not delete the calendar event (${result.status}).`);
    }
    delete eventIds[key];
    localStorage.setItem(eventIdsKey, JSON.stringify(eventIds));
    return;
  }

  const startDate = new Date(`${task.dueDate}T${task.dueTime ?? "00:00"}:00`);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateTime = (date: Date) => ({ dateTime: format(date, "yyyy-MM-dd'T'HH:mm:ssXXX"), timeZone });
  const eventBody = {
    summary: task.title,
    description: task.notes ?? "",
    start: task.dueTime ? dateTime(startDate) : { date: task.dueDate },
    end: task.dueTime ? dateTime(addMinutes(startDate, 30)) : { date: format(addDays(startDate, 1), "yyyy-MM-dd") },
    recurrence: [] as string[],
    extendedProperties: { private: { todoTaskId: id } },
  };

  const body = JSON.stringify(eventBody);
  if (eventUrl) {
    const result = await request(eventUrl, { method: "PATCH", body });
    if (result.ok) return;
    if (result.status !== 404 && result.status !== 410) {
      throw new Error(`Could not update the calendar event (${result.status}).`);
    }
  }

  const input = new TextEncoder().encode(JSON.stringify([id, revision]));
  const hash = await crypto.subtle.digest("SHA-256", input);
  const createId = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const result = await request(eventsUrl, { method: "POST", body: JSON.stringify({ ...eventBody, id: createId }) });
  if (result.status === 409) {
    const retry = await request(`${eventsUrl}/${createId}`, { method: "PATCH", body });
    if (!retry.ok) throw new Error(`Could not reconcile the calendar event (${retry.status}).`);
    eventIds[key] = createId;
    localStorage.setItem(eventIdsKey, JSON.stringify(eventIds));
    return;
  }
  if (!result.ok) throw new Error(`Could not create the calendar event (${result.status}).`);
  const event: { id: string } = await result.json();
  eventIds[key] = event.id;
  localStorage.setItem(eventIdsKey, JSON.stringify(eventIds));
}
