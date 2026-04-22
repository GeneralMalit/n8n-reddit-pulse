export type AppConfig = {
  geminiApiKey: string;
  n8nWebhookUrl: string;
  defaultFetchLimit: number;
  defaultSourceLimit: number;
  debugMode?: boolean;
};

export type SubredditConfig = {
  id: string;
  name: string;
  enabled: boolean;
  processImages: boolean;
  createdAt: string;
};

export type DigestSource = {
  id: string;
  title: string;
  author: string;
  permalink: string;
  score: number;
  commentCount: number;
  previewImageUrl: string | null;
  isImagePost: boolean;
  sortRank: number;
};

export type DigestRecord = {
  id: string;
  subredditId: string | null;
  subredditName: string;
  headline: string;
  summary: string;
  imageContextUsed: boolean;
  sourceCount: number;
  sources: DigestSource[];
};

export type RunRecord = {
  id: string;
  status: "running" | "succeeded" | "failed";
  sourceListing: string;
  triggeredAt: string;
  completedAt: string | null;
  totalSubreddits: number;
  notes: string | null;
  digests: DigestRecord[];
};

export type DashboardData = {
  mode: "demo" | "live";
  config: AppConfig;
  subreddits: SubredditConfig[];
  runs: RunRecord[];
};
