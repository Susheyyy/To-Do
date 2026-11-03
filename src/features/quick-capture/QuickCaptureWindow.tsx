import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { QuickAdd } from "../../components/QuickAdd";

export function QuickCaptureWindow() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) void getCurrentWindow().hide();
      })
      .then((unlisten) => {
        cleanup = unlisten;
      });
    return () => {
      cleanup?.();
    };
  }, []);

  async function handleDone() {
    await getCurrentWindow().hide();
  }

  return (
    <div className="quick-capture-window">
      <QuickAdd defaultDue={null} defaultProjectId={null} autoFocus onDone={handleDone} />
    </div>
  );
}

