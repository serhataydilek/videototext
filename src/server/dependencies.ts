import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "./process";

export class DependencyError extends Error {}

export function getConfig(env = process.env) {
  const ffmpeg = env.FFMPEG_PATH || "ffmpeg";
  const probe = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  return {
    ytdlp: env.YTDLP_PATH || "yt-dlp",
    ffmpeg,
    ffprobe: ffmpeg === path.basename(ffmpeg) ? probe : path.resolve(path.dirname(ffmpeg), probe),
    whisper: env.WHISPER_PATH || "whisper-cli",
    model: env.WHISPER_MODEL_PATH || "",
    threads: env.WHISPER_THREADS || "4",
    language: env.WHISPER_LANGUAGE || "en"
  };
}

type Check = { ok: boolean; message: string };

export async function checkDependencies(config: ReturnType<typeof getConfig>, signal?: AbortSignal) {
  const checks: Check[] = [];
  async function binary(label: string, command: string, args: string[], hint: string) {
    try {
      await runCommand(command, args, { timeoutMs: 15_000, signal });
      checks.push({ ok: true, message: `${label}: ${command}` });
    } catch (error) {
      signal?.throwIfAborted();
      checks.push({ ok: false, message: `${label}: ${error instanceof Error ? error.message : error}. ${hint}` });
    }
  }

  await binary("yt-dlp", config.ytdlp, ["--js-runtimes", "node", "--version"],
    "Install a current yt-dlp release and set YTDLP_PATH or add it to PATH.");
  const ffmpegHint = "Install FFmpeg with ffprobe. Put both on PATH or set FFMPEG_PATH to ffmpeg beside ffprobe.";
  await binary("FFmpeg", config.ffmpeg, ["-version"], ffmpegHint);
  await binary("ffprobe", config.ffprobe, ["-version"], ffmpegHint);
  await binary("whisper.cpp", config.whisper, ["--help"],
    "Install whisper-cli from ggml-org/whisper.cpp and set WHISPER_PATH or add it to PATH.");

  let readable = false;
  if (config.model) {
    try {
      await access(config.model, constants.R_OK);
      const info = await stat(config.model);
      readable = info.isFile() && info.size > 0;
    } catch {
      // The diagnostic below also covers missing and inaccessible files.
    }
  }
  checks.push({ ok: readable, message: readable ? `Whisper model: ${config.model}` :
    "Download a whisper.cpp GGML model and set WHISPER_MODEL_PATH to its readable, nonempty file." });
  const threadsValid = /^[1-9]\d*$/.test(config.threads) && Number(config.threads) <= 2147483647;
  checks.push({ ok: threadsValid, message: threadsValid ? `Whisper threads: ${config.threads}` :
    "Set WHISPER_THREADS to a positive 32-bit integer." });
  const languageValid = /^[a-z]+(?:[ -][a-z]+)*$/i.test(config.language);
  checks.push({ ok: languageValid, message: languageValid ? `Whisper language: ${config.language}` :
    "Set WHISPER_LANGUAGE to a Whisper language code, language name or auto." });
  signal?.throwIfAborted();
  return checks;
}
