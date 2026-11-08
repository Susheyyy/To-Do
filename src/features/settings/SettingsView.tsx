import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

import { ThemePicker } from "../../components/ThemePicker";
import { api } from "../../lib/api";
import { useSettings } from "../../stores/settings.store";
import { SyncSettingsSection } from "./SyncSettingsSection";

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

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
              background: "var(--color-bg-secondary, #1a1a20)",
              border: "1px solid var(--color-border, #2d2d38)",
              color: "var(--color-text-primary, #ffffff)",
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
