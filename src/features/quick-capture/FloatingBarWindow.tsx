import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Icon } from "../../components/Icon";
import { api } from "../../lib/api";
import { parseTask } from "../../lib/nlp/parseTask";
import { useTasks } from "../../stores/tasks.store";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function FloatingBarWindow() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useTasks((s) => s.createTask);
  const ensureProject = useTasks((s) => s.ensureProject);
  const parsed = useMemo(() => parseTask(text), [text]);
  const recognizerRef = useRef<any>(null);

  async function close() {
    setText("");
    setListening(false);
    recognizerRef.current?.abort();
    try {
      await api.hideWindow("floating-bar");
    } catch {
      void getCurrentWindow().hide();
    }
  }

  useEffect(() => {
    inputRef.current?.focus();

    async function tryPasteSelection() {
      try {
        const clip = await readText();
        if (clip && clip.trim().length > 0 && clip.trim().length < 300) {
          setText(clip.trim());
        }
      } catch {}
    }
    void tryPasteSelection();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) void close();
      })
      .then((unlisten) => {
        cleanup = unlisten;
      });

    return () => {
      cleanup?.();
      recognizerRef.current?.abort();
    };
  }, []);

  function startVoice() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
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
  }

  function toggleVoice() {
    if (listening) {
      recognizerRef.current?.stop();
      setListening(false);
    } else {
      startVoice();
    }
  }

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
      recurRule: null,
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
          placeholder="Task name or speak..."
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
          className={`floating-bar-mic-btn${listening ? " listening" : ""}`}
          onClick={toggleVoice}
          aria-label={listening ? "Stop listening" : "Voice input"}
          title="Voice input"
        >
          <Icon name="mic" size={15} />
        </button>

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
