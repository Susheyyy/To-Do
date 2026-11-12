import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

import { ThemePicker } from "../../components/ThemePicker";
import { api, isTauri } from "../../lib/api";
import { useSettings } from "../../stores/settings.store";
import { SyncSettingsSection } from "./SyncSettingsSection";
import {
  disconnectGCal,
  getGCalConfig,
  initGoogleAuth,
  deliverCalendarChanges,
  useCalendarSyncStatus,
  saveGCalClientId,
} from "../../lib/googleCalendar";

export function SettingsView() {
  const clock = useSettings((s) => s.clock);
  const setClock = useSettings((s) => s.setClock);
  const dailyGoal = useSettings((s) => s.dailyGoal);
  const setDailyGoal = useSettings((s) => s.setDailyGoal);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettings((s) => s.setNotificationsEnabled);
  const quietHoursEnabled = useSettings((s) => s.quietHoursEnabled);
  const setQuietHoursEnabled = useSettings((s) => s.setQuietHoursEnabled);
  const quietHoursStart = useSettings((s) => s.quietHoursStart);
  const setQuietHoursStart = useSettings((s) => s.setQuietHoursStart);
  const quietHoursEnd = useSettings((s) => s.quietHoursEnd);
  const setQuietHoursEnd = useSettings((s) => s.setQuietHoursEnd);
  const morningBriefingEnabled = useSettings((s) => s.morningBriefingEnabled);
  const setMorningBriefingEnabled = useSettings((s) => s.setMorningBriefingEnabled);
  const morningBriefingTime = useSettings((s) => s.morningBriefingTime);
  const setMorningBriefingTime = useSettings((s) => s.setMorningBriefingTime);

  const trayClickAction = useSettings((s) => s.trayClickAction);
  const setTrayClickAction = useSettings((s) => s.setTrayClickAction);
  const [autostart, setAutostart] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const calendarError = useCalendarSyncStatus((state) => state.error);
  const [gcalConfig, setGcalConfig] = useState(getGCalConfig());
  const [gcalClientIdInput, setGcalClientIdInput] = useState(gcalConfig.clientId);
  const [gcalLoading, setGcalLoading] = useState(false);

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleConnectGCal() {
    if (!gcalClientIdInput.trim()) {
      setBackupMsg("Please provide your Google OAuth Client ID.");
      return;
    }
    try {
      setGcalLoading(true);
      saveGCalClientId(gcalClientIdInput);
      await initGoogleAuth(gcalClientIdInput);
      void deliverCalendarChanges();
      setGcalConfig(getGCalConfig());
      setBackupMsg("Google Calendar connected successfully!");
      setTimeout(() => setBackupMsg(""), 3500);
    } catch (e: any) {
      setBackupMsg(`Google Calendar authentication failed: ${e.message || e}`);
    } finally {
      setGcalLoading(false);
    }
  }

  function handleDisconnectGCal() {
    disconnectGCal();
    setGcalConfig(getGCalConfig());
    setBackupMsg("Google Calendar disconnected.");
    setTimeout(() => setBackupMsg(""), 3500);
  }

  async function handleExportJson() {
    try {
      const data = await api.exportJson();
      downloadFile(data, `todo_export_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      setBackupMsg("JSON exported successfully!");
      setTimeout(() => setBackupMsg(""), 3500);
    } catch (e) {
      setBackupMsg(`Export failed: ${e}`);
    }
  }

  async function handleExportCsv() {
    try {
      const data = await api.exportCsv();
      downloadFile(data, `todo_tasks_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
      setBackupMsg("CSV exported successfully!");
      setTimeout(() => setBackupMsg(""), 3500);
    } catch (e) {
      setBackupMsg(`Export failed: ${e}`);
    }
  }

  async function handleExportIcal() {
    try {
      const data = await api.exportIcal();
      downloadFile(data, `todo_calendar_${new Date().toISOString().slice(0, 10)}.ics`, "text/calendar");
      setBackupMsg("iCalendar (.ics) exported successfully!");
      setTimeout(() => setBackupMsg(""), 3500);
    } catch (e) {
      setBackupMsg(`Export failed: ${e}`);
    }
  }

  async function handleBackupDatabase() {
    try {
      const path = await api.createBackup();
      setBackupMsg(`Database backed up to: ${path}`);
      setTimeout(() => setBackupMsg(""), 5000);
    } catch (e) {
      setBackupMsg(`Backup failed: ${e}`);
    }
  }

  useEffect(() => {
    isEnabled().then(setAutostart).catch(() => {});
  }, []);

  async function toggleAutostart(on: boolean) {
    if (on) await enable();
    else await disable();
    setAutostart(on);
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <section className="card settings-group">
        <h2 className="group-title">Appearance</h2>
        <ThemePicker />
      </section>

      <section className="card settings-group">
        <h2 className="group-title">Daily Goal</h2>
        <div className="settings-row">
          <span className="settings-label">Target tasks completed per day</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              min={1}
              max={100}
              className="subtask-input"
              style={{ width: 70, textAlign: "center", padding: "6px 8px" }}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <span className="muted" style={{ fontSize: 13 }}>tasks</span>
          </div>
        </div>
      </section>

      <section className="card settings-group">
        <h2 className="group-title">Clock</h2>
        <div className="theme-chips">
          <button className="chip" aria-pressed={clock === "12h"} onClick={() => setClock("12h")}>
            12-hour
          </button>
          <button className="chip" aria-pressed={clock === "24h"} onClick={() => setClock("24h")}>
            24-hour
          </button>
        </div>
      </section>

      <section className="card settings-group">
        <h2 className="group-title">Notifications & Reminders</h2>
        <div className="settings-row">
          <span className="settings-label">Due task notifications</span>
          <button
            className={"toggle-switch" + (notificationsEnabled ? " on" : "")}
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">Quiet Hours / Do Not Disturb</span>
          <button
            className={"toggle-switch" + (quietHoursEnabled ? " on" : "")}
            role="switch"
            aria-checked={quietHoursEnabled}
            onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {quietHoursEnabled && (
          <div className="settings-subrow">
            <label className="settings-field">
              <span>Start</span>
              <input
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>End</span>
              <input
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="settings-row">
          <span className="settings-label">Morning briefing</span>
          <button
            className={"toggle-switch" + (morningBriefingEnabled ? " on" : "")}
            role="switch"
            aria-checked={morningBriefingEnabled}
            onClick={() => setMorningBriefingEnabled(!morningBriefingEnabled)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {morningBriefingEnabled && (
          <div className="settings-subrow">
            <label className="settings-field">
              <span>Briefing Time</span>
              <input
                type="time"
                value={morningBriefingTime}
                onChange={(e) => setMorningBriefingTime(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <section className="card settings-group">
        <h2 className="group-title">Cross-Device Sync</h2>
        <SyncSettingsSection />
      </section>

      <section className="card settings-group">
        <h2 className="group-title">System & Tray</h2>
        <div className="settings-row">
          <span className="settings-label">Start on login</span>
          <button
            className={"toggle-switch" + (autostart ? " on" : "")}
            role="switch"
            aria-checked={autostart}
            onClick={() => toggleAutostart(!autostart)}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">System Tray Left-Click Action</span>
          <select
            value={trayClickAction}
            onChange={(e) => {
              const val = e.target.value as "quick-capture" | "floating-bar" | "main";
              setTrayClickAction(val);
              void api.setTrayClickAction(val);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: "13px",
            }}
          >
            <option value="quick-capture">Quick Capture Popup (Default)</option>
            <option value="floating-bar">Quick Add Floating Bar</option>
            <option value="main">Toggle Main App Window</option>
          </select>
        </div>
      </section>

      <section className="card settings-group">
        <h2 className="group-title">Google Calendar Real-Time Sync</h2>
        {isTauri ? (
        <div className="settings-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
          <span className="settings-label">
            Connect your Google Calendar directly. Tasks created with a due date will automatically sync as events.
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", maxWidth: 500 }}>
            <input
              type="text"
              placeholder="Google OAuth Client ID (.apps.googleusercontent.com)"
              value={gcalClientIdInput}
              disabled={gcalConfig.isConnected}
              onChange={(e) => setGcalClientIdInput(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
            {gcalConfig.isConnected ? (
              <button className="chip" onClick={handleDisconnectGCal}>
                Disconnect
              </button>
            ) : (
              <button
                className="chip primary"
                disabled={gcalLoading}
                onClick={handleConnectGCal}
              >
                {gcalLoading ? "Signing in..." : "Connect Google Calendar"}
              </button>
            )}
          </div>
          {gcalConfig.isConnected && calendarError && (
            <p role="status" className="error-text">Calendar changes are queued for retry. {calendarError}</p>
          )}
          {!gcalConfig.isConnected && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary, #8f8fa0)" }}>
              Need a Client ID? See the step-by-step instructions in the project <code>README.md</code> or the Google Cloud Console.
            </p>
          )}
          {gcalConfig.isConnected && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#10b981" }}>
              ✓ Connected. Syncing tasks to dedicated "Todo Desktop" Google calendar.
            </p>
          )}
        </div>
        ) : <p className="muted">Google Calendar sync is available in the desktop app.</p>}
      </section>

      <section className="card settings-group">
        <h2 className="group-title">Backups & Data Export</h2>
        <div className="settings-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
          <span className="settings-label">Export your tasks and projects</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="chip" onClick={handleExportJson}>
              Export JSON
            </button>
            <button className="chip" onClick={handleExportCsv}>
              Export CSV
            </button>
            <button className="chip" onClick={handleExportIcal}>
              Export iCalendar (.ics)
            </button>
            <button className="chip primary" onClick={handleBackupDatabase}>
              Backup SQLite Database
            </button>
          </div>
          {backupMsg && (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-accentText)" }}>
              {backupMsg}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
