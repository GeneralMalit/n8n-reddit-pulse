import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSupabaseServerClient,
  mapConfigRow,
  mapSubredditRow,
} = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  mapConfigRow: vi.fn(),
  mapSubredditRow: vi.fn(),
}));

vi.mock("@/lib/redditpulse", () => ({
  getSupabaseServerClient,
  mapConfigRow,
  mapSubredditRow,
}));

import { POST } from "@/app/api/runs/route";

function createMockClient(configRow: unknown, subredditRows: unknown[]) {
  return {
    from(table: string) {
      if (table === "app_config") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: vi.fn().mockResolvedValue({
            data: configRow,
            error: null,
          }),
        };
      }

      if (table === "subreddit_configs") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order: vi.fn().mockResolvedValue({
            data: subredditRows,
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("POST /api/runs", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.clearAllMocks();

    mapConfigRow.mockImplementation((row) => ({
      geminiApiKey: row.gemini_api_key,
      n8nWebhookUrl: row.n8n_webhook_url,
      defaultFetchLimit: row.default_fetch_limit,
      defaultSourceLimit: row.default_source_limit,
    }));

    mapSubredditRow.mockImplementation((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      processImages: row.process_images,
      createdAt: row.created_at,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a friendly error when n8n says the webhook is inactive", async () => {
    getSupabaseServerClient.mockReturnValue(
      createMockClient(
        {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 10,
          default_source_limit: 4,
        },
        [
          {
            id: "sub-1",
            name: "rantandventph",
            enabled: true,
            process_images: true,
            created_at: "2026-04-22T00:00:00.000Z",
          },
        ],
      ),
    );

    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: vi
        .fn()
        .mockResolvedValue(
          'The requested webhook "POST redditpulse-manual" is not registered.',
        ),
    });

    const response = await POST(
      new Request("http://localhost/api/runs", { method: "POST" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("Activate the workflow in n8n");
  });

  it("dispatches the expected payload to n8n when the setup is valid", async () => {
    getSupabaseServerClient.mockReturnValue(
      createMockClient(
        {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 10,
          default_source_limit: 4,
        },
        [
          {
            id: "sub-1",
            name: "rantandventph",
            enabled: true,
            process_images: true,
            created_at: "2026-04-22T00:00:00.000Z",
          },
        ],
      ),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debugMode: true }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5678/webhook/redditpulse-manual",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"triggerMode":"manual"');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"name":"rantandventph"');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"debugMode":true');
  });
});
