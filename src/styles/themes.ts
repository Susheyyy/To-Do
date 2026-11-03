export type ThemeId =
  | "kawaii"
  | "cat"
  | "bunny"
  | "night"
  | "office"
  | "forest"
  | "ocean"
  | "retro"
  | "mono";

export type MascotId = "blob" | "cat" | "bunny" | "moon" | "none" | "owl" | "fish" | "console" | "dot";

export interface Theme {
  id: ThemeId;
  name: string;
  font: string;
  mascot: MascotId;
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
  };
  copy: {
    greeting: string;
    allDone: string;
    empty: string;
  };
}

export const themes: Record<ThemeId, Theme> = {
  kawaii: {
    id: "kawaii",
    name: "Kawaii",
    font: "'Fredoka', system-ui, sans-serif",
    mascot: "blob",
    colors: {
      bg: "#fdf4f8",
      surface: "#ffffff",
      text: "#5b4a5f",
      muted: "#a895ad",
      accent: "#f4a6c8",
      accentText: "#5b4a5f",
      border: "#f1dfe9",
    },
    copy: {
      greeting: "Good morning, sunshine",
      allDone: "You did so well today",
      empty: "Your list is wonderfully empty",
    },
  },
  cat: {
    id: "cat",
    name: "Cat",
    font: "'Sniglet', cursive, system-ui",
    mascot: "cat",
    colors: {
      bg: "#fff3e6",
      surface: "#fffaf3",
      text: "#5a3e2b",
      muted: "#b0937c",
      accent: "#f9a875",
      accentText: "#3b2516",
      border: "#f3dcc4",
    },
    copy: {
      greeting: "What shall we knock off first?",
      allDone: "Purr-fect. Time for a nap",
      empty: "Nothing to chase yet",
    },
  },
  bunny: {
    id: "bunny",
    name: "Bunny",
    font: "'Mochiy Pop One', system-ui, sans-serif",
    mascot: "bunny",
    colors: {
      bg: "#eefaf4",
      surface: "#ffffff",
      text: "#2f4f44",
      muted: "#7fa597",
      accent: "#ffb3c7",
      accentText: "#2f4f44",
      border: "#d6eee3",
    },
    copy: {
      greeting: "Ready to hop?",
      allDone: "Carrots well earned",
      empty: "A quiet meadow, all yours",
    },
  },
  night: {
    id: "night",
    name: "Night",
    font: "'Zen Maru Gothic', system-ui, sans-serif",
    mascot: "moon",
    colors: {
      bg: "#1a1733",
      surface: "#241f45",
      text: "#e9e4ff",
      muted: "#9b93c9",
      accent: "#b59cff",
      accentText: "#1a1733",
      border: "#342d5e",
    },
    copy: {
      greeting: "Take it slow tonight",
      allDone: "Rest now, you earned it",
      empty: "Nothing pressing",
    },
  },
  office: {
    id: "office",
    name: "Office",
    font: "'DM Sans', system-ui, sans-serif",
    mascot: "none",
    colors: {
      bg: "#f4f5f7",
      surface: "#ffffff",
      text: "#1f2328",
      muted: "#6b7280",
      accent: "#2563eb",
      accentText: "#ffffff",
      border: "#e2e5ea",
    },
    copy: {
      greeting: "Good morning",
      allDone: "All tasks complete",
      empty: "No open items",
    },
  },
  forest: {
    id: "forest",
    name: "Forest",
    font: "'Sofadi One', system-ui, sans-serif",
    mascot: "owl",
    colors: {
      bg: "#eef3ea",
      surface: "#f8fbf5",
      text: "#33402c",
      muted: "#7b8b70",
      accent: "#6b8f4e",
      accentText: "#ffffff",
      border: "#d7e2cd",
    },
    copy: {
      greeting: "Welcome back to the grove",
      allDone: "The grove is at peace",
      empty: "Nothing fallen today",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    font: "'Original Surfer', system-ui, sans-serif",
    mascot: "fish",
    colors: {
      bg: "#e9f6fb",
      surface: "#ffffff",
      text: "#1d4256",
      muted: "#6e9fb3",
      accent: "#3fa7d6",
      accentText: "#ffffff",
      border: "#cfe8f3",
    },
    copy: {
      greeting: "Smooth sailing ahead",
      allDone: "Land ho, all tasks done",
      empty: "Calm waters",
    },
  },
  retro: {
    id: "retro",
    name: "Retro",
    font: "'Silkscreen', monospace",
    mascot: "console",
    colors: {
      bg: "#f6efd9",
      surface: "#fbf6e6",
      text: "#1e3b3a",
      muted: "#5f7f7d",
      accent: "#ff8c42",
      accentText: "#1e3b3a",
      border: "#1e3b3a",
    },
    copy: {
      greeting: "PLAYER 1 READY",
      allDone: "LEVEL COMPLETE",
      empty: "NO QUESTS ACTIVE",
    },
  },
  mono: {
    id: "mono",
    name: "Mono",
    font: "'JetBrains Mono', monospace",
    mascot: "dot",
    colors: {
      bg: "#0d0d0d",
      surface: "#161616",
      text: "#f2f2f2",
      muted: "#8a8a8a",
      accent: "#ffffff",
      accentText: "#0d0d0d",
      border: "#2a2a2a",
    },
    copy: {
      greeting: "Focus",
      allDone: "Done",
      empty: "Nothing pending",
    },
  },
};

export const themeOrder: ThemeId[] = [
  "kawaii",
  "cat",
  "bunny",
  "night",
  "office",
  "forest",
  "ocean",
  "retro",
  "mono",
];

export const defaultThemeId: ThemeId = "kawaii";