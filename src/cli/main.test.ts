import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSnapshot, TranscriptResult } from "../lib/types";
import { buildMarkdownExport, buildTxtExport } from "../lib/export";
import { getConfig } from "../server/dependencies";
import { createJob, getEmitter } from "../server/jobs/store";
import { runCommand } from "../server/process";
import { parseArgs, runCli } from "./main";

vi.mock("../server/process", () => ({ runCommand: vi.fn() }));

const url = "https://youtu.be/jNQXAC9IVRw";
const run = vi.mocked(runCommand);

describe("CLI arguments", () => {
  it("defaults to txt and accepts options around the URL", () => {
    expect(parseArgs(["transcribe", url])).toMatchObject({ url, format: "txt" });
    expect(parseArgs(["transcribe", "--format", "md", url, "--output", "my notes.md"]))
      .toMatchObject({ url, format: "md", output: "my notes.md" });
  });

  it.each([
    [], ["unknown"], ["doctor", url], ["transcribe"], ["transcribe", url, url],
    ["transcribe", "https://example.org/watch?v=jNQXAC9IVRw"],
    ["transcribe", "ftp://youtu.be/jNQXAC9IVRw"], ["transcribe", "https://youtu.be/abc"],
    ["transcribe", "https://www.youtube.com/shorts/jNQXAC9IVRw/more"],
    ["transcribe", url, "--format"], ["transcribe", url, "--typo"],
    ["transcribe", url, "--output", "--format", "json"], ["transcribe", url, "--format", "xml"],
    ["transcribe", url, "--format", "txt", "--format", "json"]
  ].map((args) => ({ args })))("rejects $args", ({ args }) => {
    expect(() => parseArgs(args)).toThrow();
  });
});

