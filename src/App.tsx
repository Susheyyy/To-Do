import "./styles/globals.css";
import { ThemeProvider } from "./app/ThemeProvider";
import { isQuickCaptureWindow } from "./app/windows";
import { QuickCaptureWindow } from "./features/quick-capture/QuickCaptureWindow";
import { AppShell } from "./features/shell/AppShell";

export default function App() {
  if (isQuickCaptureWindow()) {
    return (
      <ThemeProvider>
        <QuickCaptureWindow />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
