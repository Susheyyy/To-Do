import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { parseTask } from "../../lib/nlp/parseTask";
import { useTasks } from "../../stores/tasks.store";

export function FloatingBarWindow() {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useTasks((s) => s.createTask);
  const ensureProject = useTasks((s) => s.ensureProject);
  const parsed = useMemo(() => parseTask(text), [text]);

  async function close() {
    setText("");
    try {
      await api.hideWindow("floating-bar");
    } catch {
      void getCurrentWindow().hide();
    }
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      void close();
    };
    window.addEventListener("blur", handleBlur);

    let cleanup: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) void close();
      })
      .then((unlisten) => {
        cleanup = unlisten;
      });

    return () => {
      window.removeEventListener("blur", handleBlur);
      cleanup?.();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;
    const projectId = parsed.projectName ? await ensureProject(parsed.projectName) : null;
    await createTask({
      title: parsed.title,
      notes: null,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      projectId,
      sectionId: null,
      tags: parsed.tags,
    });
    await close();
  }

  return (
    <div className="floating-bar-container">
      <form className="floating-bar-capsule" onSubmit={submit}>
        <button type="button" className="floating-bar-add-icon" tabIndex={-1}>
          <Icon name="plus" size={15} />
        </button>

        <input
          ref={inputRef}
          className="floating-bar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Task name"
          aria-label="Task name"
          onKeyDown={(e) => {
            if (e.key === "Escape") void close();
          }}
        />

        {text.length > 0 && (
          <button
            type="button"
            className="floating-bar-clear-btn"
            onClick={() => setText("")}
            aria-label="Clear"
          >
            <Icon name="close" size={14} />
          </button>
        )}

        <button
          type="button"
          className="floating-bar-close-btn"
          onClick={close}
          aria-label="Close"
          title="Close (Esc)"
        >
          <Icon name="close" size={16} />
        </button>
      </form>
    </div>
  );
}

