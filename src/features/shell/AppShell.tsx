import { useEffect } from "react";

import { ConfirmHost } from "../../components/ConfirmHost";
import { QuickAdd } from "../../components/QuickAdd";
import { Sidebar } from "../../components/Sidebar";
import { useTasks } from "../../stores/tasks.store";
import { ListId, useUi, ViewId } from "../../stores/ui.store";
import { TaskDetail } from "../detail/TaskDetail";
import { ListView } from "../lists/ListView";
import { ProjectView } from "../projects/ProjectView";
import { SettingsView } from "../settings/SettingsView";

function renderView(view: ViewId) {
  if (view === "settings") return <SettingsView />;
  if (view.startsWith("project:")) return <ProjectView projectId={view.slice("project:".length)} />;
  return <ListView id={view as ListId} />;
}

export function AppShell() {
  const view = useUi((s) => s.view);
  const quickAddOpen = useUi((s) => s.quickAddOpen);
  const closeQuickAdd = useUi((s) => s.closeQuickAdd);
  const undo = useTasks((s) => s.undo);
  const redo = useTasks((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const ui = useUi.getState();
        if (ui.quickAddOpen) ui.closeQuickAdd();
        else if (ui.selectedTaskId) ui.closeTask();
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        void redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">{renderView(view)}</main>
      <TaskDetail />
      <ConfirmHost />

      {quickAddOpen && (
        <div className="modal-backdrop" onMouseDown={closeQuickAdd}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <QuickAdd defaultDue={null} defaultProjectId={null} autoFocus onDone={closeQuickAdd} />
          </div>
        </div>
      )}
    </div>
  );
}