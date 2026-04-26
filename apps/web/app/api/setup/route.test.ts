import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClient, mapConfigRow } = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  mapConfigRow: vi.fn(),
}));

vi.mock("@/lib/redditpulse", () => ({
  getSupabaseServerClient,
  mapConfigRow,
}));

import { POST } from "@/app/api/setup/route";

describe("POST /api/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapConfigRow.mockImplementation((row) => ({
      geminiApiKey: row.gemini_api_key,
      n8nWebhookUrl: row.n8n_webhook_url,
      defaultFetchLimit: row.default_fetch_limit,
      defaultDigestSize: row.default_digest_size ?? 4,
      summarizationModel: row.summarization_model ?? "gemma-4-31b-it",
    }));
  });

  it("normalizes workflow editor URLs into the webhook before save", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select() {
        return this;
      },
      single: vi.fn().mockResolvedValue({
        data: {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 12,
          default_digest_size: 5,
          summarization_model: "gemma-4-31b-it",
        },
        error: null,
      }),
    });

    getSupabaseServerClient.mockReturnValue({
      from() {
        return {
          upsert: upsertMock,
        };
      },
    });

    const response = await POST(
      new Request("http://localhost/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: "test-key",
          n8nWebhookUrl: "http://localhost:5678/workflow/redditpulse-manual-run",
          defaultFetchLimit: 12,
          defaultDigestSize: 5,
          summarizationModel: "gemma-4-31b-it",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
        default_fetch_limit: 12,
        default_digest_size: 5,
        summarization_model: "gemma-4-31b-it",
      }),
      expect.objectContaining({ onConflict: "singleton" }),
    );
  });

  it("stores the local webhook URL when the setup is valid", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select() {
        return this;
      },
      single: vi.fn().mockResolvedValue({
        data: {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 10,
          default_digest_size: 4,
          summarization_model: "gemma-4-31b-it",
        },
        error: null,
      }),
    });

    getSupabaseServerClient.mockReturnValue({
      from() {
        return {
          upsert: upsertMock,
        };
      },
    });

    const response = await POST(
      new Request("http://localhost/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: "test-key",
          n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
          defaultFetchLimit: 10,
          defaultDigestSize: 4,
          summarizationModel: "gemma-4-31b-it",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
        default_fetch_limit: 10,
        default_digest_size: 4,
        summarization_model: "gemma-4-31b-it",
      }),
      expect.objectContaining({ onConflict: "singleton" }),
    );
  });

  it("falls back to the legacy columns when the new columns are unavailable", async () => {
    const upsertMock = vi
      .fn()
      .mockReturnValueOnce({
        select() {
          return this;
        },
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("column app_config.default_digest_size does not exist"),
        }),
      })
      .mockReturnValueOnce({
        select() {
          return this;
        },
        single: vi.fn().mockResolvedValue({
          data: {
            singleton: true,
            gemini_api_key: "test-key",
            n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
            default_fetch_limit: 10,
          },
          error: null,
        }),
      });

    getSupabaseServerClient.mockReturnValue({
      from() {
        return {
          upsert: upsertMock,
        };
      },
    });

    const response = await POST(
      new Request("http://localhost/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: "test-key",
          n8nWebhookUrl: "http://localhost:5678/webhook/redditpulse-manual",
          defaultFetchLimit: 10,
          defaultDigestSize: 4,
          summarizationModel: "gemma-4-31b-it",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        default_digest_size: 4,
        summarization_model: "gemma-4-31b-it",
      }),
      expect.objectContaining({ onConflict: "singleton" }),
    );
    expect(upsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        default_fetch_limit: 10,
      }),
      expect.objectContaining({ onConflict: "singleton" }),
    );
  });
});
