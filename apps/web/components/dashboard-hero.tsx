"use client";

import { startTransition, useEffect, useState } from "react";
import type { RunRecord, SubredditConfig } from "@/lib/types";

type Flash = {
  tone: "neutral" | "success" | "error";
  message: string;
};

const RUN_STATE_LABELS: Record<string, string> = {
  idle: "Ready",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

function statusTone(status: string) {
  if (status === "succeeded") return "text-[var(--success)]";
  if (status === "failed") return "text-[var(--danger)]";
  return "text-[var(--accent)]";
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function DashboardHero({
  subreddits,
  latestRun,
  runState,
  isTriggeringRun,
  onSetFlash,
  onTriggerRun,
  onAddSubreddit,
  onPatchSubreddit,
  onDeleteSubreddit,
  onRefresh,
}: {
  subreddits: SubredditConfig[];
  latestRun: RunRecord | null;
  runState: "idle" | "running" | "succeeded" | "failed";
  isTriggeringRun: boolean;
  onSetFlash: (tone: Flash["tone"], message: string) => void;
  onTriggerRun: () => void;
  onAddSubreddit: (name: string) => Promise<void>;
  onPatchSubreddit: (
    id: string,
    patch: Partial<Pick<SubredditConfig, "enabled" | "processImages">>,
  ) => void;
  onDeleteSubreddit: (id: string, name: string) => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  const enabledSubreddits = subreddits.filter((subreddit) => subreddit.enabled);
  const imageEnabledSubreddits = subreddits.filter(
    (subreddit) => subreddit.processImages,
  );

  useEffect(() => {
    if (!isRosterOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRosterOpen(false);
        setDraft("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRosterOpen]);

  const submitAdd = () => {
    const trimmed = draft.trim();

    if (!trimmed) {
      onSetFlash("error", "Enter a subreddit name before adding it.");
      return;
    }

    startTransition(() => {
      void (async () => {
        setIsAdding(true);
        try {
          await onAddSubreddit(trimmed);
          setDraft("");
        } finally {
          setIsAdding(false);
        }
      })();
    });
  };

  const latestRunLabel = latestRun
    ? `${RUN_STATE_LABELS[latestRun.status] ?? latestRun.status} · ${formatCompactDate(latestRun.triggeredAt)}`
    : "No run recorded";

  return (
    <>
      <section className="glass-panel-strong overflow-hidden rounded-[1.25rem]">
        <div className="p-5 md:p-6">
          <div className="max-w-3xl space-y-2">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.06em] md:text-5xl">
              Manual ingest and roster control in one surface.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-soft md:text-base">
              Trigger runs and manage subreddit coverage from a focused operator
              desk without extra workflow controls.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTriggerRun}
              disabled={isTriggeringRun}
              className="rounded-full bg-[var(--foreground)] px-4 py-2.5 font-medium text-[var(--background)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-70"
            >
              {isTriggeringRun ? "Sending run..." : "Run"}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2.5 font-medium transition-colors hover:bg-[color:var(--panel-strong)]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setIsRosterOpen(true)}
              className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2.5 font-medium transition-colors hover:bg-[color:var(--panel-strong)]"
            >
              Open Subreddit Roster
            </button>
            <div className="ml-0 font-mono text-[10px] uppercase tracking-[0.22em] text-soft sm:ml-auto">
              Latest run: <span className={statusTone(runState)}>{latestRunLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {isRosterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          onClick={() => {
            setIsRosterOpen(false);
            setDraft("");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Subreddit roster"
            className="glass-panel-strong max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[1.25rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[color:var(--line)] px-5 py-4">
              <div>
                <p className="section-title">Subreddit roster</p>
                <p className="mt-1 text-sm text-soft">
                  Manage coverage, image routing, and source membership from one
                  focused modal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRosterOpen(false);
                  setDraft("");
                }}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--panel-strong)]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
              <div className="max-h-[70vh] overflow-y-auto border-b border-[color:var(--line)] md:border-b-0 md:border-r">
                <div className="divide-y divide-[color:var(--line)]">
                  {subreddits.map((subreddit) => (
                    <SubredditRow
                      key={subreddit.id}
                      subreddit={subreddit}
                      onPatch={onPatchSubreddit}
                      onDelete={onDeleteSubreddit}
                    />
                  ))}
                </div>
              </div>

              <aside className="bg-[color:var(--background)] p-5">
                <div className="space-y-4">
                  <div>
                    <p className="section-title">Add source</p>
                    <h2 className="mt-2 text-lg font-semibold tracking-[-0.05em]">
                      Expand coverage
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-soft">
                      Add another subreddit to the roster, then tune its state from
                      the list.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="r/AskReddit"
                      className="w-full min-w-0 rounded-[0.85rem] border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-3 font-mono text-sm outline-none transition-colors placeholder:text-soft focus:border-[var(--accent)]"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitAdd();
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={submitAdd}
                      disabled={isAdding}
                      className="rounded-[0.85rem] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--background)] transition hover:brightness-110 disabled:opacity-70"
                    >
                      {isAdding ? "Adding..." : "Add subreddit"}
                    </button>
                  </div>

                  <div className="rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
                      Roster status
                    </p>
                    <div className="mt-3 grid gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-soft">
                      <div className="flex items-center justify-between gap-4">
                        <span>Active</span>
                        <span className="text-[var(--foreground)]">
                          {enabledSubreddits.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Images</span>
                        <span className="text-[var(--foreground)]">
                          {imageEnabledSubreddits.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>Total</span>
                        <span className="text-[var(--foreground)]">
                          {subreddits.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SubredditRow({
  subreddit,
  onPatch,
  onDelete,
}: {
  subreddit: SubredditConfig;
  onPatch: (
    id: string,
    patch: Partial<Pick<SubredditConfig, "enabled" | "processImages">>,
  ) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className={`relative grid gap-3 px-5 py-4 ${subreddit.enabled ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
              r/{subreddit.name}
            </span>
            <button
              type="button"
              aria-pressed={subreddit.enabled}
              aria-label={`${subreddit.enabled ? "Disable" : "Enable"} r/${subreddit.name}`}
              onClick={() => onPatch(subreddit.id, { enabled: !subreddit.enabled })}
              className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
                subreddit.enabled
                  ? "border-[color:var(--line)] bg-[color:var(--panel)] text-[var(--foreground)]"
                  : "border-[color:var(--line)] bg-black/5 text-soft"
              }`}
            >
              {subreddit.enabled ? "Enabled" : "Disabled"}
            </button>
            <button
              type="button"
              aria-pressed={subreddit.processImages}
              aria-label={`${subreddit.processImages ? "Disable" : "Enable"} images for r/${subreddit.name}`}
              onClick={() =>
                onPatch(subreddit.id, {
                  processImages: !subreddit.processImages,
                })
              }
              className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${
                subreddit.processImages
                  ? "border-[color:var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[color:var(--line)] bg-[color:var(--panel)] text-soft"
              }`}
            >
              Images {subreddit.processImages ? "On" : "Off"}
            </button>
          </div>
          <p className="mt-2 text-sm leading-5 text-soft">
            Toggle source participation and image handling directly from the row.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Remove r/${subreddit.name}`}
            onClick={() => onDelete(subreddit.id, subreddit.name)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--danger)]/25 bg-[color:var(--danger)]/12 text-lg leading-none text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger)]/18"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}
