export const SUMMARIZATION_MODEL_OPTIONS = [
  { label: "gemini 3.0 flash", value: "gemini-3-flash-preview" },
  { label: "gemma 4 31b", value: "gemma-4-31b-it" },
  { label: "gemma 3 27b", value: "gemma-3-27b-it" },
  { label: "gemini 2.5 flash", value: "gemini-2.5-flash" },
] as const;

export type SummarizationModelId =
  (typeof SUMMARIZATION_MODEL_OPTIONS)[number]["value"];

export const DEFAULT_SUMMARIZATION_MODEL: SummarizationModelId =
  "gemma-4-31b-it";

export type AppConfig = {
  geminiApiKey: string;
  n8nWebhookUrl: string;
  defaultFetchLimit: number;
  defaultDigestSize: number;
  summarizationModel: SummarizationModelId;
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

export type SettingsData = {
  mode: "demo" | "live";
  config: AppConfig;
};
