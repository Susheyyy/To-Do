import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

import { ThemePicker } from "../../components/ThemePicker";
import { useSettings } from "../../stores/settings.store";

export function SettingsView() {
  const clock = useSettings((s) => s.clock);
  const setClock = useSettings((s) => s.setClock);
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
