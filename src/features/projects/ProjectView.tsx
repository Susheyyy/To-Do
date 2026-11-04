import { FormEvent, useEffect, useState } from "react";

import { useTheme } from "../../app/ThemeProvider";
import { AddInline } from "../../components/AddInline";
import { Board } from "../../components/Board";
import { DisplayMenu } from "../../components/DisplayMenu";
import { Group } from "../../components/Group";
import { Icon } from "../../components/Icon";
import { Progress } from "../../components/Progress";
import { QuickAdd } from "../../components/QuickAdd";
import { api } from "../../lib/api";
import { PROJECT_SLOTS, projectColor } from "../../lib/projectColors";
import { sortTasks } from "../../lib/sortTasks";
import { useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";
import type { Project, Task } from "../../types/models";
import { TaskRow } from "../today/TaskRow";
import { useConfirm } from "../../stores/confirm.store";

export function ProjectView({ projectId }: { projectId: string }) {
  const { theme } = useTheme();
  const project = useTasks((s) => s.projects.find((p) => p.id === projectId));
  const version = useTasks((s) => s.version);
  const createSection = useTasks((s) => s.createSection);
  const renameSection = useTasks((s) => s.renameSection);
  const deleteSection = useTasks((s) => s.deleteSection);
  const layout = useUi((s) => s.layout);
  const showCompleted = useUi((s) => s.showCompleted);
  const sort = useUi((s) => s.sort);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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
  const doneTasks = tasks.filter((t) => t.completedAt !== null);

  const groups = [
    ...(openTasks.some((t) => !t.sectionId)
      ? [
          {
            key: "none",
            sectionId: null as string | null,
            title: "",
            tasks: sortTasks(openTasks.filter((t) => !t.sectionId), sort),
          },
        ]
      : []),
    ...project.sections.map((s) => ({
      key: s.id,
      sectionId: s.id as string | null,
      title: s.name,
      tasks: sortTasks(openTasks.filter((t) => t.sectionId === s.id), sort),
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
            <span className="project-dot big" style={{ background: projectColor(theme.id, project.color) }} />
            {project.name}
          </h1>
          <div className="header-tools">
            <DisplayMenu count={openTasks.length} />
            <ProjectMenu key={project.id} project={project} />
          </div>
        </div>
        <p className="page-sub">
          {openTasks.length} pending · {doneTasks.length} done
        </p>
        <Progress done={doneTasks.length} total={tasks.length} />
      </header>

      {layout === "board" ? (
        <div style={{ marginTop: 16 }}>
          <QuickAdd defaultDue={null} defaultProjectId={projectId} placeholder={`Add a task to ${project.name}`} />
          <Board
            columns={groups.map((g) => ({
              key: g.key,
              title: g.title,
              tasks: g.tasks,
              projectId,
              sectionId: g.sectionId,
            }))}
            extraColumn={
              <div className="board-col board-add-section-col">
                <form className="section-add-board" onSubmit={submitSection}>
                  <input
                    className="subtask-input"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    placeholder="+ Add section"
                    aria-label="New section"
                  />
                </form>
              </div>
            }
          />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {groups.length === 0 && (
            <section className="group">
              <AddInline due={null} projectId={projectId} sectionId={null} />
            </section>
          )}
          {groups.map((g) => (
            <section key={g.key} className="group">
              {g.title ? (
                <SectionTitle
                  title={g.title}
                  count={g.tasks.length}
                  collapsed={!!collapsed[g.key]}
                  onToggle={() => toggle(g.key)}
                  onRename={g.sectionId ? (name) => void renameSection(g.sectionId!, name) : undefined}
                  onDelete={
                    g.sectionId
                      ? () => {
                          void useConfirm
                            .getState()
                            .ask(`Delete section "${g.title}"? Its tasks move to the top.`)
                            .then((ok) => {
                              if (ok) void deleteSection(g.sectionId!);
                            });
                        }
                      : undefined
                  }
                />
              ) : null}
              {!collapsed[g.key] && (
                <>
                  <div className="task-list">
                    {g.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                  <AddInline due={null} projectId={projectId} sectionId={g.sectionId} />
                </>
              )}
            </section>
          ))}

          {showCompleted && doneTasks.length > 0 && <Group title="Completed" tasks={doneTasks} />}
        </div>
      )}

      {layout !== "board" && (
        <form className="section-add" onSubmit={submitSection}>
          <input
            className="subtask-input"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="Add section"
            aria-label="New section"
          />
        </form>
      )}
    </div>
  );
}

function SectionTitle({
  title,
  count,
  collapsed,
  onToggle,
  onRename,
  onDelete,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title && onRename) onRename(next);
    else setDraft(title);
  }

  return (
    <div className="group-header">
      <div className="group-head" onClick={onToggle} role="button" aria-expanded={!collapsed}>
        <span className={collapsed ? "chevron" : "chevron open"}>
          <Icon name="chevron" size={14} />
        </span>
        {editing ? (
          <input
            className="title-input"
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              if (!onRename) return;
              e.stopPropagation();
              setDraft(title);
              setEditing(true);
            }}
          >
            {title}
          </span>
        )}
        <span className="count-inline">{count}</span>
      </div>
      {onDelete && (
        <button className="icon-btn" onClick={onDelete} aria-label="Delete section">
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}

function ProjectMenu({ project }: { project: Project }) {
  const { theme } = useTheme();
  const updateProject = useTasks((s) => s.updateProject);
  const deleteProject = useTasks((s) => s.deleteProject);
  const setView = useUi((s) => s.setView);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);

  const swatches = Array.from({ length: PROJECT_SLOTS }, (_, i) => String(i));
  const currentSlot = project.color ?? "0";

  function saveName() {
    const next = name.trim();
    if (next && next !== project.name) void updateProject(project.id, next, project.color);
    else setName(project.name);
  }

    function remove() {
    void useConfirm
      .getState()
      .ask(`Delete "${project.name}"?`)
      .then((ok) => {
        if (!ok) return;
        void deleteProject(project.id);
        setView("today");
      });
  }

  return (
    <div className="popover-anchor">
      <button className="icon-btn" aria-label="Project menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div className="popover project-popover">
          <input
            className="popover-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Project name"
          />
          <div className="swatches">
            {swatches.map((slot) => (
              <button
                key={slot}
                className={`swatch ${currentSlot === slot ? "selected" : ""}`}
                style={{ background: projectColor(theme.id, slot) }}
                aria-label={`Colour ${Number(slot) + 1}`}
                onClick={() => void updateProject(project.id, project.name, slot)}
              />
            ))}
          </div>
          <button className="popover-item danger" onClick={remove}>
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}