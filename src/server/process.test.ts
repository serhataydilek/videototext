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

it("stops a child producing excessive stdout", async () => {
  await expect(runCommand(process.execPath, ["-e", "console.log('x'.repeat(4096))"], { maxStdoutBytes: 1024 }))
    .rejects.toThrow("stdout size limit");
});

it("passes shell metacharacters as literal arguments", async () => {
  const value = "hello; echo injected & $(whoami)";
  const result = await runCommand(process.execPath, ["-e", "console.log(process.argv[1])", value]);
  expect(result.stdout.trim()).toBe(value);
});

it("does not launch an already aborted command", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(runCommand(process.execPath, ["-e", "process.exit(0)"], { signal: controller.signal })).rejects.toThrow();
});
