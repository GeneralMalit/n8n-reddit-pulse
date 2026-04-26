import { LOCAL_N8N_WEBHOOK_URL } from "@/lib/n8n-webhook";
import type { AppConfig, DashboardData, SubredditConfig } from "@/lib/types";

export type ManualRunPayload = {
  runId: string;
  triggerMode: "manual";
  sourceListing: "hot";
  defaultFetchLimit: number;
  defaultSourceLimit: number;
  defaultDigestSize: number;
  digestsLanguage: "en";
  summarizationModel: AppConfig["summarizationModel"];
  secrets: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    geminiApiKey: string;
  };
  subreddits: Array<{
    id: string;
    name: string;
    processImages: boolean;
  }>;
};

export type StoredManualRunContext = {
  config: AppConfig;
  enabledSubreddits: SubredditConfig[];
};

export function buildManualRunPayload(
  config: AppConfig,
  enabledSubreddits: SubredditConfig[],
  secrets: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    geminiApiKey: string;
  },
  options?: {
    runId?: string;
  },
): ManualRunPayload {
  return {
    runId: String(options?.runId ?? "").trim(),
    triggerMode: "manual",
    sourceListing: "hot",
    defaultFetchLimit: config.defaultFetchLimit,
    defaultSourceLimit: config.defaultDigestSize,
    defaultDigestSize: config.defaultDigestSize,
    digestsLanguage: "en",
    summarizationModel: config.summarizationModel,
    secrets,
    subreddits: enabledSubreddits.map((subreddit) => ({
      id: subreddit.id,
      name: subreddit.name,
      processImages: subreddit.processImages,
    })),
  };
}

export function redactManualRunDashboardSecrets(
  dashboard: DashboardData,
): DashboardData {
  return {
    ...dashboard,
    config: {
      ...dashboard.config,
      geminiApiKey: "",
    },
  };
}

export function explainManualRunFailure(
  status: number,
  bodyText: string,
): string {
  const normalized = bodyText.toLowerCase();

  if (
    status === 404 &&
    (normalized.includes("without permissions") ||
      normalized.includes("could not load the workflow") ||
      normalized.includes("you can only access workflows owned by you"))
  ) {
    return `The saved URL points to an n8n workflow page, not the webhook. Save ${LOCAL_N8N_WEBHOOK_URL.replace("/webhook/redditpulse-manual", "")} or ${LOCAL_N8N_WEBHOOK_URL} in the setup screen.`;
  }

  if (
    status === 404 &&
    (normalized.includes("not registered") ||
      normalized.includes("workflow must be active"))
  ) {
    return "n8n has not registered the production webhook yet. Activate the workflow in n8n and try again.";
  }

  if (status === 429 && normalized.includes("quota")) {
    return "The workflow reached Gemini quota limits. Update billing or try a key with available quota.";
  }

  if (status >= 500) {
    return "n8n accepted the request but failed before completing the run.";
  }

  if (bodyText.trim()) {
    return bodyText;
  }

  return "n8n webhook request failed.";
}
