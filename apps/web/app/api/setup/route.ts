import { NextResponse } from "next/server";
import { getSupabaseServerClient, mapConfigRow } from "@/lib/redditpulse";
import { validateN8nWebhookUrl } from "@/lib/n8n-webhook";
import {
  DEFAULT_SUMMARIZATION_MODEL,
  SUMMARIZATION_MODEL_OPTIONS,
  type SummarizationModelId,
} from "@/lib/types";

const VALID_SUMMARIZATION_MODELS = new Set<SummarizationModelId>(
  SUMMARIZATION_MODEL_OPTIONS.map((option) => option.value),
);

function normalizeSummarizationModel(
  value: string | undefined,
): SummarizationModelId {
  if (value && VALID_SUMMARIZATION_MODELS.has(value as SummarizationModelId)) {
    return value as SummarizationModelId;
  }

  return DEFAULT_SUMMARIZATION_MODEL;
}

function shouldRetryWithoutExtendedConfig(message: string | undefined) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("default_digest_size") ||
    normalized.includes("summarization_model") ||
    normalized.includes("could not find the") ||
    normalized.includes("does not exist")
  );
}

export async function POST(request: Request) {
  const client = getSupabaseServerClient();

  if (!client) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    geminiApiKey?: string;
    n8nWebhookUrl?: string;
    defaultFetchLimit?: number;
    defaultDigestSize?: number;
    summarizationModel?: string;
  };

  const geminiApiKey = body.geminiApiKey?.trim() ?? "";
  const n8nWebhookUrl = body.n8nWebhookUrl?.trim() ?? "";
  const defaultFetchLimit = Number(body.defaultFetchLimit ?? 10);
  const defaultDigestSize = Number(body.defaultDigestSize ?? 4);
  const summarizationModel = normalizeSummarizationModel(body.summarizationModel);

  if (!geminiApiKey) {
    return NextResponse.json(
      { error: "Gemini API key is required." },
      { status: 400 },
    );
  }

  if (!n8nWebhookUrl) {
    return NextResponse.json(
      { error: "n8n webhook URL is required." },
      { status: 400 },
    );
  }

  const validatedWebhook = validateN8nWebhookUrl(n8nWebhookUrl);

  if (!validatedWebhook.ok) {
    return NextResponse.json(
      { error: validatedWebhook.error },
      { status: 400 },
    );
  }

  const baseConfig = {
    singleton: true,
    gemini_api_key: geminiApiKey,
    n8n_webhook_url: validatedWebhook.url,
    default_fetch_limit: defaultFetchLimit,
  };
  const extendedConfig = {
    ...baseConfig,
    default_digest_size: defaultDigestSize,
    summarization_model: summarizationModel,
  };

  let saveResult = await client
    .from("app_config")
    .upsert(extendedConfig, { onConflict: "singleton" })
    .select()
    .single();

  if (saveResult.error && shouldRetryWithoutExtendedConfig(saveResult.error.message)) {
    saveResult = await client
      .from("app_config")
      .upsert(baseConfig, { onConflict: "singleton" })
      .select()
      .single();
  }

  const { data, error } = saveResult;

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to save setup config." },
      { status: 500 },
    );
  }

  return NextResponse.json({ config: mapConfigRow(data) });
}
