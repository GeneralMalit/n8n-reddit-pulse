import { describe, expect, it } from "vitest";
import {
  buildManualRunPayload,
  explainManualRunFailure,
} from "@/lib/manual-run";

describe("manual-run helpers", () => {
  it("builds the expected webhook payload from live config", () => {
    const payload = buildManualRunPayload(
      {
        geminiApiKey: "test-key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultSourceLimit: 4,
      },
      [
        {
          id: "sub-1",
          name: "rantandventph",
          enabled: true,
          processImages: true,
          createdAt: "2026-04-22T00:00:00.000Z",
        },
      ],
    );

    expect(payload).toEqual({
      triggerMode: "manual",
      sourceListing: "hot",
      defaultFetchLimit: 10,
      defaultSourceLimit: 4,
      digestsLanguage: "en",
      debugMode: false,
      subreddits: [
        {
          id: "sub-1",
          name: "rantandventph",
          processImages: true,
        },
      ],
    });
  });

  it("includes debug mode when explicitly enabled", () => {
    const payload = buildManualRunPayload(
      {
        geminiApiKey: "test-key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultSourceLimit: 4,
      },
      [
        {
          id: "sub-1",
          name: "rantandventph",
          enabled: true,
          processImages: true,
          createdAt: "2026-04-22T00:00:00.000Z",
        },
      ],
      { debugMode: true },
    );

    expect(payload.debugMode).toBe(true);
  });

  it("maps inactive webhook failures to a friendly message", () => {
    expect(
      explainManualRunFailure(
        404,
        'The requested webhook "POST redditpulse-manual" is not registered.',
      ),
    ).toContain("Activate the workflow in n8n");
  });

  it("maps Gemini quota failures to a quota-specific message", () => {
    expect(
      explainManualRunFailure(429, "Quota exceeded for model gemini-3-flash-preview"),
    ).toContain("Gemini quota limits");
  });
});
