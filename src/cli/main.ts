#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMarkdownExport, buildTxtExport } from "../lib/export";
import { youtubeUrlSchema } from "../lib/youtube";
import { checkDependencies, DependencyError, getConfig } from "../server/dependencies";
import { transcribe } from "../server/transcribe";

const usage = "videototext doctor\nvideototext transcribe YOUTUBE_URL [--format txt|md|json] [--output FILE]";
type Format = "txt" | "md" | "json";
type Command = { name: "help" } | { name: "doctor" } | {
  name: "transcribe"; url: string; format: Format; output?: string
};
class UsageError extends Error {}

export function parseArgs(args: string[]): Command {
  const [name, ...rest] = args;
  if ((name === "--help" || name === "-h") && !rest.length) return { name: "help" };
  if (name === "doctor" && !rest.length) return { name };
  if (name !== "transcribe") throw new UsageError("Expected doctor or transcribe.");

  let url: string | undefined;
  let format: Format | undefined;
  let output: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--format" || arg === "--output") {
      const value = rest[++i];
      if (!value?.trim() || value.startsWith("-")) throw new UsageError(`Missing value for ${arg}.`);
      if (arg === "--format") {
        if (format || (value !== "txt" && value !== "md" && value !== "json")) {
          throw new UsageError("Specify --format once with txt, md or json.");
        }
        format = value;
      } else {
        if (output) throw new UsageError("Specify --output once.");
        output = value;
      }
    } else {
      if (arg.startsWith("-")) throw new UsageError(`Unknown option: ${arg}`);
      if (url) throw new UsageError("Supply exactly one YouTube video URL.");
      url = arg;
    }
  }
  const parsed = youtubeUrlSchema.safeParse(url);
  if (!parsed.success) throw new UsageError("Enter a valid YouTube video URL.");
  return { name, url: parsed.data, format: format ?? "txt", output };
}

async function saveOutput(file: string, content: string, signal: AbortSignal) {
  // A failed or interrupted write must leave an existing export intact.
  const temporary = path.join(path.dirname(file), `.videototext-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { flag: "wx", signal });
    signal.throwIfAborted();
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function runCli(args: string[], signal: AbortSignal): Promise<number> {
  try {
    const command = parseArgs(args);
    if (command.name === "help") {
      console.log(usage);
      return 0;
    }
    try {
      process.loadEnvFile(path.resolve(__dirname, "../../.env.local"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (command.name === "doctor") {
      const checks = await checkDependencies(getConfig(), signal);
      for (const check of checks) console.log(`[${check.ok ? "ok" : "failed"}] ${check.message}`);
      return checks.every((check) => check.ok) ? 0 : 3;
    }
    const result = await transcribe(`job_${randomUUID()}`, command.url, (step) => {
      console.error(`[${Math.round(step.progress * 100)}%] ${step.message}`);
    }, signal);
    signal.throwIfAborted();
    const render = { txt: buildTxtExport, md: buildMarkdownExport, json: (data: typeof result) => JSON.stringify(data, null, 2) };
    const content = render[command.format](result);
    if (command.output) {
      await saveOutput(command.output, content + "\n", signal);
      console.error(`Saved ${command.output}`);
    } else {
      console.log(content);
    }
    return 0;
  } catch (error) {
    if (signal.aborted) {
      console.error("Interrupted.");
      return 130;
    }
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof UsageError) {
      console.error(usage);
      return 2;
    }
    return error instanceof DependencyError ? 3 : 1;
  }
}

if (require.main === module) {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  runCli(process.argv.slice(2), controller.signal)
    .then((code) => { process.exitCode = code; })
    .finally(() => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    });
}
