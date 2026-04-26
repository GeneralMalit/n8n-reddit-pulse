import { NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  loadDashboardDataFromClient,
  mapConfigRow,
  mapSubredditRow,
} from "@/lib/redditpulse";
import {
  buildManualRunPayload,
  explainManualRunFailure,
  redactManualRunDashboardSecrets,
} from "@/lib/manual-run";

type ConfigRow = {
  singleton: boolean;
  gemini_api_key: string;
  n8n_webhook_url: string;
  default_fetch_limit: number;
};

type SubredditRow = {
  id: string;
  name: string;
  enabled: boolean;
  process_images: boolean;
  created_at: string;
};

type RunStatusRow = {
  id: string;
  status: string;
  notes: string | null;
  triggered_at: string;
  completed_at: string | null;
};

async function waitForRunCompletion(
  client: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  runId: string,
  timeoutMs = 240_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await client
      .from("runs")
      .select("id,status,notes,triggered_at,completed_at")
      .eq("id", runId)
      .maybeSingle<RunStatusRow>();

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (result.data && result.data.status !== "running") {
      return result.data;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  return null;
}

export async function POST() {
  const attemptId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const client = getSupabaseServerClient();

  if (!client) {
    console.error("[manual-run]", attemptId, "Supabase is not configured");

    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local.",
      },
      { status: 503 },
    );
  }

  const [configResult, subredditResult] = await Promise.all([
    client.from("app_config").select("*").eq("singleton", true).single(),
    client
      .from("subreddit_configs")
      .select("*")
      .eq("enabled", true)
      .order("created_at", { ascending: false }),
  ]);

  if (configResult.error || !configResult.data) {
    console.error("[manual-run]", attemptId, "config lookup failed", {
      error: configResult.error?.message,
    });

    return NextResponse.json(
      { error: configResult.error?.message ?? "Unable to load app config." },
      { status: 500 },
    );
  }

  if (subredditResult.error) {
    console.error("[manual-run]", attemptId, "subreddit lookup failed", {
      error: subredditResult.error.message,
    });

    return NextResponse.json(
      { error: subredditResult.error.message ?? "Unable to load subreddits." },
      { status: 500 },
    );
  }

  const config = mapConfigRow(configResult.data as ConfigRow);
  const enabledSubreddits = (subredditResult.data as SubredditRow[]).map(
    mapSubredditRow,
  );
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!config.n8nWebhookUrl) {
    console.warn("[manual-run]", attemptId, "missing webhook url");

    return NextResponse.json(
      { error: "Save an n8n webhook URL before starting a run." },
      { status: 400 },
    );
  }

  if (enabledSubreddits.length === 0) {
    console.warn("[manual-run]", attemptId, "no enabled subreddits");

    return NextResponse.json(
      { error: "Enable at least one subreddit before starting a run." },
      { status: 409 },
    );
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[manual-run]", attemptId, "missing server-side secrets");

    return NextResponse.json(
      {
        error:
          "Supabase server credentials are missing from apps/web/.env.local.",
      },
      { status: 503 },
    );
  }

  if (!config.geminiApiKey) {
    console.warn("[manual-run]", attemptId, "missing gemini key in config");

    return NextResponse.json(
      { error: "Save a Gemini API key before starting a run." },
      { status: 400 },
    );
  }

  const payload = buildManualRunPayload(
    config,
    enabledSubreddits,
    {
      supabaseUrl,
      supabaseServiceRoleKey,
      geminiApiKey: config.geminiApiKey,
    },
    {
      runId,
    },
  );

  console.info("[manual-run]", attemptId, "dispatching run", {
    webhookUrl: config.n8nWebhookUrl,
    subredditCount: enabledSubreddits.length,
    defaultFetchLimit: config.defaultFetchLimit,
  });

  try {
    const response = await fetch(config.n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const bodyText = await response.text();

    if (!response.ok) {
      const error = explainManualRunFailure(response.status, bodyText);

      console.error("[manual-run]", attemptId, "dispatch failed", {
        status: response.status,
        bodyText,
      });

      return NextResponse.json(
        {
          error,
          details: bodyText || null,
          status: response.status,
        },
        { status: 502 },
      );
    }

    console.info("[manual-run]", attemptId, "dispatch accepted");

    const completedRun = await waitForRunCompletion(client, runId);

    if (!completedRun) {
      console.error("[manual-run]", attemptId, "run timed out", { runId });

      return NextResponse.json(
        {
          error:
            "n8n accepted the run but it did not finish within the API wait window.",
          runId,
        },
        { status: 504 },
      );
    }

    const dashboard = await loadDashboardDataFromClient(client);
    const safeDashboard = redactManualRunDashboardSecrets(dashboard);

    if (completedRun.status !== "succeeded") {
      console.error("[manual-run]", attemptId, "run finished unsuccessfully", {
        runId,
        status: completedRun.status,
      });

      return NextResponse.json(
        {
          error: `n8n accepted the run but it finished with status ${completedRun.status}.`,
          runId,
          status: completedRun.status,
          dashboard: safeDashboard,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Manual run completed in n8n.",
      runId,
      status: completedRun.status,
      subredditCount: enabledSubreddits.length,
      dashboard: safeDashboard,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach the n8n webhook.";

    console.error("[manual-run]", attemptId, "dispatch threw", { message });

    return NextResponse.json(
      {
        error:
          "Unable to reach the n8n webhook. Make sure the local n8n server is running and try again.",
        details: message,
      },
      { status: 502 },
    );
  }
}
