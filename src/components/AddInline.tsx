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
      <QuickAdd
        defaultDue={due}
        defaultProjectId={projectId}
        sectionId={sectionId}
        autoFocus
        onDone={() => setOpen(false)}
      />
    );
  }

  return (
    <button className="add-link" onClick={() => setOpen(true)}>
      <Icon name="plus" size={16} />
      <span>Add task</span>
    </button>
  );
}