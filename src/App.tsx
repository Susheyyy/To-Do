import { useEffect } from "react";
import { startCalendarDelivery } from "./lib/googleCalendar";
import { startRelaySync } from "./lib/relaySync";
import "./styles/globals.css";
import { ThemeProvider } from "./app/ThemeProvider";
import { getWindowType } from "./app/windows";
import { FloatingBarWindow } from "./features/quick-capture/FloatingBarWindow";
import { QuickCaptureWindow } from "./features/quick-capture/QuickCaptureWindow";
import { AppShell } from "./features/shell/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const winType = getWindowType();
  useEffect(() => {
    if (winType !== "main") return;
    const stopRelay = startRelaySync();
    const stopCalendar = startCalendarDelivery();
    return () => {
      stopRelay?.();
      stopCalendar?.();
    };
  }, [winType]);

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
