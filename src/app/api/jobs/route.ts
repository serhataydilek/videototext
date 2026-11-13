import { NextResponse } from "next/server";
import { youtubeUrlSchema } from "@/lib/youtube";
import { createJob } from "@/server/jobs/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // Next may reconstruct request.url with localhost even when the browser uses
  // 127.0.0.1. Compare the actual Host, and reject DNS-rebinding hostnames.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const allowedHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  if (!allowedHost || (origin && origin !== `${new URL(request.url).protocol}//${host}`)) {
    return NextResponse.json({ error: "Cross-origin job requests are not allowed." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Send an application/json request." }, { status: 415 });
  }
  const body = await request.json().catch(() => null);
  const parsed = youtubeUrlSchema.safeParse(body?.url);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid YouTube video URL." },
      { status: 400 }
    );
  }

  const job = createJob(parsed.data);
  return NextResponse.json({ job }, { status: 202 });
}
