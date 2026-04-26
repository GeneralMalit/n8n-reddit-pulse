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

vi.mock("@/lib/redditpulse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redditpulse")>();

  return {
    ...actual,
    getSupabaseServerClient,
    mapConfigRow,
    mapSubredditRow,
  };
});

import { POST } from "@/app/api/runs/route";

function createMockClient(
  configRow: unknown,
  subredditRows: unknown[],
  runRows = [
    {
      id: "run-1",
      status: "succeeded",
      source_listing: "hot",
      triggered_at: "2026-04-22T00:00:00.000Z",
      completed_at: "2026-04-22T00:10:00.000Z",
      total_subreddits: 1,
      notes: "Workflow completed.",
    },
  ],
) {
  const digestRows = [
    {
      id: "digest-1",
      run_id: "run-1",
      subreddit_config_id: "sub-1",
      subreddit_name: "rantandventph",
      headline: "Test headline",
      summary: "Test summary",
      image_context_used: true,
      source_count: 1,
    },
  ];
  const sourceRows = [
    {
      id: "source-1",
      digest_id: "digest-1",
      title: "Source title",
      author: "alice",
      permalink: "https://reddit.com/r/rantandventph/comments/1",
      score: 10,
      comment_count: 2,
      preview_image_url: null,
      is_image_post: false,
      sort_rank: 1,
    },
  ];

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

      if (table === "runs") {
        let runIndex = 0;
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: vi.fn().mockImplementation(async () => {
            const row = runRows[Math.min(runIndex, runRows.length - 1)] ?? null;
            runIndex += 1;

            return {
              data: row,
              error: null,
            };
          }),
        };
      }

      if (table === "run_digests") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order: vi.fn().mockResolvedValue({
            data: digestRows,
            error: null,
          }),
        };
      }

      if (table === "digest_sources") {
        return {
          select() {
            return this;
          },
          in() {
            return this;
          },
          order: vi.fn().mockResolvedValue({
            data: sourceRows,
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
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.clearAllMocks();

    mapConfigRow.mockImplementation((row) => ({
      geminiApiKey: row.gemini_api_key,
      n8nWebhookUrl: row.n8n_webhook_url,
      defaultFetchLimit: row.default_fetch_limit,
      defaultDigestSize: row.default_digest_size,
      summarizationModel: row.summarization_model,
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
    vi.unstubAllEnvs();
  });

  it("returns a friendly error when n8n says the webhook is inactive", async () => {
    getSupabaseServerClient.mockReturnValue(
      createMockClient(
        {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 10,
          default_digest_size: 4,
          summarization_model: "gemma-4-31b-it",
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
          default_digest_size: 4,
          summarization_model: "gemma-4-31b-it",
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
      new Request("http://localhost/api/runs", { method: "POST" }),
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
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"runId":"');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"name":"rantandventph"');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"defaultFetchLimit":10');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"defaultSourceLimit":4');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"defaultDigestSize":4');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(
      '"summarizationModel":"gemma-4-31b-it"',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(
      '"secrets":{"supabaseUrl":"https://project.supabase.co"',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(
      '"supabaseServiceRoleKey":"service-role-key"',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(
      '"geminiApiKey":"test-key"',
    );
    expect(payload.dashboard).toMatchObject({
      mode: "live",
      config: {
        geminiApiKey: "",
      },
      runs: [
        {
          id: "run-1",
          status: "succeeded",
        },
      ],
    });
    expect(payload.runId).toBeTypeOf("string");
    expect(payload.status).toBe("succeeded");
    expect(JSON.stringify(payload)).not.toContain("service-role-key");
  });

  it("returns a non-200 response when the exact run finishes failed", async () => {
    getSupabaseServerClient.mockReturnValue(
      createMockClient(
        {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 10,
          default_digest_size: 4,
          summarization_model: "gemma-4-31b-it",
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
        [
          {
            id: "run-1",
            status: "failed",
            notes: "Failed: Gemini quota reached.",
            triggered_at: "2026-04-22T00:00:00.000Z",
            completed_at: "2026-04-22T00:02:00.000Z",
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
      new Request("http://localhost/api/runs", { method: "POST" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.status).toBe("failed");
    expect(payload.runId).toBeTypeOf("string");
  });

  it("returns 504 when the exact run stays running past the wait window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T00:00:00.000Z"));

    getSupabaseServerClient.mockReturnValue(
      createMockClient(
        {
          singleton: true,
          gemini_api_key: "test-key",
          n8n_webhook_url: "http://localhost:5678/webhook/redditpulse-manual",
          default_fetch_limit: 10,
          default_digest_size: 4,
          summarization_model: "gemma-4-31b-it",
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
        [
          {
            id: "run-1",
            status: "running",
            notes: null,
            triggered_at: "2026-04-22T00:00:00.000Z",
            completed_at: null,
          },
        ],
      ),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    const responsePromise = POST(
      new Request("http://localhost/api/runs", { method: "POST" }),
    );
    await vi.advanceTimersByTimeAsync(242_000);
    const response = await responsePromise;
    const payload = await response.json();

    expect(response.status).toBe(504);
    expect(payload.runId).toBeTypeOf("string");
    vi.useRealTimers();
  });
});
