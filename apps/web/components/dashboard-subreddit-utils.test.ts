import { describe, expect, it } from "vitest";
import {
  normalizeSubredditName,
  prependSubreddit,
  removeSubredditById,
  replaceSubreddit,
} from "@/components/dashboard-subreddit-utils";
import type { SubredditConfig } from "@/lib/types";

const subreddit: SubredditConfig = {
  id: "sub-1",
  name: "offmychest",
  enabled: true,
  processImages: false,
  createdAt: "2026-04-22T00:00:00.000Z",
};

describe("dashboard subreddit utils", () => {
  it("normalizes subreddit names from the hero composer", () => {
    expect(normalizeSubredditName(" r/OffMyChest ")).toBe("OffMyChest");
  });

  it("prepends a newly added subreddit", () => {
    expect(prependSubreddit([subreddit], { ...subreddit, id: "sub-2" })).toEqual([
      { ...subreddit, id: "sub-2" },
      subreddit,
    ]);
  });

  it("replaces one subreddit without mutating the rest", () => {
    expect(
      replaceSubreddit([subreddit], { ...subreddit, processImages: true }),
    ).toEqual([{ ...subreddit, processImages: true }]);
  });

  it("removes a subreddit by id", () => {
    expect(removeSubredditById([subreddit], subreddit.id)).toEqual([]);
  });
});
