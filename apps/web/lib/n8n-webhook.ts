export const LOCAL_N8N_BASE_URL = "http://localhost:5678";
export const REDDITPULSE_N8N_WEBHOOK_PATH = "/webhook/redditpulse-manual";
export const LOCAL_N8N_WEBHOOK_URL = `${LOCAL_N8N_BASE_URL}${REDDITPULSE_N8N_WEBHOOK_PATH}`;

function normalizeWebhookPath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "/";
}

export function validateN8nWebhookUrl(rawValue: string): {
  ok: true;
  url: string;
} | {
  ok: false;
  error: string;
} {
  const value = rawValue.trim();

  if (!value) {
    return {
      ok: false,
      error: `n8n webhook URL is required. Use ${LOCAL_N8N_WEBHOOK_URL}.`,
    };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      error: `Enter a full n8n webhook URL such as ${LOCAL_N8N_WEBHOOK_URL}.`,
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      error: `Use an http or https webhook URL such as ${LOCAL_N8N_WEBHOOK_URL}.`,
    };
  }

  const normalizedPath = normalizeWebhookPath(url.pathname);
  const looksLikeWorkflowPage =
    /(^|\/)(workflow|workflows|editor)(\/|$)/.test(normalizedPath) ||
    normalizedPath === "/" ||
    normalizedPath === "";

  const normalizedUrl = new URL(url.toString());

  if (
    looksLikeWorkflowPage ||
    normalizedPath === "/webhook-test/redditpulse-manual"
  ) {
    normalizedUrl.pathname = REDDITPULSE_N8N_WEBHOOK_PATH;
    normalizedUrl.search = "";
    normalizedUrl.hash = "";

    return {
      ok: true,
      url: normalizedUrl.toString(),
    };
  }

  if (!normalizedPath.startsWith("/webhook")) {
    return {
      ok: false,
      error: `Use the n8n base URL, the RedditPulse webhook URL, or a workflow page URL that RedditPulse can normalize. For local n8n, ${LOCAL_N8N_BASE_URL} is enough.`,
    };
  }

  normalizedUrl.pathname = normalizedPath;

  return {
    ok: true,
    url: normalizedUrl.toString(),
  };
}
