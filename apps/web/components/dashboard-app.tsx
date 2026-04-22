"use client";

import {
  startTransition,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  AppConfig,
  DashboardData,
  RunRecord,
  SubredditConfig,
} from "@/lib/types";

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

const DEBUG_MODE_STORAGE_KEY = "redditpulse:debug-mode";
const DEBUG_MODE_EVENT = "redditpulse:debug-mode-change";

function subscribeToDebugMode(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === DEBUG_MODE_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };

  const handleDebugModeChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(DEBUG_MODE_EVENT, handleDebugModeChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DEBUG_MODE_EVENT, handleDebugModeChange);
  };
}

function getDebugModeSnapshot() {
  return window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === "true";
}

function getDebugModeServerSnapshot() {
  return false;
}

function statusTone(status: string) {
  if (status === "succeeded") return "text-[var(--success)]";
  if (status === "failed") return "text-[var(--danger)]";
  return "text-[var(--accent)]";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function DashboardApp({ initialData }: { initialData: DashboardData }) {
  const [dashboard, setDashboard] = useState(initialData);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [newSubreddit, setNewSubreddit] = useState("");
  const [setupForm, setSetupForm] = useState({
    geminiApiKey: initialData.config.geminiApiKey,
    n8nWebhookUrl: initialData.config.n8nWebhookUrl,
    defaultFetchLimit: String(initialData.config.defaultFetchLimit),
    defaultSourceLimit: String(initialData.config.defaultSourceLimit),
  });
  const [runState, setRunState] = useState<
    "idle" | "running" | "succeeded" | "failed"
  >("idle");
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isAddingSubreddit, setIsAddingSubreddit] = useState(false);
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);
  const debugMode = useSyncExternalStore(
    subscribeToDebugMode,
    getDebugModeSnapshot,
    getDebugModeServerSnapshot,
  );
  const enabledSubreddits = dashboard.subreddits.filter(
    (subreddit) => subreddit.enabled,
  );
  const latestRun = dashboard.runs[0] ?? null;

  useEffect(() => {
    window.localStorage.setItem(DEBUG_MODE_STORAGE_KEY, String(debugMode));
  }, [debugMode]);

  const setMessage = (tone: Flash["tone"], message: string) => {
    setFlash({ tone, message });
  };

  const updateConfig = (nextConfig: AppConfig) => {
    setDashboard((current) => ({ ...current, config: nextConfig }));
  };

  const updateSubreddit = (nextSubreddit: SubredditConfig) => {
    setDashboard((current) => ({
      ...current,
      subreddits: current.subreddits.map((item) =>
        item.id === nextSubreddit.id ? nextSubreddit : item,
      ),
    }));
  };

  const removeSubreddit = (id: string) => {
    setDashboard((current) => ({
      ...current,
      subreddits: current.subreddits.filter((item) => item.id !== id),
    }));
  };

  const prependRun = (run: RunRecord) => {
    setDashboard((current) => ({
      ...current,
      runs: [run],
    }));
  };

  const handleSetupSave = () => {
    startTransition(() => {
      void (async () => {
        setIsSavingSetup(true);

        try {
          const response = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              geminiApiKey: setupForm.geminiApiKey,
              n8nWebhookUrl: setupForm.n8nWebhookUrl,
              defaultFetchLimit: Number(setupForm.defaultFetchLimit),
              defaultSourceLimit: Number(setupForm.defaultSourceLimit),
            }),
          });

          const payload = (await response.json()) as
            | { config: AppConfig }
            | { error: string };

          if (!response.ok || "error" in payload) {
            throw new Error(
              "error" in payload
                ? payload.error
                : "Unable to save setup settings.",
            );
          }

          updateConfig(payload.config);
          setMessage("success", "Setup saved to Supabase.");
        } catch (error) {
          setMessage(
            "error",
            error instanceof Error ? error.message : "Setup save failed.",
          );
        } finally {
          setIsSavingSetup(false);
        }
      })();
    });
  };

  const handleAddSubreddit = () => {
    const trimmed = newSubreddit.trim().replace(/^r\//i, "");

    if (!trimmed) {
      setMessage("error", "Enter a subreddit name before adding it.");
      return;
    }

    startTransition(() => {
      void (async () => {
        setIsAddingSubreddit(true);

        try {
          const response = await fetch("/api/subreddits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed }),
          });

          const payload = (await response.json()) as
            | { subreddit: SubredditConfig }
            | { error: string };

          if (!response.ok || "error" in payload) {
            throw new Error(
              "error" in payload
                ? payload.error
                : "Unable to add subreddit.",
            );
          }

          setDashboard((current) => ({
            ...current,
            subreddits: [payload.subreddit, ...current.subreddits],
          }));
          setNewSubreddit("");
          setMessage("success", `Added r/${payload.subreddit.name}.`);
        } catch (error) {
          setMessage(
            "error",
            error instanceof Error ? error.message : "Subreddit add failed.",
          );
        } finally {
          setIsAddingSubreddit(false);
        }
      })();
    });
  };

  const handleSubredditPatch = (
    id: string,
    patch: Partial<Pick<SubredditConfig, "enabled" | "processImages">>,
  ) => {
    const optimistic = dashboard.subreddits.find((item) => item.id === id);

    if (!optimistic) {
      return;
    }

    updateSubreddit({ ...optimistic, ...patch });

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/subreddits/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });

          const payload = (await response.json()) as
            | { subreddit: SubredditConfig }
            | { error: string };

          if (!response.ok || "error" in payload) {
            throw new Error(
              "error" in payload
                ? payload.error
                : "Unable to update subreddit.",
            );
          }

          updateSubreddit(payload.subreddit);
        } catch (error) {
          updateSubreddit(optimistic);
          setMessage(
            "error",
            error instanceof Error ? error.message : "Subreddit update failed.",
          );
        }
      })();
    });
  };

  const handleSubredditDelete = (id: string, name: string) => {
    const previous = dashboard.subreddits;
    removeSubreddit(id);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/subreddits/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const payload = (await response.json()) as { error?: string };
            throw new Error(payload.error ?? "Unable to remove subreddit.");
          }

          setMessage("success", `Removed r/${name}.`);
        } catch (error) {
          setDashboard((current) => ({ ...current, subreddits: previous }));
          setMessage(
            "error",
            error instanceof Error ? error.message : "Subreddit delete failed.",
          );
        }
      })();
    });
  };

  const handleTriggerRun = () => {
    if (isTriggeringRun) {
      return;
    }

    if (dashboard.mode !== "live") {
      setMessage(
        "error",
        "Manual runs require a live Supabase setup. Demo mode cannot trigger n8n.",
      );
      return;
    }

    if (!dashboard.config.n8nWebhookUrl) {
      setMessage("error", "Save an n8n webhook URL before starting a run.");
      return;
    }

    if (enabledSubreddits.length === 0) {
      setMessage("error", "Enable at least one subreddit before starting a run.");
      return;
    }

    setRunState("running");
    setMessage("neutral", "Manual run sent to n8n.");
    setIsTriggeringRun(true);

    if (process.env.NODE_ENV !== "production") {
      console.info("[manual-run] click", {
        webhookUrl: dashboard.config.n8nWebhookUrl,
        enabledSubreddits: enabledSubreddits.map((subreddit) => subreddit.name),
      });
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ debugMode }),
          });

          const payload = (await response.json()) as
            | {
                ok: true;
                message: string;
                subredditCount: number;
                debugMode?: boolean;
              }
            | { error: string; details?: string | null };

          if (!response.ok || !("ok" in payload)) {
            throw new Error(
              "error" in payload ? payload.error : "Manual run failed.",
            );
          }

          const optimisticRun: RunRecord = {
            id: `manual-${Date.now()}`,
            status: "running",
            sourceListing: "hot",
            triggeredAt: new Date().toISOString(),
            completedAt: null,
            totalSubreddits: enabledSubreddits.length,
            notes:
              debugMode
                ? "Debug mode sent a seeded digest response through n8n without calling Gemini. Refresh when the workflow completes."
                : "Browser-triggered manual run sent to n8n. Refresh when the workflow completes.",
            digests: enabledSubreddits.map((subreddit) => ({
              id: `${subreddit.id}-pending`,
              subredditId: subreddit.id,
              subredditName: subreddit.name,
              headline: debugMode ? "Debug digest incoming" : "Digest incoming",
              summary:
                debugMode
                  ? "n8n accepted the debug-mode trigger and will seed the digest payload after the Gemini step."
                  : "n8n accepted the run trigger. Refresh once the workflow persists the latest results to Supabase.",
              imageContextUsed: subreddit.processImages,
              sourceCount: dashboard.config.defaultSourceLimit,
              sources: [],
            })),
          };

          prependRun(optimisticRun);
          setRunState("succeeded");
          setMessage(
            "success",
            debugMode
              ? "Debug-mode run sent to n8n. Gemini will be skipped and the workflow will use the seeded digest response."
              : "Run sent to n8n. Refresh after the workflow writes the latest digests to Supabase.",
          );
        } catch (error) {
          setRunState("failed");
          setMessage(
            "error",
            error instanceof Error ? error.message : "Manual run failed.",
          );
        } finally {
          setIsTriggeringRun(false);
        }
      })();
    });
  };

  return (
    <main className="surface-grid min-h-screen px-5 py-6 text-sm md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass-panel-strong overflow-hidden rounded-[2rem]">
          <div className="grid gap-8 p-6 md:grid-cols-[1.15fr_0.85fr] md:p-10">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-soft">
                  RedditPulse Control Room
                </span>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                  {dashboard.mode === "live" ? "Supabase Live" : "Demo Preview"}
                </span>
              </div>
              <div className="max-w-3xl space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.06em] text-balance md:text-6xl">
                  Manual subreddit digests, staged like an operator desk.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-soft md:text-lg">
                  Configure the Gemini key, define subreddit coverage, launch one
                  n8n workflow, and review the latest digest output where each
                  enabled subreddit lands as one briefing card.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTriggerRun}
                  disabled={isTriggeringRun}
                  className="rounded-full bg-[var(--foreground)] px-5 py-3 font-medium text-[var(--background)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  {isTriggeringRun ? "Sending Run..." : "Trigger Manual Run"}
                </button>
                <button
                  type="button"
                  aria-pressed={debugMode}
                  onClick={() => {
                    window.localStorage.setItem(
                      DEBUG_MODE_STORAGE_KEY,
                      String(!debugMode),
                    );
                    window.dispatchEvent(new Event(DEBUG_MODE_EVENT));
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 font-medium transition-colors ${
                    debugMode
                      ? "border-amber-900/20 bg-amber-200/80 text-amber-950"
                      : "border-black/10 bg-white/60 text-[var(--foreground)] hover:bg-white"
                  }`}
                >
                  <BugIcon />
                  {debugMode ? "Debug mode on" : "Debug mode off"}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-black/10 bg-white/60 px-5 py-3 font-medium transition-colors hover:bg-white"
                >
                  Refresh Latest Run
                </button>
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-soft">
                  Run status:{" "}
                  <span className={statusTone(runState)}>
                    {RUN_STATE_LABELS[runState]}
                  </span>
                </div>
              </div>
              {flash ? (
                <div
                  className={`max-w-2xl rounded-2xl border px-4 py-3 text-sm ${
                    flash.tone === "success"
                      ? "border-emerald-700/20 bg-emerald-600/10 text-emerald-900"
                      : flash.tone === "error"
                        ? "border-red-700/20 bg-red-600/10 text-red-900"
                        : "border-black/10 bg-white/65 text-[var(--foreground)]"
                  }`}
                >
                  {flash.message}
                </div>
              ) : null}
            </div>

            <div className="glass-panel rounded-[1.75rem] p-5 md:p-6">
              <div className="space-y-5">
                <div>
                  <p className="section-title">System Snapshot</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                    MVP operating contract
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Metric
                    label="Enabled subreddits"
                    value={String(enabledSubreddits.length)}
                    note="Each one gets a digest card every run."
                  />
                  <Metric
                    label="Source depth"
                    value={`${dashboard.config.defaultSourceLimit}`}
                    note="Target number of cited posts per digest."
                  />
                  <Metric
                    label="Fetch depth"
                    value={`${dashboard.config.defaultFetchLimit}`}
                    note="Posts pulled from each hot listing."
                  />
                  <Metric
                    label="Latest run"
                    value={latestRun ? formatCompactDate(latestRun.triggeredAt) : "None"}
                    note={latestRun ? latestRun.status : "Waiting for the first run."}
                  />
                  <Metric
                    label="Gemini mode"
                    value={debugMode ? "Debug" : "Live"}
                    note={
                      debugMode
                        ? "Uses seeded output after the Gemini step."
                        : "Calls Gemini for each digest generation."
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
          <section className="glass-panel rounded-[2rem] p-6 md:p-8">
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="section-title">Initialization</p>
                <h2 className="text-3xl font-semibold tracking-[-0.05em]">
                  Setup and source control
                </h2>
                <p className="max-w-xl text-sm leading-6 text-soft">
                  Save the Gemini key, point the app at your n8n webhook, and keep
                  subreddit coverage editable without touching workflow code.
                </p>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="font-medium">Gemini API key</span>
                  <input
                    value={setupForm.geminiApiKey}
                    onChange={(event) =>
                      setSetupForm((current) => ({
                        ...current,
                        geminiApiKey: event.target.value,
                      }))
                    }
                    placeholder="AIza..."
                    className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none transition focus:border-black/25"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="font-medium">n8n webhook URL</span>
                  <input
                    value={setupForm.n8nWebhookUrl}
                    onChange={(event) =>
                      setSetupForm((current) => ({
                        ...current,
                        n8nWebhookUrl: event.target.value,
                      }))
                    }
                    placeholder="https://n8n.example/webhook/redditpulse-manual"
                    className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none transition focus:border-black/25"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="font-medium">Default fetch limit</span>
                    <input
                      type="number"
                      min={5}
                      step={1}
                      value={setupForm.defaultFetchLimit}
                      onChange={(event) =>
                        setSetupForm((current) => ({
                          ...current,
                          defaultFetchLimit: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-medium">Default source count</span>
                    <input
                      type="number"
                      min={3}
                      max={5}
                      step={1}
                      value={setupForm.defaultSourceLimit}
                      onChange={(event) =>
                        setSetupForm((current) => ({
                          ...current,
                          defaultSourceLimit: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleSetupSave}
                  disabled={isSavingSetup}
                  className="w-fit rounded-full border border-black/10 bg-white px-5 py-3 font-medium transition-colors hover:bg-black hover:text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSetup ? "Saving setup..." : "Save setup"}
                </button>
              </div>

              <div className="space-y-4 border-t border-black/10 pt-6">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid min-w-[240px] flex-1 gap-2">
                    <span className="font-medium">Add subreddit</span>
                    <input
                      value={newSubreddit}
                      onChange={(event) => setNewSubreddit(event.target.value)}
                      placeholder="RantAndVentPH"
                      className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none transition focus:border-black/25"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSubreddit}
                    disabled={isAddingSubreddit}
                    className="rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isAddingSubreddit ? "Adding..." : "Add source"}
                  </button>
                </div>
                <div className="space-y-3">
                  {dashboard.subreddits.map((subreddit) => (
                    <article
                      key={subreddit.id}
                      className="rounded-[1.5rem] border border-black/10 bg-white/60 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                            r/{subreddit.name}
                          </p>
                          <p className="mt-2 max-w-md text-sm leading-6 text-soft">
                            {subreddit.processImages
                              ? "Image summaries enabled for screenshot-heavy or visual context."
                              : "Text-only summarization path for lower-cost digest generation."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleSubredditDelete(subreddit.id, subreddit.name)
                          }
                          className="rounded-full border border-red-900/10 bg-red-100/60 px-3 py-2 font-medium text-red-900 transition-colors hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <TogglePill
                          label={subreddit.enabled ? "Enabled" : "Disabled"}
                          active={subreddit.enabled}
                          onClick={() =>
                            handleSubredditPatch(subreddit.id, {
                              enabled: !subreddit.enabled,
                            })
                          }
                        />
                        <TogglePill
                          label={
                            subreddit.processImages
                              ? "Images on"
                              : "Images off"
                          }
                          active={subreddit.processImages}
                          onClick={() =>
                            handleSubredditPatch(subreddit.id, {
                              processImages: !subreddit.processImages,
                            })
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-[2rem] p-6 md:p-8">
            <div className="space-y-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                  <p className="section-title">Latest Run</p>
                  <h2 className="text-3xl font-semibold tracking-[-0.05em]">
                    Current briefing output
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-soft">
                    This panel only shows the most recent run. Each enabled
                    subreddit appears as one text-first briefing card with 3-5 cited
                    source posts.
                  </p>
                </div>
                <div className="rounded-full border border-black/10 bg-white/65 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                  latest only
                </div>
              </div>

              <div className="space-y-5">
                {dashboard.runs.length === 0 ? (
                  <article className="rounded-[1.75rem] border border-dashed border-black/10 bg-white/60 p-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                      No run yet
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-soft">
                      Trigger a manual run to populate the latest digest details here.
                    </p>
                  </article>
                ) : (
                  dashboard.runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-[1.75rem] border border-black/10 bg-white/70 p-5 md:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                            {formatDate(run.triggeredAt)}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] ${
                              run.status === "succeeded"
                                ? "bg-emerald-100 text-emerald-900"
                                : run.status === "failed"
                                  ? "bg-red-100 text-red-900"
                                  : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {run.status}
                          </span>
                          {run.notes?.toLowerCase().includes("debug mode") ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-950">
                              Debug seeded
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-2xl font-semibold tracking-[-0.05em]">
                          {run.totalSubreddits} subreddit briefings from {run.sourceListing}
                        </h3>
                        {run.notes ? (
                          <p className="max-w-2xl text-sm leading-6 text-soft">
                            {run.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                        {run.completedAt
                          ? `Completed ${formatDate(run.completedAt)}`
                          : "Awaiting persistence"}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4">
                      {run.digests.map((digest) => (
                        <section
                          key={digest.id}
                          className="rounded-[1.5rem] border border-black/10 bg-[rgba(255,255,255,0.78)] p-4 md:p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                                r/{digest.subredditName}
                              </p>
                              <h4 className="mt-2 max-w-2xl text-xl font-semibold tracking-[-0.04em]">
                                {digest.headline}
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-black/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                                {digest.sourceCount} sources
                              </span>
                              <span className="rounded-full border border-black/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                                {digest.imageContextUsed ? "Image-assisted" : "Text-only"}
                              </span>
                            </div>
                          </div>
                          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--foreground)]">
                            {digest.summary}
                          </p>
                          <div className="mt-5 border-t border-black/10 pt-4">
                            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-soft">
                              Sources
                            </p>
                            <div className="mt-3 grid gap-3">
                              {digest.sources.length === 0 ? (
                                <p className="text-sm text-soft">
                                  Source links will appear once the workflow writes
                                  the finished digest to Supabase.
                                </p>
                              ) : (
                                digest.sources.map((source) => (
                                  <a
                                    key={source.id}
                                    href={source.permalink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 transition-transform duration-200 hover:-translate-y-0.5"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <p className="font-medium">{source.title}</p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-soft">
                                          u/{source.author} · {source.score} score ·{" "}
                                          {source.commentCount} comments
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {source.isImagePost ? (
                                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                                            Image source
                                          </span>
                                        ) : null}
                                        {source.previewImageUrl ? (
                                          <span className="rounded-full border border-black/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-soft">
                                            Preview available
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </a>
                                ))
                              )}
                            </div>
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function BugIcon() {
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
      <path d="M9 6.5h6" />
      <path d="M10 3.5 8.5 5" />
      <path d="M14 3.5 15.5 5" />
      <path d="M7.5 10H4.5" />
      <path d="M19.5 10h-3" />
      <path d="M7 14H4" />
      <path d="M20 14h-3" />
      <path d="M9 20c-2.2 0-4-1.8-4-4v-5a7 7 0 0 1 14 0v5c0 2.2-1.8 4-4 4Z" />
      <path d="M12 9.5v10" />
    </svg>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-black/10 bg-white/55 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-soft">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.06em]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-soft">{note}</p>
    </div>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "bg-[var(--foreground)] text-[var(--background)]"
          : "border border-black/10 bg-white/80 text-soft hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
