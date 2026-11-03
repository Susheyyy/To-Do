import { useTheme } from "../app/ThemeProvider";
import { themeOrder, themes } from "../styles/themes";

export function ThemePicker() {
  const { theme, setThemeId, motion, setMotion } = useTheme();

  return (
    <div className="theme-picker">
      <div className="theme-chips">
        {themeOrder.map((id) => (
          <button
            key={id}
            className="chip"
            aria-pressed={theme.id === id}
            onClick={() => setThemeId(id)}
          >
            {themes[id].name}
          </button>
        ))}
      </div>
      <label className="motion-toggle muted">
        <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} />
        Motion
      </label>
    </div>
  );
}