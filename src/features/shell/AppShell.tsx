import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { addDays, startOfDay } from "date-fns";

import { ConfirmHost } from "../../components/ConfirmHost";
import { QuickAdd } from "../../components/QuickAdd";
import { Sidebar } from "../../components/Sidebar";
import { api, isTauri } from "../../lib/api";
import { NotificationManager } from "../../lib/notifications";
import { todayIso, useTasks } from "../../stores/tasks.store";
import { ListId, useUi, ViewId } from "../../stores/ui.store";
import { TaskDetail } from "../detail/TaskDetail";
import { FiltersView } from "../filters/FiltersView";
import { SearchModal } from "../filters/SearchView";
import { ListView } from "../lists/ListView";
import { ProjectView } from "../projects/ProjectView";
import { SettingsView } from "../settings/SettingsView";
import { HabitsView } from "../habits/HabitsView";
import { CalendarView } from "../calendar/CalendarView";
import { MascotCelebration } from "../../components/MascotCelebration";

function renderView(view: ViewId) {
  if (view === "settings") return <SettingsView />;
  if (view === "filters") return <FiltersView />;
  if (view === "habits") return <HabitsView />;
  if (view === "calendar") return <CalendarView />;
  if (view.startsWith("project:")) return <ProjectView projectId={view.slice("project:".length)} />;
  return <ListView key={view} id={view as ListId} />;
}

export function AppShell() {
  const view = useUi((s) => s.view);
  const quickAddOpen = useUi((s) => s.quickAddOpen);
  const closeQuickAdd = useUi((s) => s.closeQuickAdd);
  const undo = useTasks((s) => s.undo);
  const redo = useTasks((s) => s.redo);
  const overdueCount = useTasks((s) => s.overdue.length);

  useEffect(() => {
    let active = true;
    let refreshedDay: string | undefined;
    let midnight: number;
    const refresh = () => {
      if (!active) return;
      const day = todayIso();
      if (refreshedDay !== day) {
        refreshedDay = day;
        void useTasks.getState().load().catch((error) => {
          if (!active) return;
          if (refreshedDay === day) refreshedDay = undefined;
          useTasks.setState({ error: String(error) });
        });
      }
      window.clearTimeout(midnight);
      const now = new Date();
      const nextMidnight = startOfDay(addDays(now, 1)).getTime();
      midnight = window.setTimeout(refresh, nextMidnight - now.getTime());
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const nativeFocus = isTauri
      ? getCurrentWindow().onFocusChanged(({ payload }) => {
          if (payload) refresh();
        }).catch(() => undefined)
      : undefined;

    return () => {
      active = false;
      window.clearTimeout(midnight);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      void nativeFocus?.then((unlisten) => unlisten?.());
    };
  }, []);

  useEffect(() => {
    void api.updateTrayBadge(overdueCount);
  }, [overdueCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const ui = useUi.getState();
        if (ui.searchOpen) ui.closeSearch();
        else if (ui.quickAddOpen) ui.closeQuickAdd();
        else if (ui.selectedTaskId) ui.closeTask();
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          void undo();
          return;
        } else if (key === "y" || (key === "z" && e.shiftKey)) {
          e.preventDefault();
          void redo();
          return;
        }
      }

      
      const tasksState = useTasks.getState();
      const uiState = useUi.getState();
      const activeList = tasksState.open;
      if (activeList.length === 0) return;

      const currentIdx = uiState.selectedTaskId
        ? activeList.findIndex((t) => t.id === uiState.selectedTaskId)
        : -1;

      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        const nextIdx = currentIdx < activeList.length - 1 ? currentIdx + 1 : 0;
        uiState.openTask(activeList[nextIdx].id);
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : activeList.length - 1;
        uiState.openTask(activeList[prevIdx].id);
      } else if (e.key === " " || e.key.toLowerCase() === "e") {
        if (uiState.selectedTaskId) {
          e.preventDefault();
          const cur = activeList.find((t) => t.id === uiState.selectedTaskId);
          if (cur) void tasksState.toggleTask(cur);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (uiState.selectedTaskId) {
          e.preventDefault();
          const toDelete = uiState.selectedTaskId;
          uiState.closeTask();
          void tasksState.deleteTask(toDelete);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="shell">
      <NotificationManager />
      <Sidebar />
      <main className="main">{renderView(view)}</main>
      <TaskDetail />
      <ConfirmHost />
      <SearchModal />
      <MascotCelebration />

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