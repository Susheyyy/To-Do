import { useEffect, useRef } from "react";

import { Group } from "../../components/Group";
import { Icon } from "../../components/Icon";
import { sortTasks } from "../../lib/sortTasks";
import { useTasks } from "../../stores/tasks.store";
import { useUi } from "../../stores/ui.store";

export function SearchModal() {
  const open = useTasks((s) => s.open);
  const completedToday = useTasks((s) => s.completedToday);
  const sort = useUi((s) => s.sort);
  const searchOpen = useUi((s) => s.searchOpen);
  const closeSearch = useUi((s) => s.closeSearch);
  const searchQuery = useUi((s) => s.searchQuery);
  const setSearchQuery = useUi((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

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
    <div className="modal-backdrop" onMouseDown={closeSearch}>
      <div className="modal search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-bar-wrap modal-search-bar">
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
          <button className="icon-btn small" onClick={closeSearch} aria-label="Close search">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="search-modal-results">
          {query ? (
            results.length > 0 ? (
              <Group title={`Results (${results.length})`} tasks={results} />
            ) : (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <p>No tasks found matching "{searchQuery}"</p>
              </div>
            )
          ) : (
            <div className="empty-state" style={{ padding: "24px 0" }}>
              <p>Type to search across tasks, descriptions, and tags.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
