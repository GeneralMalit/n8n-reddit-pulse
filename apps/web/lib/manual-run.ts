import type { AppConfig, SubredditConfig } from "@/lib/types";

export type ManualRunPayload = {
  triggerMode: "manual";
  sourceListing: "hot";
  defaultFetchLimit: number;
  defaultSourceLimit: number;
  digestsLanguage: "en";
  debugMode: boolean;
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
  options?: {
    debugMode?: boolean;
  },
): ManualRunPayload {
  return {
    triggerMode: "manual",
    sourceListing: "hot",
    defaultFetchLimit: config.defaultFetchLimit,
    defaultSourceLimit: config.defaultSourceLimit,
    digestsLanguage: "en",
    debugMode: Boolean(options?.debugMode),
    subreddits: enabledSubreddits.map((subreddit) => ({
      id: subreddit.id,
      name: subreddit.name,
      processImages: subreddit.processImages,
    })),
  };
}

export function explainManualRunFailure(
  status: number,
  bodyText: string,
): string {
  const normalized = bodyText.toLowerCase();

  if (
    status === 404 &&
    (normalized.includes("not registered") ||
      normalized.includes("workflow must be active") ||
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
