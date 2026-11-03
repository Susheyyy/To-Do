import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { priorityColor } from "../lib/projectColors";
import { defaultThemeId, Theme, ThemeId, themes } from "../styles/themes";

interface ThemeContextValue {
    theme: Theme;
    setThemeId: (id: ThemeId) => void;
    motion: boolean;
    setMotion: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = "todo.themeId";
const MOTION_KEY = "todo.motion";

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeId, setThemeId] = useState<ThemeId>(() => {
        const saved = localStorage.getItem(THEME_KEY) as ThemeId | null;
        return saved && saved in themes ? saved : defaultThemeId;
    });
    const [motion, setMotion] = useState<boolean>(
        () => localStorage.getItem(MOTION_KEY) !== "off"
    );

    const theme = themes[themeId];

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--color-bg", theme.colors.bg);
        root.style.setProperty("--color-surface", theme.colors.surface);
        root.style.setProperty("--color-text", theme.colors.text);
        root.style.setProperty("--color-muted", theme.colors.muted);
        root.style.setProperty("--color-accent", theme.colors.accent);
        root.style.setProperty("--color-accentText", theme.colors.accentText);
        root.style.setProperty("--color-border", theme.colors.border);
        root.style.setProperty("--color-p1", priorityColor(theme.id, "high"));
        root.style.setProperty("--color-p2", priorityColor(theme.id, "medium"));
        root.style.setProperty("--color-p3", priorityColor(theme.id, "low"));
        root.style.setProperty("--color-p4", priorityColor(theme.id, "none"));
        root.style.setProperty("--font-body", theme.font);
        document.body.dataset.theme = theme.id;
        localStorage.setItem(THEME_KEY, theme.id);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem(MOTION_KEY, motion ? "on" : "off");
    }, [motion]);

    return (
        <ThemeContext.Provider value={{ theme, setThemeId, motion, setMotion }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
    return ctx;
}