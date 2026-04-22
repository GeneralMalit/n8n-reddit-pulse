import { NextResponse } from "next/server";
import { getSupabaseServerClient, mapSubredditRow } from "@/lib/redditpulse";

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

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim().replace(/^r\//i, "") ?? "";

  if (!name) {
    return NextResponse.json(
      { error: "Subreddit name is required." },
      { status: 400 },
    );
  }

  const { data, error } = await client
    .from("subreddit_configs")
    .insert({
      name: name.toLowerCase(),
      enabled: true,
      process_images: false,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to add subreddit." },
      { status: 500 },
    );
  }

  return NextResponse.json({ subreddit: mapSubredditRow(data) });
}
