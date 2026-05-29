import { NextResponse } from "next/server";
import { youtubeUrlSchema } from "@/lib/youtube";
import { createJob } from "@/server/jobs/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
