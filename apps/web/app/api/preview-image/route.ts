import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizePreviewTarget(raw: string | null) {
  if (!raw) {
    return null;
  }

  const decoded = raw
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");

  if (!decoded) {
    return null;
  }

  try {
    const url = new URL(decoded);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const target = normalizePreviewTarget(
    request.nextUrl.searchParams.get("url"),
  );

  if (!target) {
    return NextResponse.json({ error: "Invalid preview URL." }, { status: 400 });
  }

  let upstream: Response;

  try {
    upstream = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 RedditPulse Preview Proxy",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "force-cache",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to fetch preview image." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Preview image upstream rejected the request." },
      { status: upstream.status },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";

  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Preview URL did not return an image." },
      { status: 415 },
    );
  }

  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
