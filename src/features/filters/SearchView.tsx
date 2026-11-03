import { useEffect, useRef } from "react";

import { DisplayMenu } from "../../components/DisplayMenu";
import { Group } from "../../components/Group";
import { Icon } from "../../components/Icon";
import { sortTasks } from "../../lib/sortTasks";
import { useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";

export function SearchView() {
  const open = useTasks((s) => s.open);
  const completedToday = useTasks((s) => s.completedToday);
  const sort = useUi((s) => s.sort);
  const searchQuery = useUi((s) => s.searchQuery);
  const setSearchQuery = useUi((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allTasks = [...open, ...completedToday];
  const query = searchQuery.trim().toLowerCase();

  const results = query
    ? sortTasks(
        allTasks.filter((t) => {
          const matchTitle = t.title.toLowerCase().includes(query);
          const matchNotes = t.notes ? t.notes.toLowerCase().includes(query) : false;
          const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(query));
          return matchTitle || matchNotes || matchTags;
        }),
        sort
      )
    : [];

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-title-row">
          <h1>Search</h1>
          <div className="header-tools">
            <DisplayMenu showCompletedToggle={false} />
          </div>
        </div>
      </header>

      <div className="search-bar-wrap">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          className="search-input-field"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, description, or @tag..."
          aria-label="Search tasks"
        />
        {searchQuery && (
          <button className="icon-btn small" onClick={() => setSearchQuery("")} aria-label="Clear search">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        {query ? (
          results.length > 0 ? (
            <Group title={`Results for "${searchQuery}"`} tasks={results} />
          ) : (
            <div className="empty-state">
              <p>No tasks found matching "{searchQuery}"</p>
            </div>
          )
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>Type above to search across your tasks, descriptions, and tags.</p>
        )}
      </div>
    </div>
  );
}

