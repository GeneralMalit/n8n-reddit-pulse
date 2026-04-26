// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardApp } from "@/components/dashboard-app";
import type { DashboardData } from "@/lib/types";

const refreshSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshSpy,
  }),
}));

vi.mock("@/components/app-header", () => ({
  AppHeader: () => <header data-testid="app-header" />,
}));

vi.mock("@/components/flash-toast", () => ({
  FlashToast: () => null,
}));

vi.mock("@/components/latest-briefing", () => ({
  LatestBriefing: () => <section data-testid="latest-briefing" />,
}));

describe("DashboardApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("replaces the optimistic run with the persisted dashboard snapshot after a run completes", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        message: "Manual run sent to n8n.",
        subredditCount: 1,
        dashboard: {
          mode: "live",
          config: {
            geminiApiKey: "key",
            n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
            defaultFetchLimit: 10,
            defaultDigestSize: 4,
            summarizationModel: "gemma-4-31b-it",
          },
          subreddits: [
            {
              id: "sub-1",
              name: "rantandventph",
              enabled: true,
              processImages: true,
              createdAt: "2026-04-22T00:00:00.000Z",
            },
          ],
          runs: [
            {
              id: "run-1",
              status: "succeeded",
              sourceListing: "hot",
              triggeredAt: "2026-04-22T00:00:00.000Z",
              completedAt: "2026-04-22T00:10:00.000Z",
              totalSubreddits: 1,
              notes: "Workflow completed.",
              digests: [],
            },
          ],
        } satisfies DashboardData,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardApp
        initialData={{
          mode: "live",
          config: {
            geminiApiKey: "key",
            n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
            defaultFetchLimit: 10,
            defaultDigestSize: 4,
            summarizationModel: "gemma-4-31b-it",
          },
          subreddits: [
            {
              id: "sub-1",
              name: "rantandventph",
              enabled: true,
              processImages: true,
              createdAt: "2026-04-22T00:00:00.000Z",
            },
          ],
          runs: [],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByText(/succeeded/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Apr 22/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
