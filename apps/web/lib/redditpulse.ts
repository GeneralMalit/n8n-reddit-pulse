import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { demoDashboardData } from "@/lib/demo-data";
import {
  DEFAULT_SUMMARIZATION_MODEL,
  SUMMARIZATION_MODEL_OPTIONS,
  type AppConfig,
  type DashboardData,
  type DigestRecord,
  type DigestSource,
  type RunRecord,
  type SettingsData,
  type SubredditConfig,
  type SummarizationModelId,
} from "@/lib/types";

type ConfigRow = {
  singleton: boolean;
  gemini_api_key: string;
  n8n_webhook_url: string;
  default_fetch_limit: number;
  default_digest_size?: number | null;
  summarization_model?: string | null;
};

type SubredditRow = {
  id: string;
  name: string;
  enabled: boolean;
  process_images: boolean;
  created_at: string;
};

type RunRow = {
  id: string;
  status: "running" | "succeeded" | "failed";
  source_listing: string;
  triggered_at: string;
  completed_at: string | null;
  total_subreddits: number;
  notes: string | null;
};

type DigestRow = {
  id: string;
  run_id: string;
  subreddit_config_id: string | null;
  subreddit_name: string;
  headline: string;
  summary: string;
  image_context_used: boolean;
  source_count: number;
};

type SourceRow = {
  id: string;
  digest_id: string;
  title: string;
  author: string;
  permalink: string;
  score: number;
  comment_count: number;
  preview_image_url: string | null;
  is_image_post: boolean;
  sort_rank: number;
};

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

const DEFAULT_APP_CONFIG: AppConfig = {
  geminiApiKey: "",
  n8nWebhookUrl: "",
  defaultFetchLimit: 10,
  defaultDigestSize: 4,
  summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
};

const VALID_SUMMARIZATION_MODELS = new Set(
  SUMMARIZATION_MODEL_OPTIONS.map((option) => option.value),
);

function normalizeSummarizationModel(
  value: string | null | undefined,
): SummarizationModelId {
  if (typeof value === "string" && VALID_SUMMARIZATION_MODELS.has(value as SummarizationModelId)) {
    return value as SummarizationModelId;
  }

  return DEFAULT_SUMMARIZATION_MODEL;
}

function normalizeCount(value: unknown, fallback: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const roundedValue = Math.trunc(numericValue);
  return roundedValue > 0 ? roundedValue : fallback;
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabaseServerClient() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function mapConfigRow(row: ConfigRow): AppConfig {
  return {
    geminiApiKey: row.gemini_api_key ?? DEFAULT_APP_CONFIG.geminiApiKey,
    n8nWebhookUrl: row.n8n_webhook_url ?? DEFAULT_APP_CONFIG.n8nWebhookUrl,
    defaultFetchLimit: normalizeCount(
      row.default_fetch_limit,
      DEFAULT_APP_CONFIG.defaultFetchLimit,
    ),
    defaultDigestSize: normalizeCount(
      row.default_digest_size,
      DEFAULT_APP_CONFIG.defaultDigestSize,
    ),
    summarizationModel: normalizeSummarizationModel(row.summarization_model),
  };
}

function sanitizeDashboardConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    geminiApiKey: "",
  };
}

async function loadConfig(client: SupabaseClient) {
  const configResult = await client
    .from("app_config")
    .select("*")
    .eq("singleton", true)
    .single();

  if (configResult.error || !configResult.data) {
    return null;
  }

  return mapConfigRow(configResult.data as ConfigRow);
}

export function mapSubredditRow(row: SubredditRow): SubredditConfig {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    processImages: row.process_images,
    createdAt: row.created_at,
  };
}

function mapSourceRow(row: SourceRow): DigestSource {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    permalink: row.permalink,
    score: row.score,
    commentCount: row.comment_count,
    previewImageUrl: row.preview_image_url,
    isImagePost: row.is_image_post,
    sortRank: row.sort_rank,
  };
}

function mapDigestRow(row: DigestRow, sources: SourceRow[]): DigestRecord {
  return {
    id: row.id,
    subredditId: row.subreddit_config_id,
    subredditName: row.subreddit_name,
    headline: row.headline,
    summary: row.summary,
    imageContextUsed: row.image_context_used,
    sourceCount: row.source_count,
    sources: sources
      .filter((source) => source.digest_id === row.id)
      .sort((left, right) => left.sort_rank - right.sort_rank)
      .map(mapSourceRow),
  };
}

function mapRunRow(
  row: RunRow,
  digests: DigestRow[],
  sources: SourceRow[],
): RunRecord {
  return {
    id: row.id,
    status: row.status,
    sourceListing: row.source_listing,
    triggeredAt: row.triggered_at,
    completedAt: row.completed_at,
    totalSubreddits: row.total_subreddits,
    notes: row.notes,
    digests: digests
      .filter((digest) => digest.run_id === row.id)
      .map((digest) => mapDigestRow(digest, sources)),
  };
}

async function loadLatestRuns(client: SupabaseClient): Promise<RunRecord[]> {
  const latestRunResult = await client
    .from("runs")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRunResult.error && latestRunResult.data) {
    const latestRun = latestRunResult.data as RunRow;
    const digestResult = await client
      .from("run_digests")
      .select("*")
      .eq("run_id", latestRun.id)
      .order("created_at", { ascending: false });

    if (!digestResult.error) {
      const digests = digestResult.data as DigestRow[];
      const digestIds = digests.map((digest) => digest.id);
      let sources: SourceRow[] = [];

      if (digestIds.length > 0) {
        const sourceResult = await client
          .from("digest_sources")
          .select("*")
          .in("digest_id", digestIds)
          .order("sort_rank", { ascending: true });

        if (!sourceResult.error) {
          sources = sourceResult.data as SourceRow[];
        }
      }

      return [mapRunRow(latestRun, digests, sources)];
    }
  }

  return [];
}

export async function loadDashboardDataFromClient(
  client: SupabaseClient,
): Promise<DashboardData> {
  const [config, subredditResult, runs] = await Promise.all([
    loadConfig(client),
    client
      .from("subreddit_configs")
      .select("*")
      .order("created_at", { ascending: false }),
    loadLatestRuns(client),
  ]);

  if (!config || subredditResult.error) {
    return demoDashboardData;
  }

  return {
    mode: "live",
    config: sanitizeDashboardConfig(config),
    subreddits: (subredditResult.data as SubredditRow[]).map(mapSubredditRow),
    runs,
  };
}

export const loadDashboardData = cache(async (): Promise<DashboardData> => {
  const client = getSupabaseServerClient();

  if (!client) {
    return demoDashboardData;
  }

  return loadDashboardDataFromClient(client);
});

export const loadSettingsData = cache(async (): Promise<SettingsData> => {
  const client = getSupabaseServerClient();

  if (!client) {
    return {
      mode: demoDashboardData.mode,
      config: demoDashboardData.config,
    };
  }

  const config = await loadConfig(client);

  if (!config) {
    return {
      mode: demoDashboardData.mode,
      config: demoDashboardData.config,
    };
  }

  return {
    mode: "live",
    config,
  };
});
