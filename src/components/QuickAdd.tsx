import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";

import { Icon } from "./Icon";
import { parseTask } from "../lib/nlp/parseTask";
import { formatTime } from "../lib/time";
import { useSettings } from "../stores/settings.store";
import { useTasks } from "../stores/tasks.store";
import { useHabits } from "../stores/habits.store";

interface Props {
  defaultDue: string | null;
  defaultProjectId?: string | null;
  sectionId?: string | null;
  autoFocus?: boolean;
  placeholder?: string;
  variant?: "card" | "clean";
  onDone?: () => void;
}

interface ChipItem {
  id: string;
  label: string;
  icon?: "repeat";
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
  const habits = useHabits((s) => s.habits);
  const logHabit = useHabits((s) => s.logHabit);
  const loadHabits = useHabits((s) => s.load);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognizerRef = useRef<any>(null);
  const parsed = useMemo(() => parseTask(text), [text]);

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognizerRef.current?.stop();
      setListening(false);
      return;
    }

    try {
      const recognizer = new SR();
      recognizer.lang = "en-US";
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;
      recognizerRef.current = recognizer;

      recognizer.onstart = () => setListening(true);
      recognizer.onend = () => setListening(false);
      recognizer.onerror = () => setListening(false);
      recognizer.onresult = (e: any) => {
        const transcript = e.results[0]?.[0]?.transcript ?? "";
        if (transcript) setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognizer.start();
    } catch {
      setListening(false);
    }
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();

    return () => {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.abort();
        } catch {}
      }
    };
  }, [autoFocus]);

  const due = parsed.dueDate ?? defaultDue;

  const chips: ChipItem[] = text.trim()
    ? [
        parsed.recurRule
          ? {
              id: "recur",
              label: parsed.recurRule,
              icon: "repeat" as const,
            }
          : parsed.dueDate
          ? {
              id: "due",
              label: `Due ${format(parseISO(parsed.dueDate), "d MMM")}`,
            }
          : null,
        parsed.dueTime
          ? {
              id: "time",
              label: `at ${formatTime(parsed.dueTime, clock)}`,
            }
          : null,
        parsed.priority !== "none"
          ? {
              id: "priority",
              label:
                parsed.priority === "high"
                  ? "Priority 1"
                  : parsed.priority === "medium"
                  ? "Priority 2"
                  : "Priority 3",
            }
          : null,
        parsed.projectName
          ? {
              id: "project",
              label: `#${parsed.projectName}`,
            }
          : null,
        ...parsed.tags.map((t) => ({
          id: `tag-${t}`,
          label: `@${t}`,
        })),
      ].filter((c): c is ChipItem => Boolean(c))
    : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;


    const lower = text.trim().toLowerCase();
    const habitMatch = lower.match(/^(?:done|log|check|habit)\s+(.+)$/i);
    if (habitMatch) {
      if (habits.length === 0) await loadHabits();
      const currentHabits = useHabits.getState().habits;
      const query = habitMatch[1].trim();
      const matchedHabit = currentHabits.find(
        (h) => h.name.toLowerCase().includes(query) || query.includes(h.name.toLowerCase())
      );
      if (matchedHabit) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        await logHabit(matchedHabit.id, todayStr);
        setText("");
        onDone?.();
        return;
      }
    }

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
      recurRule: parsed.recurRule,
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
        <button
          type="button"
          className={`mic-input-btn${listening ? " listening" : ""}`}
          onClick={toggleVoice}
          title={listening ? "Stop recording" : "Voice input"}
          aria-label="Voice input"
        >
          <Icon name="mic" size={16} />
        </button>
      </div>
      {chips.length > 0 && (
        <div className="preview">
          {chips.map((chip) => (
            <span key={chip.id} className="pill">
              {chip.icon && <Icon name={chip.icon} size={12} />}
              <span>{chip.label}</span>
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
