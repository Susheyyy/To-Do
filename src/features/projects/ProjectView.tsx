import { FormEvent, useEffect, useState } from "react";

import { useTheme } from "../../app/ThemeProvider";
import { Board, LayoutSwitch } from "../../components/Board";
import { Icon } from "../../components/Icon";
import { Progress } from "../../components/Progress";
import { QuickAdd } from "../../components/QuickAdd";
import { api } from "../../lib/api";
import { projectColor } from "../../lib/projectColors";
import { useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";
import type { Task } from "../../types/models";
import { TaskRow } from "../today/TaskRow";

export function ProjectView({ projectId }: { projectId: string }) {
  const { theme } = useTheme();
  const project = useTasks((s) => s.projects.find((p) => p.id === projectId));
  const version = useTasks((s) => s.version);
  const createSection = useTasks((s) => s.createSection);
  const layout = useUi((s) => s.layout);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");

  useEffect(() => {
    let active = true;
    api.listTasksForProject(projectId).then((rows) => {
      if (active) setTasks(rows);
    });
    return () => {
      active = false;
    };
  }, [projectId, version]);

  if (!project) {
    return (
      <div className="page">
        <p className="muted">Project not found.</p>
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.completedAt === null);
  const doneCount = tasks.length - openTasks.length;

  const groups = [
    {
      key: "none",
      sectionId: null as string | null,
      title: "Tasks",
      tasks: openTasks.filter((t) => !t.sectionId),
    },
    ...project.sections.map((s) => ({
      key: s.id,
      sectionId: s.id as string | null,
      title: s.name,
      tasks: openTasks.filter((t) => t.sectionId === s.id),
    })),
  ];

  function toggle(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  function submitSection(e: FormEvent) {
    e.preventDefault();
    const name = sectionName.trim();
    if (!name) return;
    void createSection(projectId, name);
    setSectionName("");
  }

  return (
    <div className={`page ${layout === "board" ? "wide" : ""}`}>
      <header className="page-header">
        <div className="page-title-row">
          <h1 className="project-title">
            <span
              className="project-dot big"
              style={{ background: projectColor(theme.id, project.color) }}
            />
            {project.name}
          </h1>
          <LayoutSwitch />
        </div>
        <p className="page-sub">
          {openTasks.length} pending · {doneCount} done
        </p>
        <Progress done={doneCount} total={tasks.length} />
      </header>

      {layout === "board" && (
        <div style={{ marginTop: 16 }}>
          <QuickAdd defaultDue={null} defaultProjectId={projectId} placeholder={`Add a task to ${project.name}`} />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {layout === "board" ? (
          <Board columns={groups.map((g) => ({ key: g.key, title: g.title, tasks: g.tasks }))} />
        ) : (
          groups.map((g) => (
            <section key={g.key}>
              <button className="group-head" onClick={() => toggle(g.key)} aria-expanded={!collapsed[g.key]}>
                <span className={collapsed[g.key] ? "chevron" : "chevron open"}>
                  <Icon name="chevron" size={14} />
                </span>
                <span>{g.title}</span>
                <span className="count-inline">{g.tasks.length}</span>
              </button>

              {!collapsed[g.key] && (
                <>
                  <div className="task-list">
                    {g.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                  {addingIn === g.key ? (
                    <QuickAdd
                      defaultDue={null}
                      defaultProjectId={projectId}
                      sectionId={g.sectionId}
                      autoFocus
                      onDone={() => setAddingIn(null)}
                    />
                  ) : (
                    <button className="add-link" onClick={() => setAddingIn(g.key)}>
                      <Icon name="plus" size={16} />
                      <span>Add task</span>
                    </button>
                  )}
                </>
              )}
            </section>
          ))
        )}
      </div>

      <form className="section-add" onSubmit={submitSection}>
        <input
          className="subtask-input"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="Add section"
          aria-label="New section"
        />
      </form>
    </div>
  );
}