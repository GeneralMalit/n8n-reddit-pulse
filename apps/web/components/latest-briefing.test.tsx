// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LatestBriefing } from "@/components/latest-briefing";
import type { RunRecord } from "@/lib/types";

const run: RunRecord = {
  id: "run-1",
  status: "succeeded",
  sourceListing: "hot",
  triggeredAt: "2026-04-22T00:00:00.000Z",
  completedAt: "2026-04-22T00:10:00.000Z",
  totalSubreddits: 1,
  notes: "Debug mode seeded this digest.",
  digests: [
    {
      id: "digest-1",
      subredditId: "sub-1",
      subredditName: "offmychest",
      headline: "Quiet thread, strong signal",
      summary:
        "A short summary of the latest useful discussion.\n\nA second paragraph should render separately in the card.",
      imageContextUsed: true,
      sourceCount: 2,
      sources: [
        {
          id: "source-1",
          title: "Source post one",
          author: "alice",
          permalink: "https://reddit.com/r/offmychest/comments/1",
          score: 42,
          commentCount: 8,
          previewImageUrl: null,
          isImagePost: false,
          sortRank: 1,
        },
        {
          id: "source-2",
          title: "Screenshot post",
          author: "bob",
          permalink: "https://reddit.com/r/offmychest/comments/2",
          score: 17,
          commentCount: 3,
          previewImageUrl: "https://example.com/preview.jpg",
          isImagePost: true,
          sortRank: 2,
        },
      ],
    },
  ],
};

const multiDigestRun: RunRecord = {
  ...run,
  digests: [
    ...run.digests,
    {
      id: "digest-2",
      subredditId: "sub-2",
      subredditName: "askreddit",
      headline: "Second card for masonry flow",
      summary: "Another digest paragraph for layout coverage.",
      imageContextUsed: false,
      sourceCount: 1,
      sources: [],
    },
  ],
};

describe("LatestBriefing", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the empty state when there is no run", () => {
    render(<LatestBriefing run={null} />);

    expect(screen.getByText("No run yet")).toBeInTheDocument();
    expect(
      screen.getByText(/trigger a manual run to populate the briefing cards here/i),
    ).toBeInTheDocument();
  });

  it("renders briefing cards and image thumbnails without the old run wrapper", () => {
    render(<LatestBriefing run={run} />);

    expect(
      screen.getByRole("heading", { name: /current briefing output/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/the latest run only\. each selected subreddit lands as one compact/i),
    ).toBeNull();
    expect(screen.queryByText(/latest only/i)).toBeNull();
    expect(screen.queryByText(/subreddit briefings from hot/i)).toBeNull();
    expect(
      screen.getByRole("heading", { name: /quiet thread, strong signal/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Image-assisted")).toBeNull();
    expect(screen.queryByText("Text-only")).toBeNull();
    expect(
      screen.getByRole("link", { name: /source post one/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /screenshot post/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a short summary of the latest useful discussion/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a second paragraph should render separately in the card/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /preview image for screenshot post/i,
      }),
    ).toHaveAttribute(
      "src",
      "/api/preview-image?url=https%3A%2F%2Fexample.com%2Fpreview.jpg",
    );
  });

  it("renders a single digest without the two-column masonry wrapper classes", () => {
    const { container } = render(<LatestBriefing run={run} />);

    expect(container.innerHTML).not.toContain("md:columns-2");
  });

  it("uses the two-column masonry wrapper when multiple digests are present", () => {
    const { container } = render(<LatestBriefing run={multiDigestRun} />);

    expect(container.innerHTML).toContain("md:columns-2");
  });
});
