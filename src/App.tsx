import "./styles/globals.css";
import { ThemeProvider, useTheme } from "./app/ThemeProvider";
import { themeOrder, themes } from "./styles/themes";
import { Mascot } from "./components/Mascot";
import { Icon } from "./components/Icon";

function Preview() {
  const { theme, setThemeId, motion, setMotion } = useTheme();

  return (
    <div className="app">
      <header style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Mascot size={56} />
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{theme.copy.greeting}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>{theme.copy.empty}</p>
        </div>
      </header>

      <div className="card" style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="check" />
        <span>{theme.copy.allDone}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
        {themeOrder.map((id) => (
          <button key={id} onClick={() => setThemeId(id)} aria-pressed={theme.id === id}>
            {themes[id].name}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
        <input
          type="checkbox"
          checked={motion}
          onChange={(e) => setMotion(e.target.checked)}
        />
        Motion
      </label>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Preview />
    </ThemeProvider>
  );
}