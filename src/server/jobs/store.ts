import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { JobSnapshot } from "@/lib/types";
import { processJob } from "./worker";

type JobRecord = {
  snapshot: JobSnapshot;
  emitter: EventEmitter;
};

const globalJobStore = globalThis as typeof globalThis & {
  youtubeVideoToTextJobs?: Map<string, JobRecord>;
};

const jobs = (globalJobStore.youtubeVideoToTextJobs ??= new Map<string, JobRecord>());

export function createJob(url: string): JobSnapshot {
  const id = `job_${randomUUID()}`;
  const now = new Date().toISOString();
  const snapshot: JobSnapshot = {
    id,
    status: "queued",
    progress: 0,
    stage: "queued",
    message: "Waiting to start.",
    createdAt: now,
    updatedAt: now
  };

  const record = { snapshot, emitter: new EventEmitter() };
  record.emitter.setMaxListeners(100);
  jobs.set(id, record);

  queueMicrotask(() => {
    processJob(id, url).catch((error) => {
      failJob(id, error instanceof Error ? error.message : "The job failed unexpectedly.");
    });
  });

  return snapshot;
}

export function getJob(id: string): JobSnapshot | undefined {
  return jobs.get(id)?.snapshot;
}

export function getEmitter(id: string): EventEmitter | undefined {
  return jobs.get(id)?.emitter;
}

export function updateJob(
  id: string,
  patch: Partial<Omit<JobSnapshot, "id" | "createdAt">>
): JobSnapshot {
  const record = jobs.get(id);
  if (!record) {
    throw new Error(`Unknown job ${id}.`);
  }

  record.snapshot = {
    ...record.snapshot,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  record.emitter.emit("snapshot", record.snapshot);
  return record.snapshot;
}

export function completeJob(id: string, result: JobSnapshot["result"]): JobSnapshot {
  const snapshot = updateJob(id, {
    status: "completed",
    progress: 1,
    stage: "completed",
    message: "Transcript and summary are ready.",
    result
  });
  jobs.get(id)?.emitter.emit("done", snapshot);
  return snapshot;
}

export function failJob(id: string, error: string): JobSnapshot {
  const snapshot = updateJob(id, {
    status: "failed",
    stage: "failed",
    message: error,
    error
  });
  jobs.get(id)?.emitter.emit("failed", snapshot);
  return snapshot;
}
