"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DashboardHero } from "@/components/dashboard-hero";
import {
  normalizeSubredditName,
  prependSubreddit,
  removeSubredditById,
  replaceSubreddit,
} from "@/components/dashboard-subreddit-utils";
import { FlashToast } from "@/components/flash-toast";
import { LatestBriefing } from "@/components/latest-briefing";
import type { DashboardData, RunRecord, SubredditConfig } from "@/lib/types";

type Flash = {
  tone: "neutral" | "success" | "error";
  message: string;
};

export function DashboardApp({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(initialData);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [runState, setRunState] = useState<
    "idle" | "running" | "succeeded" | "failed"
  >("idle");
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);
  const enabledSubreddits = dashboard.subreddits.filter(
    (subreddit) => subreddit.enabled,
  );
  const latestRun = dashboard.runs[0] ?? null;

  const setMessage = (tone: Flash["tone"], message: string) => {
    setFlash({ tone, message });
  };

  const updateSubreddit = (nextSubreddit: SubredditConfig) => {
    setDashboard((current) => ({
      ...current,
      subreddits: replaceSubreddit(current.subreddits, nextSubreddit),
    }));
  };

  const removeSubreddit = (id: string) => {
    setDashboard((current) => ({
      ...current,
      subreddits: removeSubredditById(current.subreddits, id),
    }));
  };

  const prependRun = (run: RunRecord) => {
    setDashboard((current) => ({
      ...current,
      runs: [run],
    }));
  };

  const handleAddSubreddit = async (name: string) => {
    const trimmed = normalizeSubredditName(name);

    if (!trimmed) {
      setMessage("error", "Enter a subreddit name before adding it.");
      return;
    }

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
        "error" in payload ? payload.error : "Unable to add subreddit.",
      );
    }

    setDashboard((current) => ({
      ...current,
      subreddits: prependSubreddit(current.subreddits, payload.subreddit),
    }));
    setMessage("success", `Added r/${payload.subreddit.name}.`);
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
          });

          const payload = (await response.json()) as
            | {
                ok: true;
                message: string;
                subredditCount: number;
                dashboard: DashboardData;
              }
            | { error: string; details?: string | null };

          if (!response.ok || !("ok" in payload)) {
            throw new Error(
              "error" in payload ? payload.error : "Manual run failed.",
            );
          }

          const successPayload = payload as {
            ok: true;
            message: string;
            subredditCount: number;
            dashboard: DashboardData;
          };

          const optimisticRun: RunRecord = {
            id: `manual-${Date.now()}`,
            status: "running",
            sourceListing: "hot",
            triggeredAt: new Date().toISOString(),
            completedAt: null,
            totalSubreddits: enabledSubreddits.length,
            notes:
              "Browser-triggered manual run sent to n8n. The dashboard will swap in the persisted run when n8n finishes.",
            digests: enabledSubreddits.map((subreddit) => ({
              id: `${subreddit.id}-pending`,
              subredditId: subreddit.id,
              subredditName: subreddit.name,
              headline: "Digest incoming",
              summary:
                "n8n accepted the run trigger. Refresh once the workflow persists the latest results to Supabase.",
              imageContextUsed: subreddit.processImages,
              sourceCount: 0,
              sources: [],
            })),
          };

          prependRun(optimisticRun);
          setDashboard(successPayload.dashboard);
          setRunState(
            successPayload.dashboard.runs[0]?.status ?? "succeeded",
          );
          setMessage("success", "Run completed and the dashboard was updated.");
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
    <main className="surface-grid min-h-screen text-sm">
      <FlashToast flash={flash} onDismiss={() => setFlash(null)} />
      <AppHeader currentPage="dashboard" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-6 md:px-8 md:py-8">
        <DashboardHero
          subreddits={dashboard.subreddits}
          latestRun={latestRun}
          runState={runState}
          isTriggeringRun={isTriggeringRun}
          onSetFlash={setMessage}
          onTriggerRun={handleTriggerRun}
          onAddSubreddit={async (name) => {
            await handleAddSubreddit(name);
          }}
          onPatchSubreddit={handleSubredditPatch}
          onDeleteSubreddit={handleSubredditDelete}
          onRefresh={() => router.refresh()}
        />
        <LatestBriefing run={latestRun} />
      </div>
    </main>
  );
}
