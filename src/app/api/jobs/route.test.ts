import { beforeEach, expect, it, vi } from "vitest";
import { createJob } from "../../../server/jobs/store";
import { POST } from "./route";

vi.mock("../../../server/jobs/store", () => ({ createJob: vi.fn(() => ({ id: "job_test" })) }));
beforeEach(() => vi.clearAllMocks());

it("rejects cross-origin and form requests before starting a process", async () => {
  for (const [headers, status] of [
    [{ origin: "https://example.org", "content-type": "application/json" }, 403],
    [{ "content-type": "text/plain" }, 415]
  ] as const) {
    const response = await POST(new Request("http://localhost:3000/api/jobs", {
      method: "POST", headers, body: JSON.stringify({ url: "https://youtu.be/jNQXAC9IVRw" })
    }));
    expect(response.status).toBe(status);
    expect(createJob).not.toHaveBeenCalled();
  }
});

it("accepts same-origin JSON and rejects invalid URLs", async () => {
  for (const [url, status] of [["https://youtu.be/jNQXAC9IVRw", 202], ["https://example.org", 400]] as const) {
    const response = await POST(new Request("http://localhost:3000/api/jobs", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ url })
    }));
    expect(response.status).toBe(status);
  }
  expect(createJob).toHaveBeenCalledTimes(1);
});

it("uses the browser Host when Next reconstructs the URL with localhost", async () => {
  const response = await POST(new Request("http://localhost:3000/api/jobs", {
    method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "content-type": "application/json" },
    body: JSON.stringify({ url: "https://youtu.be/jNQXAC9IVRw" })
  }));
  expect(response.status).toBe(202);
});

it("rejects a non-loopback hostname even if Origin matches", async () => {
  const response = await POST(new Request("http://localhost:3000/api/jobs", {
    method: "POST", headers: { host: "example.org:3000", origin: "http://example.org:3000", "content-type": "application/json" },
    body: JSON.stringify({ url: "https://youtu.be/jNQXAC9IVRw" })
  }));
  expect(response.status).toBe(403);
  expect(createJob).not.toHaveBeenCalled();
});
