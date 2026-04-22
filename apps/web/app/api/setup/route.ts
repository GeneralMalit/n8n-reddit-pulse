import { NextResponse } from "next/server";
import { getSupabaseServerClient, mapConfigRow } from "@/lib/redditpulse";

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
    defaultSourceLimit?: number;
  };

  const geminiApiKey = body.geminiApiKey?.trim() ?? "";
  const n8nWebhookUrl = body.n8nWebhookUrl?.trim() ?? "";
  const defaultFetchLimit = Number(body.defaultFetchLimit ?? 10);
  const defaultSourceLimit = Number(body.defaultSourceLimit ?? 4);

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

  const { data, error } = await client
    .from("app_config")
    .upsert(
      {
        singleton: true,
        gemini_api_key: geminiApiKey,
        n8n_webhook_url: n8nWebhookUrl,
        default_fetch_limit: defaultFetchLimit,
        default_source_limit: defaultSourceLimit,
      },
      { onConflict: "singleton" },
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to save setup config." },
      { status: 500 },
    );
  }

  return NextResponse.json({ config: mapConfigRow(data) });
}
