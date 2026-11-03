import { useTheme } from "../app/ThemeProvider";
import { projectColor } from "../lib/projectColors";
import { todayIso, useTasks } from "../stores/tasks.store";
import { ListId, useUi, ViewId } from "../stores/ui.store";
import { Icon, IconName } from "./Icon";
import { Mascot } from "./Mascot";

const LISTS: { id: ListId; label: string; icon: IconName }[] = [
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "today", label: "Today", icon: "sun" },
  { id: "upcoming", label: "Upcoming", icon: "upcoming" },
];

export function Sidebar() {
  const { theme } = useTheme();
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const openQuickAdd = useUi((s) => s.openQuickAdd);
  const open = useTasks((s) => s.open);
  const today = useTasks((s) => s.today);
  const overdue = useTasks((s) => s.overdue);
  const projects = useTasks((s) => s.projects);

  const counts: Record<ListId, number> = {
    inbox: open.filter((t) => !t.dueDate).length,
    today: today.length + overdue.length,
    upcoming: open.filter((t) => t.dueDate !== null && t.dueDate > todayIso()).length,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Mascot size={30} />
        <span>To-Do</span>
      </div>

      <button className="add-task-btn" onClick={openQuickAdd}>
        <Icon name="plus" size={18} />
        <span>Add task</span>
      </button>

      <nav>
        {LISTS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? "active" : ""}`}
            aria-current={view === item.id}
            onClick={() => setView(item.id)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {counts[item.id] > 0 && <span className="count">{counts[item.id]}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-section-title">My Projects</div>
      <nav>
        {projects.map((p) => {
          const key: ViewId = `project:${p.id}`;
          const count = open.filter((t) => t.projectId === p.id).length;
          return (
            <button
              key={p.id}
              className={`nav-item ${view === key ? "active" : ""}`}
              aria-current={view === key}
              onClick={() => setView(key)}
            >
              <span className="project-dot" style={{ background: projectColor(theme.id, p.color) }} />
              <span>{p.name}</span>
              {count > 0 && <span className="count">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <button
          className={`nav-item ${view === "settings" ? "active" : ""}`}
          aria-current={view === "settings"}
          onClick={() => setView("settings")}
        >
          <Icon name="gear" size={18} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}