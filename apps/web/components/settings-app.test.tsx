// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsApp } from "@/components/settings-app";
import { DEFAULT_SUMMARIZATION_MODEL } from "@/lib/types";

describe("SettingsApp", () => {
  it("saves config through the setup API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        config: {
          geminiApiKey: "new-key",
          n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
          defaultFetchLimit: 12,
          defaultDigestSize: 5,
          summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <SettingsApp
        initialConfig={{
          geminiApiKey: "old-key",
          n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
          defaultFetchLimit: 10,
          defaultDigestSize: 4,
          summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
        }}
        mode="live"
      />,
    );

    await user.clear(screen.getByLabelText("Gemini API key"));
    await user.type(screen.getByLabelText("Gemini API key"), "new-key");
    const fetchLimitInput = screen.getByRole("spinbutton", {
      name: "Default fetch limit",
    });
    const digestSizeInput = screen.getByRole("spinbutton", {
      name: "Digest size",
    });

    await user.clear(fetchLimitInput);
    await user.type(fetchLimitInput, "12");
    await user.clear(digestSizeInput);
    await user.type(digestSizeInput, "5");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Summarization model" }),
      "gemma-4-31b-it",
    );
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/setup",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      defaultFetchLimit: 12,
      defaultDigestSize: 5,
      summarizationModel: "gemma-4-31b-it",
    });
    expect(
      await screen.findByText("Settings saved to Supabase."),
    ).toBeInTheDocument();
    expect(screen.getByText("Supabase live")).toBeInTheDocument();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
