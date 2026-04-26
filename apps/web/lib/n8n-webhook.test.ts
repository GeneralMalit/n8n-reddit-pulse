import { describe, expect, it } from "vitest";
import { LOCAL_N8N_WEBHOOK_URL, validateN8nWebhookUrl } from "@/lib/n8n-webhook";

describe("n8n webhook helpers", () => {
  it("accepts the local webhook URL", () => {
    expect(validateN8nWebhookUrl(LOCAL_N8N_WEBHOOK_URL)).toEqual({
      ok: true,
      url: LOCAL_N8N_WEBHOOK_URL,
    });
  });

  it("normalizes workflow editor URLs into the webhook URL", () => {
    expect(
      validateN8nWebhookUrl(
        "http://localhost:5678/workflow/redditpulse-manual-run",
      ),
    ).toEqual({
      ok: true,
      url: LOCAL_N8N_WEBHOOK_URL,
    });
  });

  it("normalizes the local base URL into the webhook URL", () => {
    expect(validateN8nWebhookUrl("http://localhost:5678")).toEqual({
      ok: true,
      url: LOCAL_N8N_WEBHOOK_URL,
    });
  });

  it("rejects unrelated non-webhook paths with a clear setup hint", () => {
    const result = validateN8nWebhookUrl(
      "http://localhost:5678/rest/executions",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("local n8n");
    }
  });
});
