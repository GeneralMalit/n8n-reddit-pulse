import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { loadSettingsData } = vi.hoisted(() => ({
  loadSettingsData: vi.fn(),
}));

const settingsProps: Array<unknown> = [];

vi.mock("@/lib/redditpulse", () => ({
  loadSettingsData,
}));

vi.mock("@/components/settings-app", () => ({
  SettingsApp: (props: unknown) => {
    settingsProps.push(props);
    return <div>mock-settings</div>;
  },
}));

import SettingsPage from "@/app/settings/page";

describe("app/settings/page", () => {
  it("loads settings data and passes config to the settings app", async () => {
    const data = {
      mode: "live" as const,
      config: {
        geminiApiKey: "key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultDigestSize: 4,
        summarizationModel: "gemma-4-31b-it",
      },
    };

    loadSettingsData.mockResolvedValue(data);

    const page = await SettingsPage();
    renderToStaticMarkup(page);

    expect(loadSettingsData).toHaveBeenCalled();
    expect(settingsProps[0]).toEqual({
      initialConfig: data.config,
      mode: data.mode,
    });
  });
});
