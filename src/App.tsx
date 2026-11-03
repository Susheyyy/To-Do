import "./styles/globals.css";
import { ThemeProvider } from "./app/ThemeProvider";
import { AppShell } from "./features/shell/AppShell";

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}