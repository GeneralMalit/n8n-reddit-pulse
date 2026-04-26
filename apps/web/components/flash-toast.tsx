"use client";

import { useEffect } from "react";

type Flash = {
  tone: "neutral" | "success" | "error";
  message: string;
};

export function FlashToast({
  flash,
  onDismiss,
}: {
  flash: Flash | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!flash) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [flash, onDismiss]);

  if (!flash) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] w-full max-w-sm md:right-6 md:top-6">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm ${
          flash.tone === "success"
            ? "border-[color:var(--success)]/35 bg-[color:var(--success)]/14 text-[var(--foreground)]"
            : flash.tone === "error"
              ? "border-[color:var(--danger)]/35 bg-[color:var(--danger)]/14 text-[var(--foreground)]"
              : "border-[color:var(--line-strong)] bg-[color:var(--panel-strong)]/95 text-[var(--foreground)]"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
              Notification
            </p>
            <p className="mt-1 text-sm leading-6">{flash.message}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-[color:var(--line)] px-2 py-1 text-xs transition-colors hover:bg-white/5"
            aria-label="Dismiss notification"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
