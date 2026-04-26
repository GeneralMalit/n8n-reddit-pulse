"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

const WORDMARK = "redditPulse";
const WORDMARK_COLORS = [
  "#ff4500",
  "#ff4d0a",
  "#ff5a17",
  "#ff6a26",
  "#ff7a37",
  "#ff8948",
  "#ffb48f",
  "#ffd1bb",
  "#ffe2d5",
  "#f2edea",
  "#eef2f4",
] as const;

export function AppHeader({
  currentPage,
}: {
  currentPage: "dashboard" | "settings";
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeLetterIndex, setActiveLetterIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const syncScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    syncScroll();
    window.addEventListener("scroll", syncScroll, { passive: true });

    return () => window.removeEventListener("scroll", syncScroll);
  }, []);

  const syncActiveLetter = (event: ReactMouseEvent<HTMLSpanElement>) => {
    const letters = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-letter-index]"),
    );

    const hoveredLetter = letters.find((letter) => {
      const rect = letter.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right;
    });

    setActiveLetterIndex(
      hoveredLetter ? Number(hoveredLetter.dataset.letterIndex) : null,
    );
  };

  return (
    <header
      data-scrolled={isScrolled ? "true" : "false"}
      className="app-header sticky top-0 z-40 w-full px-5 py-4 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="min-w-0" aria-label={WORDMARK}>
          <span className="sr-only">{WORDMARK}</span>
          <span
            aria-hidden="true"
            className="brand-wordmark text-[1.55rem] leading-none md:text-[1.9rem]"
            onMouseMove={syncActiveLetter}
            onMouseLeave={() => setActiveLetterIndex(null)}
          >
            {Array.from(WORDMARK).map((letter, index) => (
              <BrandLetter
                key={`${letter}-${index}`}
                letter={letter}
                index={index}
                isActive={activeLetterIndex === index}
                color={WORDMARK_COLORS[index] ?? "#eef2f4"}
                segment={index < 6 ? "reddit" : "pulse"}
                onHover={setActiveLetterIndex}
              />
            ))}
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <HeaderLink
            href="/settings"
            label="Settings"
            active={currentPage === "settings"}
            icon={<SettingsIcon />}
          />
        </nav>
      </div>
    </header>
  );
}

function BrandLetter({
  letter,
  index,
  isActive,
  color,
  segment,
  onHover,
}: {
  letter: string;
  index: number;
  isActive: boolean;
  color: string;
  segment: "reddit" | "pulse";
  onHover: (index: number | null) => void;
}) {
  return (
    <span
      data-letter-index={index}
      data-segment={segment}
      data-active={isActive ? "true" : "false"}
      className="brand-letter"
      onMouseEnter={() => onHover(index)}
      style={{
        cursor: "pointer",
        color,
        filter: isActive ? "brightness(1.22) saturate(1.12)" : undefined,
        transform: isActive ? "translateY(-0.04em) scale(1.045)" : undefined,
        textShadow: isActive
          ? `0 0 10px color-mix(in srgb, ${color} 78%, transparent),
             0 0 22px color-mix(in srgb, ${color} 46%, transparent),
             0 0 34px color-mix(in srgb, ${color} 20%, transparent)`
          : undefined,
      }}
    >
      {letter}
    </span>
  );
}

function HeaderLink({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`header-chip inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-medium ${
        active
          ? "text-white"
          : "text-white/88"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L4.21 7.2a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
