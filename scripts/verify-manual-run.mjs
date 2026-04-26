import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), "apps", "web", ".env.local");
const appBaseUrl = process.env.REDDITPULSE_APP_URL ?? "http://localhost:3000";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing env file: ${filePath}`);
  }

  const contents = fs.readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabaseHeaders = {
  apikey: supabaseServiceRoleKey,
  Authorization: `Bearer ${supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function supabaseGet(relativePath) {
  const response = await fetch(`${supabaseUrl}${relativePath}`, {
    headers: supabaseHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Supabase GET failed for ${relativePath}: ${response.status} ${await response.text()}`,
    );
  }

  return response.json();
}

async function supabasePost(relativePath, body) {
  const response = await fetch(`${supabaseUrl}${relativePath}`, {
    method: "POST",
    headers: supabaseHeaders,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase POST failed for ${relativePath}: ${response.status} ${text}`,
    );
  }

  return text ? JSON.parse(text) : null;
}

async function loadAppConfig() {
  const rows = await supabaseGet(
    "/rest/v1/app_config?select=*&singleton=eq.true&limit=1",
  );

  const row = rows[0] ?? null;
  assert(row, "Missing app_config singleton row.");

  return {
    geminiApiKey: String(row.gemini_api_key ?? "").trim(),
    n8nWebhookUrl: String(row.n8n_webhook_url ?? "").trim(),
    defaultFetchLimit: Number(row.default_fetch_limit ?? 10),
  };
}

async function loadEnabledSubreddits() {
  const rows = await supabaseGet(
    "/rest/v1/subreddit_configs?select=id,name,enabled,process_images&enabled=eq.true&order=created_at.desc",
  );

  return rows
    .map((row) => ({
      id: String(row.id ?? "").trim(),
      name: String(row.name ?? "").trim().replace(/^r\//i, ""),
      processImages: Boolean(row.process_images),
    }))
    .filter((row) => row.id && row.name);
}

async function triggerAppRun() {
  const response = await fetch(`${appBaseUrl}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const bodyText = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = bodyText;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: parsed,
    };
  }

  return {
    ok: true,
    status: response.status,
    body: parsed,
  };
}

async function triggerWebhookRun(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const bodyText = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = bodyText;
  }

  if (!response.ok) {
    throw new Error(`Webhook run failed: ${response.status} ${bodyText}`);
  }

  return {
    status: response.status,
    body: parsed,
  };
}

async function waitForCompletedRun(runId, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const rows = await supabaseGet(
      `/rest/v1/runs?select=id,status,notes,triggered_at,completed_at&id=eq.${runId}&limit=1`,
    );
    const run = rows[0] ?? null;

    if (run && run.status !== "running") {
      return run;
    }

    await sleep(2000);
  }

  throw new Error(`Timed out waiting for run ${runId} to finish.`);
}

async function digestsForRun(runId) {
  return supabaseGet(
    `/rest/v1/run_digests?select=id,subreddit_name,headline,summary,image_context_used,source_count&run_id=eq.${runId}&order=created_at.asc`,
  );
}

async function sourcesForDigests(digestIds) {
  if (digestIds.length === 0) {
    return [];
  }

  const encodedIds = digestIds.map((id) => `"${id}"`).join(",");

  return supabaseGet(
    `/rest/v1/digest_sources?select=digest_id,title,author,permalink,sort_rank&digest_id=in.(${encodedIds})&order=sort_rank.asc`,
  );
}

function buildManualRunPayload(config, subreddits, secrets, options = {}) {
  return {
    runId: String(options.runId ?? "").trim(),
    triggerMode: "manual",
    sourceListing: "hot",
    defaultFetchLimit: config.defaultFetchLimit,
    defaultSourceLimit: 4,
    digestsLanguage: "en",
    secrets,
    subreddits: subreddits.map((subreddit) => ({
      id: subreddit.id,
      name: subreddit.name,
      processImages: subreddit.processImages,
    })),
    ...(options.debugMode === undefined ? {} : { debugMode: options.debugMode }),
  };
}

function summarizeDigests(digests) {
  return digests.map((digest) => ({
    subreddit: digest.subreddit_name,
    headline: digest.headline,
    summary: digest.summary,
    imageContextUsed: digest.image_context_used,
    sourceCount: digest.source_count,
  }));
}

const appConfig = await loadAppConfig();
const enabledSubreddits = await loadEnabledSubreddits();

assert(appConfig.geminiApiKey, "Missing Gemini API key in app_config.");
assert(appConfig.n8nWebhookUrl, "Missing n8n webhook URL in app_config.");
assert(enabledSubreddits.length > 0, "No enabled subreddits are configured.");

const secrets = {
  supabaseUrl,
  supabaseServiceRoleKey,
  geminiApiKey: appConfig.geminiApiKey,
};

const appRunResult = await triggerAppRun();
const appRunId = String(appRunResult.body?.runId ?? "").trim();

assert(appRunId, "App-triggered run did not include a runId.");

const appCompletedRun = await waitForCompletedRun(appRunId);
const appDigests = await digestsForRun(appRunId);
const appDigestIds = appDigests.map((digest) => digest.id);
const appSources = await sourcesForDigests(appDigestIds);
const appSourceCountsByDigest = new Map();

for (const source of appSources) {
  const digestId = String(source.digest_id ?? "");
  appSourceCountsByDigest.set(
    digestId,
    (appSourceCountsByDigest.get(digestId) ?? 0) + 1,
  );
}

const appDigestHasDebugHeadline = appDigests.some((digest) =>
  String(digest.headline ?? "").startsWith("Debug digest for r/"),
);
const observedMoreThanFiveSources = appDigests.some(
  (digest) => (appSourceCountsByDigest.get(String(digest.id ?? "")) ?? 0) > 5,
);

const debugRunPayload = buildManualRunPayload(
  appConfig,
  enabledSubreddits,
  secrets,
  {
    runId: crypto.randomUUID(),
    debugMode: true,
  },
);

const debugWebhookResult = await triggerWebhookRun(
  appConfig.n8nWebhookUrl,
  debugRunPayload,
);

const debugRunId = String(debugWebhookResult.body?.runId ?? debugRunPayload.runId).trim();
assert(debugRunId, "Debug webhook run did not include a runId.");

const debugCompletedRun = await waitForCompletedRun(debugRunId);
const debugDigests = await digestsForRun(debugRunId);
const debugDigestIds = debugDigests.map((digest) => digest.id);
const debugSources = await sourcesForDigests(debugDigestIds);
const debugSourceCountsByDigest = new Map();

for (const source of debugSources) {
  const digestId = String(source.digest_id ?? "");
  debugSourceCountsByDigest.set(
    digestId,
    (debugSourceCountsByDigest.get(digestId) ?? 0) + 1,
  );
}

for (const digest of debugDigests) {
  assert(
    String(digest.headline ?? "").startsWith("Debug digest for r/"),
    `Debug run digest ${digest.id} did not use the seeded debug headline.`,
  );
}

for (const digest of appDigests) {
  if (String(digest.headline ?? "").startsWith("Debug digest for r/")) {
    throw new Error(
      `App-triggered run ${appRunId} still used a debug headline when debugMode was omitted.`,
    );
  }

  const summary = String(digest.summary ?? "").trim();
  const paragraphCount = summary
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
  const persistedSourceCount =
    appSourceCountsByDigest.get(String(digest.id ?? "")) ?? 0;

  assert(
    paragraphCount === Math.max(1, persistedSourceCount),
    `App-triggered digest ${digest.id} did not include one paragraph per persisted source.`,
  );
  assert(summary.length > 0, `App-triggered digest ${digest.id} summary was empty.`);
}

for (const digest of debugDigests) {
  const summary = String(digest.summary ?? "").trim();
  const paragraphCount = summary
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
  const persistedSourceCount =
    debugSourceCountsByDigest.get(String(digest.id ?? "")) ?? 0;

  assert(
    paragraphCount === Math.max(1, persistedSourceCount),
    `Debug digest ${digest.id} did not keep one paragraph per persisted source.`,
  );
}

const appResult = {
  runId: appRunId,
  status: appCompletedRun.status,
  notes: appCompletedRun.notes ?? null,
  digests: summarizeDigests(appDigests),
  sourceCount: appSources.length,
};

const debugResult = {
  runId: debugRunId,
  status: debugCompletedRun.status,
  notes: debugCompletedRun.notes ?? null,
  digests: summarizeDigests(debugDigests),
  sourceCount: debugSources.length,
};

console.log(
  JSON.stringify(
    {
      ok: true,
      appRun: appResult,
      debugRun: debugResult,
      omittedDebugModeDefaultsToLive: !appDigestHasDebugHeadline,
      observedMoreThanFiveSources,
      blockedByQuota:
        appResult.status !== "succeeded" &&
        String(appResult.notes ?? "").toLowerCase().includes("quota"),
    },
    null,
    2,
  ),
);
