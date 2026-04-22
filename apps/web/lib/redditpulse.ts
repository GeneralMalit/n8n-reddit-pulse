import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { demoDashboardData } from "@/lib/demo-data";
import type {
  AppConfig,
  DashboardData,
  DigestRecord,
  DigestSource,
  RunRecord,
  SubredditConfig,
} from "@/lib/types";

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
    geminiApiKey: row.gemini_api_key,
    n8nWebhookUrl: row.n8n_webhook_url,
    defaultFetchLimit: row.default_fetch_limit,
    defaultSourceLimit: row.default_source_limit,
  };
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

export const loadDashboardData = cache(async (): Promise<DashboardData> => {
  const client = getSupabaseServerClient();

  if (!client) {
    return demoDashboardData;
  }

  const [configResult, subredditResult, latestRunResult] = await Promise.all([
    client.from("app_config").select("*").eq("singleton", true).single(),
    client
      .from("subreddit_configs")
      .select("*")
      .order("created_at", { ascending: false }),
    client
      .from("runs")
      .select("*")
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (configResult.error || subredditResult.error || !configResult.data) {
    return demoDashboardData;
  }

  let latestRuns: RunRecord[] = [];

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

      latestRuns = [mapRunRow(latestRun, digests, sources)];
    }
  }

  return {
    mode: "live",
    config: mapConfigRow(configResult.data as ConfigRow),
    subreddits: (subredditResult.data as SubredditRow[]).map(mapSubredditRow),
    runs: latestRuns,
  };
});
