import { useState } from "react";

import { Icon } from "./Icon";
import { QuickAdd } from "./QuickAdd";

export function AddInline({
  due,
  projectId = null,
  sectionId = null,
}: {
  due: string | null;
  projectId?: string | null;
  sectionId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="inline-quickadd-box">
        <QuickAdd
          defaultDue={due}
          defaultProjectId={projectId}
          sectionId={sectionId}
          autoFocus
          variant="clean"
          onDone={() => setOpen(false)}
        />
        <div className="inline-quickadd-actions">
          <button
            type="button"
            className="inline-cancel-btn"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className="add-link" onClick={() => setOpen(true)}>
      <Icon name="plus" size={16} />
      <span>Add task</span>
    </button>
  );
}
