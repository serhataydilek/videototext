import type { JobSnapshot } from "@/lib/types";
import { getEmitter, getJob } from "@/server/jobs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  const job = getJob(id);
  const emitter = getEmitter(id);

  if (!job || !emitter) {
    return new Response("Job not found.", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, snapshot: JobSnapshot) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(snapshot)}\n\n`)
        );
      };

      const onSnapshot = (snapshot: JobSnapshot) => send("snapshot", snapshot);
      const onDone = (snapshot: JobSnapshot) => {
        send("done", snapshot);
        cleanup();
        controller.close();
      };
      const onError = (snapshot: JobSnapshot) => {
        send("failed", snapshot);
        cleanup();
        controller.close();
      };
      const cleanup = () => {
        emitter.off("snapshot", onSnapshot);
        emitter.off("done", onDone);
        emitter.off("failed", onError);
      };

      emitter.on("snapshot", onSnapshot);
      emitter.on("done", onDone);
      emitter.on("failed", onError);
      send("snapshot", job);

      if (job.status === "completed") {
        onDone(job);
      } else if (job.status === "failed") {
        onError(job);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
