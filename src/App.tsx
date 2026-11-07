import "./styles/globals.css";
import { ThemeProvider } from "./app/ThemeProvider";
import { getWindowType } from "./app/windows";
import { FloatingBarWindow } from "./features/quick-capture/FloatingBarWindow";
import { QuickCaptureWindow } from "./features/quick-capture/QuickCaptureWindow";
import { AppShell } from "./features/shell/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const winType = getWindowType();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {winType === "floating-bar" ? (
          <FloatingBarWindow />
        ) : winType === "quick-capture" ? (
          <QuickCaptureWindow />
        ) : (
          <AppShell />
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}
