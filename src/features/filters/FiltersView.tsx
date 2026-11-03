import { useState } from "react";

import { AddInline } from "../../components/AddInline";
import { DisplayMenu } from "../../components/DisplayMenu";
import { Group } from "../../components/Group";
import { Icon } from "../../components/Icon";
import { tagColor } from "../../lib/projectColors";
import { sortTasks } from "../../lib/sortTasks";
import { useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";

export function FiltersView() {
  const open = useTasks((s) => s.open);
  const sort = useUi((s) => s.sort);
  const setView = useUi((s) => s.setView);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [addingLabel, setAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [customLabels, setCustomLabels] = useState<string[]>([]);

  const allTags = Array.from(new Set([...open.flatMap((t) => t.tags), ...customLabels])).sort();

  function submitLabel(e: React.FormEvent) {
    e.preventDefault();
    const clean = newLabelName.trim().replace(/^@/, "").toLowerCase();
    if (!clean) return;
    if (!allTags.includes(clean)) {
      setCustomLabels((prev) => [...prev, clean]);
    }
    setSelectedTag(clean);
    setNewLabelName("");
    setAddingLabel(false);
  }

  const priorities = [
    { key: "high" as const, title: "Priority 1", count: open.filter((t) => t.priority === "high").length },
    { key: "medium" as const, title: "Priority 2", count: open.filter((t) => t.priority === "medium").length },
    { key: "low" as const, title: "Priority 3", count: open.filter((t) => t.priority === "low").length },
    { key: "none" as const, title: "Priority 4", count: open.filter((t) => t.priority === "none").length },
  ];

  const displayedTasks = selectedTag
    ? sortTasks(open.filter((t) => t.tags.includes(selectedTag)), sort)
    : [];

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-title-row">
          <h1>Filters &amp; Labels</h1>
          <div className="header-tools">
            <DisplayMenu showCompletedToggle={false} />
          </div>
        </div>
      </header>

      <section className="filter-section">
        <h2 className="section-title">Priorities</h2>
        <div className="filter-grid">
          {priorities.map((p) => (
            <button
              key={p.key}
              className="filter-card"
              onClick={() => {
                useUi.getState().setFilterPriority(p.key);
                setView("today");
              }}
            >
              <div className="filter-card-left">
                <span className={`priority-${p.key}`}>
                  <Icon name="flag" size={16} />
                </span>
                <span className="filter-title">{p.title}</span>
              </div>
              <span className="count-inline">{p.count}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="filter-section" style={{ marginTop: 24 }}>
        <div className="section-title-with-action">
          <h2 className="section-title" style={{ margin: 0 }}>Labels ({allTags.length})</h2>
          <button
            className="icon-btn small add-label-btn"
            aria-label="Add label"
            title="Add label"
            onClick={() => setAddingLabel(true)}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>

        {addingLabel && (
          <form className="add-label-form" onSubmit={submitLabel}>
            <span className="label-at-prefix">@</span>
            <input
              className="add-label-input"
              autoFocus
              value={newLabelName}
              placeholder="Label name"
              onChange={(e) => setNewLabelName(e.target.value)}
              onBlur={() => {
                if (!newLabelName.trim()) setAddingLabel(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNewLabelName("");
                  setAddingLabel(false);
                }
              }}
              aria-label="New label name"
            />
          </form>
        )}

        {allTags.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>No labels yet. Click the + icon to add a label.</p>
        ) : (
          <div className="labels-wrap">
            {allTags.map((tag) => {
              const count = open.filter((t) => t.tags.includes(tag)).length;
              const active = selectedTag === tag;
              return (
                <button
                  key={tag}
                  className={`pill-tag ${active ? "active" : ""}`}
                  onClick={() => setSelectedTag(active ? null : tag)}
                  style={{ borderColor: active ? tagColor(tag) : undefined }}
                >
                  <span style={{ color: tagColor(tag), display: "inline-flex" }}>
                    <Icon name="tag" size={14} />
                  </span>
                  <span>@{tag}</span>
                  <span className="pill-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedTag && (
        <section style={{ marginTop: 24 }}>
          <Group
            title={`Tasks tagged with @${selectedTag}`}
            tasks={displayedTasks}
            footer={<AddInline due={null} />}
          />
        </section>
      )}
    </div>
  );
}

