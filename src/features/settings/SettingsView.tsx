import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

import { ThemePicker } from "../../components/ThemePicker";
import { useSettings } from "../../stores/settings.store";

export function SettingsView() {
  const clock = useSettings((s) => s.clock);
  const setClock = useSettings((s) => s.setClock);
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

  const [autostart, setAutostart] = useState(false);

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
        <h2 className="group-title">System</h2>
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
      </section>
    </div>
  );
}
