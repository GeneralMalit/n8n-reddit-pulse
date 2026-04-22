import { NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  mapConfigRow,
  mapSubredditRow,
} from "@/lib/redditpulse";
import {
  buildManualRunPayload,
  explainManualRunFailure,
} from "@/lib/manual-run";

type ConfigRow = {
  singleton: boolean;
  gemini_api_key: string;
  n8n_webhook_url: string;
  default_fetch_limit: number;
  default_source_limit: number;
};

type SubredditRow = {
  id: string;
  name: string;
  enabled: boolean;
  process_images: boolean;
  created_at: string;
};

export async function POST(request: Request) {
  const attemptId = crypto.randomUUID();
  const client = getSupabaseServerClient();
  let requestBody: { debugMode?: boolean } = {};

  try {
    requestBody = (await request.json()) as { debugMode?: boolean };
  } catch {
    requestBody = {};
  }

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

  const payload = buildManualRunPayload(config, enabledSubreddits, {
    debugMode: requestBody.debugMode,
  });

  console.info("[manual-run]", attemptId, "dispatching run", {
    webhookUrl: config.n8nWebhookUrl,
    subredditCount: enabledSubreddits.length,
    defaultFetchLimit: config.defaultFetchLimit,
    defaultSourceLimit: config.defaultSourceLimit,
    debugMode: payload.debugMode,
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

    return NextResponse.json({
      ok: true,
      message: "Manual run sent to n8n.",
      subredditCount: enabledSubreddits.length,
      debugMode: payload.debugMode,
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
