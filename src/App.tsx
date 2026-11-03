import "./styles/globals.css";
import { ThemeProvider } from "./app/ThemeProvider";
import { getWindowType } from "./app/windows";
import { FloatingBarWindow } from "./features/quick-capture/FloatingBarWindow";
import { QuickCaptureWindow } from "./features/quick-capture/QuickCaptureWindow";
import { AppShell } from "./features/shell/AppShell";

export default function App() {
  const winType = getWindowType();

  if (winType === "floating-bar") {
    return (
      <ThemeProvider>
        <FloatingBarWindow />
      </ThemeProvider>
    );
  }

  if (winType === "quick-capture") {
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
