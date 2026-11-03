import { ReactElement } from "react";
import { useTheme } from "../app/ThemeProvider";
import { MascotId } from "../styles/themes";

type Props = { size?: number };

function Blob() {
    return (
        <>
            <ellipse cx="32" cy="36" rx="22" ry="20" fill="#f4a6c8" />
            <circle cx="25" cy="34" r="2.6" fill="#5b4a5f" />
            <circle cx="39" cy="34" r="2.6" fill="#5b4a5f" />
            <circle cx="21" cy="41" r="3" fill="#ffffff" opacity="0.6" />
            <circle cx="43" cy="41" r="3" fill="#ffffff" opacity="0.6" />
        </>
    );
}

function Cat() {
    return (
        <>
            <path d="M14 26 L18 10 L28 20 Z" fill="#f9a875" />
            <path d="M50 26 L46 10 L36 20 Z" fill="#f9a875" />
            <ellipse cx="32" cy="36" rx="20" ry="18" fill="#f9a875" />
            <circle cx="25" cy="34" r="2.4" fill="#3b2516" />
            <circle cx="39" cy="34" r="2.4" fill="#3b2516" />
            <path d="M31 40 L33 40 L32 41.5 Z" fill="#3b2516" />
        </>
    );
}

function Bunny() {
    return (
        <>
            <ellipse cx="24" cy="16" rx="5" ry="13" fill="#ffffff" stroke="#2f4f44" strokeWidth="1.5" />
            <ellipse cx="40" cy="16" rx="5" ry="13" fill="#ffffff" stroke="#2f4f44" strokeWidth="1.5" />
            <ellipse cx="32" cy="40" rx="18" ry="16" fill="#ffffff" stroke="#2f4f44" strokeWidth="1.5" />
            <circle cx="26" cy="38" r="2.2" fill="#2f4f44" />
            <circle cx="38" cy="38" r="2.2" fill="#2f4f44" />
            <path d="M31 43 L33 43 L32 44.5 Z" fill="#ffb3c7" />
        </>
    );
}

function Moon() {
    return (
        <>
            <path d="M38 12 A22 22 0 1 0 52 42 A18 18 0 1 1 38 12 Z" fill="#b59cff" />
            <path d="M24 34 q3 3 6 0" stroke="#1a1733" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M34 34 q3 3 6 0" stroke="#1a1733" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
    );
}

function Owl() {
    return (
        <>
            <path d="M16 18 L22 12 L22 24 Z" fill="#6b8f4e" />
            <path d="M48 18 L42 12 L42 24 Z" fill="#6b8f4e" />
            <ellipse cx="32" cy="38" rx="20" ry="18" fill="#8fae6e" />
            <circle cx="25" cy="34" r="7" fill="#f8fbf5" />
            <circle cx="39" cy="34" r="7" fill="#f8fbf5" />
            <circle cx="25" cy="34" r="3" fill="#33402c" />
            <circle cx="39" cy="34" r="3" fill="#33402c" />
            <path d="M30 40 L34 40 L32 44 Z" fill="#c9a35a" />
        </>
    );
}

function Fish() {
    return (
        <>
            <ellipse cx="30" cy="32" rx="18" ry="11" fill="#3fa7d6" />
            <path d="M46 32 L58 24 L58 40 Z" fill="#3fa7d6" />
            <circle cx="22" cy="30" r="2.4" fill="#1d4256" />
            <path d="M30 22 q4 -6 8 0" fill="#2f8fbf" />
        </>
    );
}

function Console() {
    return (
        <>
            <rect x="10" y="20" width="44" height="26" rx="4" fill="#ff8c42" stroke="#1e3b3a" strokeWidth="2" />
            <rect x="18" y="28" width="6" height="6" fill="#1e3b3a" />
            <rect x="40" y="28" width="6" height="6" fill="#1e3b3a" />
            <rect x="16" y="14" width="32" height="6" fill="#1e3b3a" />
        </>
    );
}

function Dot() {
    return <circle cx="32" cy="32" r="12" fill="#ffffff" />;
}

const shapes: Record<MascotId, () => ReactElement | null> = {
  blob: Blob,
  cat: Cat,
  bunny: Bunny,
  moon: Moon,
  owl: Owl,
  fish: Fish,
  console: Console,
  dot: Dot,
  none: () => null,
};

export function Mascot({ size = 56 }: Props) {
    const { theme, motion } = useTheme();
    const Shape = shapes[theme.mascot];
    if (theme.mascot === "none") return null;
    return (
        <svg
            className="mascot-float"
            data-motion={motion ? "on" : "off"}
            width={size}
            height={size}
            viewBox="0 0 64 64"
            role="img"
            aria-label={`${theme.name} mascot`}
        >
            <Shape />
        </svg>
    );
}