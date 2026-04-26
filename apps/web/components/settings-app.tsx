"use client";

import { startTransition, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { LOCAL_N8N_WEBHOOK_URL } from "@/lib/n8n-webhook";
import {
  SUMMARIZATION_MODEL_OPTIONS,
  type AppConfig,
} from "@/lib/types";

type Flash = {
  tone: "success" | "error";
  message: string;
};

export function SettingsApp({
  initialConfig,
  mode,
}: {
  initialConfig: AppConfig;
  mode: "demo" | "live";
}) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    geminiApiKey: initialConfig.geminiApiKey,
    n8nWebhookUrl: initialConfig.n8nWebhookUrl,
    defaultFetchLimit: String(initialConfig.defaultFetchLimit),
    defaultDigestSize: String(initialConfig.defaultDigestSize),
    summarizationModel: initialConfig.summarizationModel,
  });
  const isReady = Boolean(form.geminiApiKey && form.n8nWebhookUrl);
  const currentModelLabel =
    SUMMARIZATION_MODEL_OPTIONS.find(
      (option) => option.value === form.summarizationModel,
    )?.label ?? form.summarizationModel;

  const handleSave = () => {
    startTransition(() => {
      void (async () => {
        setIsSaving(true);

        try {
          const response = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              geminiApiKey: form.geminiApiKey,
              n8nWebhookUrl: form.n8nWebhookUrl,
              defaultFetchLimit: Number(form.defaultFetchLimit),
              defaultDigestSize: Number(form.defaultDigestSize),
              summarizationModel: form.summarizationModel,
            }),
          });

          const payload = (await response.json()) as
            | { config: AppConfig }
            | { error: string };

          if (!response.ok || "error" in payload) {
            throw new Error(
              "error" in payload ? payload.error : "Unable to save settings.",
            );
          }

          setForm({
            geminiApiKey: payload.config.geminiApiKey,
            n8nWebhookUrl: payload.config.n8nWebhookUrl,
            defaultFetchLimit: String(payload.config.defaultFetchLimit),
            defaultDigestSize: String(payload.config.defaultDigestSize),
            summarizationModel: payload.config.summarizationModel,
          });
          setFlash({ tone: "success", message: "Settings saved to Supabase." });
        } catch (error) {
          setFlash({
            tone: "error",
            message:
              error instanceof Error ? error.message : "Settings save failed.",
          });
        } finally {
          setIsSaving(false);
        }
      })();
    });
  };

  return (
    <main className="surface-grid min-h-screen text-sm">
      <AppHeader currentPage="settings" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--panel)]">
          <div className="grid divide-y divide-[color:var(--line)] md:grid-cols-[0.78fr_1.22fr] md:divide-x md:divide-y-0">
            <aside className="bg-[color:var(--panel)] p-6 md:p-8">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                    Settings / console
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
                      {mode === "live" ? "Supabase live" : "Demo preview"}
                    </span>
                    <span className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-soft">
                      {isReady ? "Ready" : "Needs setup"}
                    </span>
                  </div>
                  <h1 className="max-w-md text-3xl font-semibold tracking-[-0.06em] md:text-4xl">
                    Configuration console
                  </h1>
                  <p className="max-w-md text-sm leading-6 text-[color:var(--ink-soft)] md:text-[15px]">
                    Keep runtime defaults, routing, and model access in one
                    locked-down surface. The dashboard stays focused on runs and
                    briefing output.
                  </p>
                </div>

                <div className="grid gap-3 rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                      Scope
                    </p>
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--accent)]">
                      Supabase-backed
                    </span>
                  </div>
                  <ul className="grid gap-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                    <li>Gemini Flash credentials for summaries.</li>
                    <li>n8n routing for manual ingest runs.</li>
                    <li>Default fetch depth for manual runs.</li>
                    <li>Saved values become the runtime baseline.</li>
                  </ul>
                </div>

                <div className="grid gap-3 rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--background)] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-soft)]">
                    Operating rules
                  </p>
                  <div className="grid gap-2 text-sm leading-6 text-[color:var(--foreground)]">
                    <p>Manual trigger remains the first workflow slice.</p>
                    <p>Image processing stays off unless enabled elsewhere.</p>
                    <p>Saved config updates apply to the next run immediately.</p>
                  </div>
                </div>
              </div>
            </aside>

            <div className="bg-[color:var(--background)] p-6 md:p-8">
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
                <div className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--ink-soft)]">
                      Persisted config
                    </p>
                    <h2 className="text-2xl font-semibold tracking-[-0.05em]">
                      Workflow and model setup
                    </h2>
                    <p className="max-w-xl text-sm leading-6 text-[color:var(--ink-soft)]">
                      These values define the default operating baseline for every
                      manual ingest run.
                    </p>
                  </div>

                  <div className="grid gap-2 rounded-[0.9rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)] sm:grid-cols-2 lg:min-w-[22rem]">
                    <LiveStat label="Gemini" value={form.geminiApiKey ? "Ready" : "Missing"} />
                    <LiveStat label="Webhook" value={form.n8nWebhookUrl ? "Bound" : "Missing"} />
                    <LiveStat label="Fetch" value={form.defaultFetchLimit} />
                    <LiveStat label="Digest" value={form.defaultDigestSize} />
                    <LiveStat label="Model" value={currentModelLabel} />
                  </div>
                </div>

                <div className="grid gap-0 rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel)]">
                  <div className="grid gap-4 p-4 md:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                        Routing
                      </p>
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                        Key and webhook
                      </span>
                    </div>

                    <label className="grid gap-2">
                      <span className="font-medium">Gemini API key</span>
                      <input
                        value={form.geminiApiKey}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            geminiApiKey: event.target.value,
                          }))
                        }
                        placeholder="AIza..."
                        className="h-11 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--background)] px-3 font-mono text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]/30"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="font-medium">n8n URL or webhook URL</span>
                      <input
                        value={form.n8nWebhookUrl}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            n8nWebhookUrl: event.target.value,
                          }))
                        }
                        placeholder={LOCAL_N8N_WEBHOOK_URL}
                        className="h-11 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--background)] px-3 font-mono text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]/30"
                      />
                      <p className="text-xs leading-5 text-[color:var(--ink-soft)]">
                        You can paste the local n8n base URL, the RedditPulse
                        webhook URL, or even a local workflow page URL.
                        RedditPulse normalizes local workflow URLs to{" "}
                        {LOCAL_N8N_WEBHOOK_URL}.
                      </p>
                    </label>
                  </div>

                  <div className="border-t border-[color:var(--line)] p-4 md:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                          Defaults
                        </p>
                        <button
                          type="button"
                          title="Default fetch limit controls how many posts are fetched per subreddit. Digest size controls how many fetched posts are actually used in the digest."
                          aria-label="Explain fetch limit and digest size"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--background)] font-mono text-[10px] leading-none text-[color:var(--ink-soft)]"
                        >
                          ?
                        </button>
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                        Count-based defaults
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="font-medium">Default fetch limit</span>
                        <input
                          type="number"
                          min={5}
                          step={1}
                          value={form.defaultFetchLimit}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              defaultFetchLimit: event.target.value,
                            }))
                          }
                          className="h-11 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--background)] px-3 font-mono text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]/30"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="font-medium">Digest size</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={form.defaultDigestSize}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              defaultDigestSize: event.target.value,
                            }))
                          }
                          className="h-11 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--background)] px-3 font-mono text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]/30"
                        />
                      </label>
                    </div>

                    <label className="mt-4 grid gap-2">
                      <span className="font-medium">Summarization model</span>
                      <select
                        value={form.summarizationModel}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            summarizationModel: event.target.value,
                          }))
                        }
                        className="h-11 rounded-[0.75rem] border border-[color:var(--line)] bg-[color:var(--background)] px-3 font-mono text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)]/30"
                      >
                        {SUMMARIZATION_MODEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-xl text-sm leading-6 text-[color:var(--ink-soft)]">
                    Changes are written to Supabase and immediately reused by
                    the next manual run.
                  </p>

                  <button
                    type="submit"
                    disabled={isSaving}
                    aria-busy={isSaving}
                    className="inline-flex w-fit items-center justify-center rounded-[0.75rem] border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2.5 font-semibold text-[color:var(--background)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? "Saving..." : "Save settings"}
                  </button>
                </div>

                {flash ? (
                  <div
                    className={`border px-4 py-3 text-sm ${
                      flash.tone === "success"
                        ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/12 text-[color:var(--foreground)]"
                        : "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/12 text-[color:var(--foreground)]"
                    }`}
                  >
                    {flash.message}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="text-[color:var(--foreground)]">{value}</span>
    </div>
  );
}
