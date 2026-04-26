import { describe, expect, it } from "vitest";
import { DEFAULT_SUMMARIZATION_MODEL } from "@/lib/types";
import {
  buildManualRunPayload,
  explainManualRunFailure,
  redactManualRunDashboardSecrets,
} from "@/lib/manual-run";

describe("manual-run helpers", () => {
  it("builds the expected webhook payload from live config", () => {
    const payload = buildManualRunPayload(
      {
        geminiApiKey: "test-key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultDigestSize: 4,
        summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
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
      {
        supabaseUrl: "https://project.supabase.co",
        supabaseServiceRoleKey: "service-role-key",
        geminiApiKey: "test-key",
      },
    );

    expect(payload).toEqual({
      runId: "",
      triggerMode: "manual",
      sourceListing: "hot",
      defaultFetchLimit: 10,
      defaultSourceLimit: 4,
      defaultDigestSize: 4,
      digestsLanguage: "en",
      summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
      secrets: {
        supabaseUrl: "https://project.supabase.co",
        supabaseServiceRoleKey: "service-role-key",
        geminiApiKey: "test-key",
      },
      subreddits: [
        {
          id: "sub-1",
          name: "rantandventph",
          processImages: true,
        },
      ],
    });
  });

  it("includes an explicit run id when provided", () => {
    const payload = buildManualRunPayload(
      {
        geminiApiKey: "test-key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultDigestSize: 4,
        summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
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
      {
        supabaseUrl: "https://project.supabase.co",
        supabaseServiceRoleKey: "service-role-key",
        geminiApiKey: "test-key",
      },
      { runId: "run-123" },
    );

    expect(payload.runId).toBe("run-123");
  });

  it("redacts the Gemini key before the dashboard snapshot returns to the browser", () => {
    const dashboard = redactManualRunDashboardSecrets({
      mode: "live",
      config: {
        geminiApiKey: "test-key",
        n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
        defaultFetchLimit: 10,
        defaultDigestSize: 4,
        summarizationModel: DEFAULT_SUMMARIZATION_MODEL,
      },
      subreddits: [],
      runs: [],
    });

    expect(dashboard.config.geminiApiKey).toBe("");
  });

  it("maps inactive webhook failures to a friendly message", () => {
    expect(
      explainManualRunFailure(
        404,
        'The requested webhook "POST redditpulse-manual" is not registered.',
      ),
    ).toContain("Activate the workflow in n8n");
  });

  it("maps workflow permission failures to the correct webhook guidance", () => {
    expect(
      explainManualRunFailure(
        404,
        "404 Could not load the workflow - you can only access workflows owned by you",
      ),
    ).toContain("workflow page");
  });

  it("maps Gemini quota failures to a quota-specific message", () => {
    expect(
      explainManualRunFailure(429, "Quota exceeded for model gemini-3-flash-preview"),
    ).toContain("Gemini quota limits");
  });
});
