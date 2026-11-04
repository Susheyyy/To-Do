import { FormEvent, useEffect, useRef, useState } from "react";

import { useTheme } from "../app/ThemeProvider";
import { projectColor } from "../lib/projectColors";
import { useSettings } from "../stores/settings.store";
import { useTasks } from "../stores/tasks.store";
import { ListId, useUi } from "../stores/ui.store";
import { Icon } from "./Icon";
import { Mascot } from "./Mascot";

const NAV: { id: ListId | "search"; label: string; icon: "search" | "inbox" | "sun" | "upcoming" | "filter" | "calendar" | "habit" }[] = [
  { id: "search", label: "Search", icon: "search" },
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "today", label: "Today", icon: "sun" },
  { id: "upcoming", label: "Upcoming", icon: "upcoming" },
  { id: "filters", label: "Filters & Labels", icon: "filter" },
  { id: "habits", label: "Habits", icon: "habit" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
];

export function Sidebar() {
  const { theme } = useTheme();
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const openQuickAdd = useUi((s) => s.openQuickAdd);
  const openSearch = useUi((s) => s.openSearch);
  const open = useTasks((s) => s.open);
  const today = useTasks((s) => s.today);
  const overdue = useTasks((s) => s.overdue);
  const projects = useTasks((s) => s.projects);
  const createProject = useTasks((s) => s.createProject);

  const completedToday = useTasks((s) => s.completedToday);
  const dailyGoal = useSettings((s) => s.dailyGoal);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileOpen]);

  const counts: Record<string, number> = {
    search: 0,
    inbox: open.filter((t) => !t.dueDate && !t.projectId).length,
    today: overdue.length + today.length,
    upcoming: open.filter((t) => t.dueDate !== null).length,
    filters: 0,
  };

  async function submitProject(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await createProject(trimmed);
    setName("");
    setAdding(false);
    setView(`project:${id}`);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div
          ref={profileRef}
          className="user-profile popover-anchor"
          style={{ position: "relative" }}
          onClick={() => setProfileOpen((o) => !o)}
          title="View daily goal progress"
        >
          <div className="avatar-circle">
            <Mascot size={22} />
          </div>
          <span className="user-name">Sushmita</span>
          <span className="user-chevron">
            <Icon name="chevron" size={12} />
          </span>

          {profileOpen && (
            <div
              className="user-profile-popup card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-popup-header">
                <span className="profile-popup-title">Daily Progress</span>
                <span className="profile-popup-badge">
                  {completedToday.length}/{dailyGoal} completed
                </span>
              </div>
              <div className="profile-popup-progress-track">
                <div
                  className="profile-popup-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.round((completedToday.length / dailyGoal) * 100))}%`,
                  }}
                />
              </div>
              <div className="profile-popup-sub">
                {completedToday.length >= dailyGoal
                  ? "🎉 Daily target reached! Great job!"
                  : `${dailyGoal - completedToday.length} more task${dailyGoal - completedToday.length === 1 ? "" : "s"} to reach today's goal.`}
              </div>
              <button
                className="profile-popup-settings-btn"
                onClick={() => {
                  setProfileOpen(false);
                  setView("settings");
                }}
              >
                Change goal in Settings
              </button>
            </div>
          )}
        </div>
      </div>

      <button className="add-task-btn" onClick={openQuickAdd}>
        <span className="add-task-icon">
          <Icon name="plus" size={14} />
        </span>
        <span>Add task</span>
      </button>

      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? "active" : ""}`}
            onClick={() => {
              if (item.id === "search") {
                openSearch();
              } else {
                setView(item.id);
              }
            }}
          >
            <Icon name={item.icon} size={17} />
            <span className="nav-label">{item.label}</span>
            {counts[item.id] > 0 && <span className="nav-count">{counts[item.id]}</span>}
          </button>
        ))}
      </nav>

      <div className="projects-section">
        <div className="projects-head">
          <span className="sidebar-label">My Projects</span>
          <button className="icon-btn small add-project-btn" aria-label="Add project" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} />
          </button>
        </div>

        {adding && (
          <form className="add-project-form" onSubmit={submitProject}>
            <input
              className="add-project-input"
              autoFocus
              value={name}
              placeholder="Project name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!name.trim()) setAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setName("");
                  setAdding(false);
                }
              }}
              aria-label="Project name"
            />
          </form>
        )}

        <nav className="nav">
          {projects.map((p) => {
            const key = `project:${p.id}` as const;
            const pending = open.filter((t) => t.projectId === p.id).length;
            return (
              <button key={p.id} className={`nav-item ${view === key ? "active" : ""}`} onClick={() => setView(key)}>
                <span className="project-hash" style={{ color: projectColor(theme.id, p.color) }}>
                  #
                </span>
                <span className="nav-label">{p.name}</span>
                {pending > 0 && <span className="nav-count">{pending}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-foot">
        <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
          <Icon name="gear" size={17} />
          <span className="nav-label">Settings</span>
        </button>
      </div>
    </aside>
  );
}