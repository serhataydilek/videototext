import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import { getEmitter, getJob } from "../../../../../server/jobs/store";
import type { JobSnapshot } from "../../../../../lib/types";
import { GET } from "./route";

vi.mock("../../../../../server/jobs/store", () => ({ getEmitter: vi.fn(), getJob: vi.fn() }));
let emitter: EventEmitter;
const job = { id: "job_test", status: "running" } as JobSnapshot;
beforeEach(() => {
  emitter = new EventEmitter();
  vi.mocked(getEmitter).mockReturnValue(emitter);
  vi.mocked(getJob).mockReturnValue(job);
});
const context = { params: Promise.resolve({ id: "job_test" }) };

it("removes listeners when a client cancels its event stream", async () => {
  const response = await GET(new Request("http://localhost/api/jobs/job_test/events"), context);
  expect(emitter.listenerCount("snapshot")).toBe(1);
  await response.body!.cancel();
  expect(emitter.eventNames()).toEqual([]);
  expect(() => emitter.emit("snapshot", job)).not.toThrow();
});

it("removes listeners on request abort and closes the stream", async () => {
  const controller = new AbortController();
  const response = await GET(new Request("http://localhost/api/jobs/job_test/events", { signal: controller.signal }), context);
  controller.abort();
  expect(emitter.eventNames()).toEqual([]);
  expect(await response.text()).toContain("event: snapshot");
});

it("sends a terminal result and removes listeners", async () => {
  const response = await GET(new Request("http://localhost/api/jobs/job_test/events"), context);
  emitter.emit("done", { ...job, status: "completed" });
  expect(await response.text()).toContain("event: done");
  expect(emitter.eventNames()).toEqual([]);
});
