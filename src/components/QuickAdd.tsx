import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";

import { parseTask } from "../lib/nlp/parseTask";
import { formatTime } from "../lib/time";
import { useSettings } from "../stores/settings.store";
import { useTasks } from "../stores/tasks.store";

interface Props {
  defaultDue: string | null;
  defaultProjectId?: string | null;
  sectionId?: string | null;
  autoFocus?: boolean;
  placeholder?: string;
  variant?: "card" | "clean";
  onDone?: () => void;
}

export function QuickAdd({
  defaultDue,
  defaultProjectId = null,
  sectionId = null,
  autoFocus = false,
  placeholder = "Add task",
  variant = "card",
  onDone,
}: Props) {
  const clock = useSettings((s) => s.clock);
  const createTask = useTasks((s) => s.createTask);
  const ensureProject = useTasks((s) => s.ensureProject);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseTask(text), [text]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const due = parsed.dueDate ?? defaultDue;

  const chips = text.trim()
    ? [
        parsed.dueDate ? `Due ${format(parseISO(parsed.dueDate), "d MMM")}` : null,
        parsed.dueTime ? `at ${formatTime(parsed.dueTime, clock)}` : null,
        parsed.priority !== "none"
          ? parsed.priority === "high"
            ? "Priority 1"
            : parsed.priority === "medium"
            ? "Priority 2"
            : "Priority 3"
          : null,
        parsed.projectName ? `#${parsed.projectName}` : null,
        ...parsed.tags.map((t) => `@${t}`),
      ].filter((c): c is string => Boolean(c))
    : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;
    const projectId = parsed.projectName ? await ensureProject(parsed.projectName) : defaultProjectId;
    await createTask({
      title: parsed.title,
      notes: null,
      priority: parsed.priority,
      dueDate: due,
      dueTime: parsed.dueTime,
      projectId,
      sectionId,
      tags: parsed.tags,
    });
    setText("");
    onDone?.();
  }

  const isClean = variant === "clean";

  return (
    <form className={isClean ? "quick-add-clean" : "card quick-add"} onSubmit={submit}>
      <div className="quick-add-row">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="New task"
        />
      </div>
      {chips.length > 0 && (
        <div className="preview">
          {chips.map((chip) => (
            <span key={chip} className="pill">
              {chip}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
