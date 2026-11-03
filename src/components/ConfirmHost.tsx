import { useEffect } from "react";

import { useConfirm } from "../stores/confirm.store";

export function ConfirmHost() {
  const message = useConfirm((s) => s.message);
  const answer = useConfirm((s) => s.answer);

  useEffect(() => {
    if (!message) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answer(false);
      if (e.key === "Enter") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [message, answer]);

  if (!message) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => answer(false)}>
      <div className="modal confirm-box" onMouseDown={(e) => e.stopPropagation()}>
        <p className="confirm-text">{message}</p>
        <div className="confirm-actions">
          <button className="chip" onClick={() => answer(false)}>
            Cancel
          </button>
          <button className="chip danger-chip" onClick={() => answer(true)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}