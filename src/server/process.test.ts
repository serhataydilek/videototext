import { expect, it } from "vitest";
import { runCommand } from "./process";

it("aborts an active child and rejects after its streams close", async () => {
  const controller = new AbortController();
  const command = runCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { signal: controller.signal });
  controller.abort();
  await expect(command).rejects.toThrow("Interrupted");
});

it("reports a subprocess timeout", async () => {
  await expect(runCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeoutMs: 100 }))
    .rejects.toThrow("timed out");
});
