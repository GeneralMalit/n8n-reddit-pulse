// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardHero } from "@/components/dashboard-hero";
import type { RunRecord, SubredditConfig } from "@/lib/types";

const subreddits: SubredditConfig[] = [
  {
    id: "sub-1",
    name: "offmychest",
    enabled: true,
    processImages: false,
    createdAt: "2026-04-22T00:00:00.000Z",
  },
];

const run: RunRecord = {
  id: "run-1",
  status: "succeeded",
  sourceListing: "hot",
  triggeredAt: "2026-04-22T00:00:00.000Z",
  completedAt: "2026-04-22T00:10:00.000Z",
  totalSubreddits: 1,
  notes: null,
  digests: [],
};

describe("DashboardHero", () => {
  it("renders run/debug controls and supports adding a subreddit", async () => {
    const user = userEvent.setup();
    const addSpy = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardHero
        subreddits={subreddits}
        latestRun={run}
        runState="idle"
        isTriggeringRun={false}
        onSetFlash={vi.fn()}
        onTriggerRun={vi.fn()}
        onAddSubreddit={addSpy}
        onPatchSubreddit={vi.fn()}
        onDeleteSubreddit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: /open subreddit roster/i })[0]!,
    );
    expect(screen.getByPlaceholderText("r/AskReddit")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("r/AskReddit"), "rantandventph");
    await user.click(screen.getByRole("button", { name: "Add subreddit" }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith("rantandventph");
    });
  });

  it("opens the roster modal and exposes direct toggle chips", async () => {
    const user = userEvent.setup();

    render(
      <DashboardHero
        subreddits={subreddits}
        latestRun={run}
        runState="idle"
        isTriggeringRun={false}
        onSetFlash={vi.fn()}
        onTriggerRun={vi.fn()}
        onAddSubreddit={vi.fn().mockResolvedValue(undefined)}
        onPatchSubreddit={vi.fn()}
        onDeleteSubreddit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(
      screen.getAllByRole("button", { name: /open subreddit roster/i })[0]!,
    );
    expect(
      screen.getByRole("dialog", { name: /subreddit roster/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disable r/offmychest" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Enable images for r/offmychest" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getAllByRole("button", { name: "Remove r/offmychest" })[0],
    ).toBeInTheDocument();
  });

  it("closes the roster modal on escape", async () => {
    const user = userEvent.setup();

    render(
      <DashboardHero
        subreddits={subreddits}
        latestRun={run}
        runState="idle"
        isTriggeringRun={false}
        onSetFlash={vi.fn()}
        onTriggerRun={vi.fn()}
        onAddSubreddit={vi.fn().mockResolvedValue(undefined)}
        onPatchSubreddit={vi.fn()}
        onDeleteSubreddit={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(
      screen.getAllByRole("button", { name: /open subreddit roster/i })[0]!,
    );
    expect(
      screen.getByRole("dialog", { name: /subreddit roster/i }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: /subreddit roster/i }),
    ).not.toBeInTheDocument();
  });
});