describe("CLI and web transcription", () => {
  let directory: string;
  let workDir: string | undefined;
  let stdout: string[];
  let stderr: string[];
  let controller: AbortController;
  const cli = (...args: string[]) => runCli(args, controller.signal);

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "videototext-test-"));
    workDir = undefined;
    controller = new AbortController();
    stdout = [];
    stderr = [];
    vi.spyOn(console, "log").mockImplementation((text) => { stdout.push(text); });
    vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation((text) => { stderr.push(text); });
    const model = path.join(directory, "model.bin");
    await writeFile(model, "fixture");
    for (const [key, value] of Object.entries({
      WHISPER_MODEL_PATH: model, YTDLP_PATH: "yt-dlp", FFMPEG_PATH: "ffmpeg",
      WHISPER_PATH: "whisper-cli", WHISPER_THREADS: "4", WHISPER_LANGUAGE: "en"
    })) vi.stubEnv(key, value);

    // Substitute only the external executables. The pipeline, filesystem,
    // summary, output writers and job notifications are real.
    run.mockImplementation(async (_command, args) => {
      if (args.includes("--dump-single-json")) {
        expect(args).not.toContain("--ffmpeg-location");
        expect(args).toContain("--ignore-config");
        expect(args).toContain("--no-plugin-dirs");
        return { stdout: JSON.stringify({ title: "Demo", webpage_url: url }), stderr: "" };
      }
      if (args.includes("format=duration")) {
        return { stdout: "600.125\n", stderr: "" };
      }
      if (args.includes("--extract-audio")) {
        const template = args[args.indexOf("-o") + 1];
        workDir = path.dirname(template);
        await writeFile(template.replace("%(ext)s", "m4a"), "");
      }
      if (args.includes("-segment_time")) {
        expect(args.join(" ")).toContain("-ac 1 -ar 16000 -c:a pcm_s16le");
        const pattern = args.at(-1)!;
        for (const index of ["0000", "0001"]) await writeFile(pattern.replace("%04d", index), "");
      }
      if (args.includes("-oj")) {
        expect(args[args.indexOf("-f") + 1]).toMatch(/\.wav$/);
        await writeFile(args[args.indexOf("-of") + 1] + ".json", JSON.stringify({
          transcription: [{ offsets: { from: 100, to: 1800 }, text: " We discuss an important example today." }]
        }));
      }
      return { stdout: "", stderr: "" };
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    run.mockReset();
    await rm(directory, { recursive: true, force: true });
  });

  it("prints only JSON on stdout, offsets chunks and removes temporary audio", async () => {
    expect(await cli("transcribe", url, "--format", "json")).toBe(0);
    const result: TranscriptResult = JSON.parse(stdout.join("\n"));
    expect(result.segments.map((segment) => segment.start)).toEqual([0.1, 600.23]);
    expect(result.summary).toContain("We discuss an important example today.");
    expect(result.transcript).toContain("00:10:00");
    expect(stderr.join("\n")).toContain("Transcribing chunk 2 of 2");
    expect(workDir).toBeDefined();
    await expect(stat(workDir!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["txt", "md"])("saves the same %s export as the web UI", async (format) => {
    const file = path.join(directory, "my notes");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      expect(await cli("transcribe", url, "--format", format, "--output", file)).toBe(0);
      expect(stdout).toEqual([]);
      expect(await cli("transcribe", url, "--format", "json")).toBe(0);
      const data = JSON.parse(stdout[0]);
      const render = format === "txt" ? buildTxtExport : buildMarkdownExport;
      expect(await readFile(file, "utf8")).toBe(render(data) + "\n");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports each failed check, including sibling ffprobe and invalid settings", async () => {
    vi.stubEnv("FFMPEG_PATH", path.join(directory, "ffmpeg"));
    vi.stubEnv("WHISPER_MODEL_PATH", directory);
    vi.stubEnv("WHISPER_THREADS", "-1");
    const probe = getConfig().ffprobe;
    expect(path.dirname(probe)).toBe(directory);
    run.mockImplementation(async (command) => {
      if (command === probe || command === "yt-dlp") throw new Error("missing");
      return { stdout: "", stderr: "" };
    });
    expect(await cli("doctor")).toBe(3);
    expect(stdout.filter((s) => s.startsWith("[failed]"))).toHaveLength(4);
    expect(stdout.join("\n")).toContain("YTDLP_PATH");
    expect(await cli("transcribe", url)).toBe(3);
    expect(stderr.join("\n")).toContain("WHISPER_MODEL_PATH");
  });

  it("returns usage and runtime errors with empty stdout; preserves an earlier export", async () => {
    expect(await cli("bad")).toBe(2);
    const file = path.join(directory, "notes.md");
    await writeFile(file, "existing");
    const fakeTools = run.getMockImplementation()!;
    run.mockImplementation(async (...params) => {
      if (params[1].includes("-oj")) throw new Error("whisper failed");
      return fakeTools(...params);
    });
    expect(await cli("transcribe", url, "--output", file)).toBe(1);
    expect(stderr.join("\n")).toContain("whisper failed");
    expect(stdout).toEqual([]);
    expect(await readFile(file, "utf8")).toBe("existing");
    await expect(stat(workDir!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("cleans up after interruption and failed output writes", async () => {
    const folder = path.join(directory, "folder");
    await mkdir(folder);
    expect(await cli("transcribe", url, "--output", folder)).toBe(1);
    expect((await readdir(directory)).sort()).toEqual(["folder", "model.bin"]);
    const fakeTools = run.getMockImplementation()!;
    run.mockImplementation(async (...params) => {
      if (params[1].includes("-oj")) {
        controller.abort();
        params[2]?.signal?.throwIfAborted();
      }
      return fakeTools(...params);
    });
    expect(await cli("transcribe", url)).toBe(130);
    expect(stdout).toEqual([]);
    await expect(stat(workDir!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("completes an existing web job with the same timestamped result", async () => {
    const job = createJob(url);
    expect(job.status).toBe("queued");
    const [done] = await once(getEmitter(job.id)!, "done") as [JobSnapshot];
    expect(done.status).toBe("completed");
    expect(done.result).toMatchObject({ id: job.id, title: "Demo", url });
    expect(done.result?.segments[1].start).toBe(600.23);
  });

  it("rejects ongoing livestreams before downloading", async () => {
    const fakeTools = run.getMockImplementation()!;
    run.mockImplementation(async (...params) => params[1].includes("--dump-single-json")
      ? { stdout: JSON.stringify({ is_live: true }), stderr: "" } : fakeTools(...params));
    expect(await cli("transcribe", url)).toBe(1);
    expect(stderr.join("\n")).toContain("still live");
    expect(run.mock.calls.some(([, args]) => args.includes("--extract-audio"))).toBe(false);
  });

  it("keeps the validated source URL instead of an arbitrary metadata URL", async () => {
    const fakeTools = run.getMockImplementation()!;
    run.mockImplementation(async (...params) => params[1].includes("--dump-single-json")
      ? { stdout: JSON.stringify({ title: "Demo", webpage_url: "javascript:example" }), stderr: "" } : fakeTools(...params));
    expect(await cli("transcribe", url, "--format", "json")).toBe(0);
    expect(JSON.parse(stdout[0]).url).toBe(url);
  });

  it.each(["", "NaN", "-1", "0"])("rejects invalid chunk duration %s", async (duration) => {
    const fakeTools = run.getMockImplementation()!;
    run.mockImplementation(async (...params) => params[1].includes("format=duration")
      ? { stdout: duration, stderr: "" } : fakeTools(...params));
    expect(await cli("transcribe", url)).toBe(1);
    expect(stderr.join("\n")).toContain("invalid chunk duration");
    await expect(stat(workDir!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    {}, { transcription: [{ text: "Missing offsets" }] },
    { transcription: [{ offsets: { from: -1, to: 10 }, text: "Negative" }] },
    { transcription: [{ offsets: { from: 10, to: 1 }, text: "Reversed" }] },
    { transcription: [{ offsets: { from: "1", to: 10 }, text: "String" }] }
  ])("rejects malformed Whisper output without replacing a saved export", async (data) => {
    const file = path.join(directory, "notes.json");
    await writeFile(file, "existing");
    const fakeTools = run.getMockImplementation()!;
    run.mockImplementation(async (...params) => {
      if (params[1].includes("-oj")) {
        await writeFile(params[1][params[1].indexOf("-of") + 1] + ".json", JSON.stringify(data));
        return { stdout: "", stderr: "" };
      }
      return fakeTools(...params);
    });
    expect(await cli("transcribe", url, "--output", file)).toBe(1);
    expect(await readFile(file, "utf8")).toBe("existing");
    await expect(stat(workDir!)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
