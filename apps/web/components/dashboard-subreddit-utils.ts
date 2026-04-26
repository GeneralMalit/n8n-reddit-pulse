import type { SubredditConfig } from "@/lib/types";

export function normalizeSubredditName(value: string) {
  return value.trim().replace(/^r\//i, "");
}

export function prependSubreddit(
  subreddits: SubredditConfig[],
  subreddit: SubredditConfig,
) {
  return [subreddit, ...subreddits];
}

export function replaceSubreddit(
  subreddits: SubredditConfig[],
  subreddit: SubredditConfig,
) {
  return subreddits.map((item) => (item.id === subreddit.id ? subreddit : item));
}

export function removeSubredditById(
  subreddits: SubredditConfig[],
  id: string,
) {
  return subreddits.filter((item) => item.id !== id);
}
