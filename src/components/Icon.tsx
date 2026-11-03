import { ReactNode } from "react";

export type IconName = "check" | "plus" | "calendar" | "clipboard" | "star";

const paths: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2.5" />
      <path d="M9 4h6v3H9z" />
    </>
  ),
  star: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16.3 7.1 18.7 8.2 13.3 4.2 9.6l5.4-.6z" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}