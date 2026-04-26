import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { loadDashboardData } = vi.hoisted(() => ({
  loadDashboardData: vi.fn(),
}));

const dashboardProps: Array<unknown> = [];

vi.mock("@/lib/redditpulse", () => ({
  loadDashboardData,
}));

vi.mock("@/components/dashboard-app", () => ({
  DashboardApp: (props: unknown) => {
    dashboardProps.push(props);
    return <div>mock-dashboard</div>;
  },
}));

import Home from "@/app/page";

describe("app/page", () => {
  it("loads dashboard data and passes it to the dashboard app", async () => {
    const data = {
      mode: "live" as const,
      config: {
        geminiApiKey: "key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultDigestSize: 4,
        summarizationModel: "gemma-4-31b-it",
      },
      subreddits: [],
      runs: [],
    };

    loadDashboardData.mockResolvedValue(data);

    const page = await Home();
    renderToStaticMarkup(page);

    expect(loadDashboardData).toHaveBeenCalled();
    expect(dashboardProps[0]).toEqual({ initialData: data });
  });
});
