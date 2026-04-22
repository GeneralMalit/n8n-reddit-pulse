import { NextResponse } from "next/server";
import { getSupabaseServerClient, mapSubredditRow } from "@/lib/redditpulse";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
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

  const { id } = await params;
  const body = (await request.json()) as {
    enabled?: boolean;
    processImages?: boolean;
  };

  const updates: Record<string, boolean> = {};

  if (typeof body.enabled === "boolean") {
    updates.enabled = body.enabled;
  }

  if (typeof body.processImages === "boolean") {
    updates.process_images = body.processImages;
  }

  const { data, error } = await client
    .from("subreddit_configs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to update subreddit." },
      { status: 500 },
    );
  }

  return NextResponse.json({ subreddit: mapSubredditRow(data) });
}

export async function DELETE(_request: Request, { params }: Params) {
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

  const { id } = await params;
  const { error } = await client.from("subreddit_configs").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Unable to delete subreddit." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
