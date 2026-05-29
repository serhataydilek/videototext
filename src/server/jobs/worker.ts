import { createReadStream } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import OpenAI from "openai";
import type { TranscriptSegment } from "@/lib/types";
import { mergeSegments, offsetSegments, segmentsToTranscript } from "@/lib/transcript";
import { runCommand } from "@/server/process";
import { completeJob, failJob, updateJob } from "./store";

type VideoMetadata = {
  title?: string;
  webpage_url?: string;
};

type VerboseTranscription = {
  text?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
};

const CHUNK_SECONDS = 600;
const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
const summaryModel = process.env.OPENAI_SUMMARY_MODEL || "gpt-5-mini";

export async function processJob(id: string, url: string): Promise<void> {
  const workDir = path.join(tmpdir(), `youtube-video-to-text-${id}`);

  try {
    updateJob(id, {
      status: "running",
      progress: 0.03,
      stage: "checking",
      message: "Checking local tools and API configuration."
    });

    requireEnv("OPENAI_API_KEY");
    const ytdlp = process.env.YTDLP_PATH || "yt-dlp";
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    await checkBinary(ytdlp, ["--version"], "yt-dlp");
    await checkBinary(ffmpeg, ["-version"], "ffmpeg");
    await mkdir(workDir, { recursive: true });

    updateJob(id, {
      progress: 0.08,
      stage: "metadata",
      message: "Reading video metadata."
    });

    const metadata = await getMetadata(ytdlp, ffmpeg, url);
    const title = metadata.title?.trim() || "Untitled YouTube video";
    const sourceUrl = metadata.webpage_url || url;

    updateJob(id, {
      progress: 0.14,
      stage: "downloading",
      message: "Downloading and extracting audio with yt-dlp."
    });

    const audioPath = await downloadAudio(ytdlp, ffmpeg, url, workDir);

    updateJob(id, {
      progress: 0.28,
      stage: "chunking",
      message: "Normalizing and splitting audio with ffmpeg."
    });

    const chunkPaths = await chunkAudio(ffmpeg, audioPath, workDir);
    if (chunkPaths.length === 0) {
      throw new Error("ffmpeg did not create any audio chunks.");
    }

    const client = new OpenAI({
      maxRetries: 0,
      timeout: 120_000
    });
    const segmentGroups: TranscriptSegment[][] = [];

    for (const [index, chunkPath] of chunkPaths.entries()) {
      const chunkNumber = index + 1;
      updateJob(id, {
        progress: 0.3 + (index / chunkPaths.length) * 0.5,
        stage: "transcribing",
        message: `Transcribing chunk ${chunkNumber} of ${chunkPaths.length}.`
      });

      const chunkSegments = await transcribeChunk(client, chunkPath);
      segmentGroups.push(offsetSegments(chunkSegments, index * CHUNK_SECONDS));
    }

    const segments = mergeSegments(segmentGroups);
    const transcript = segmentsToTranscript(segments);
    if (!transcript) {
      throw new Error("Transcription completed but returned no text.");
    }

    updateJob(id, {
      progress: 0.84,
      stage: "summarizing",
      message: "Generating summary."
    });

    const summary = await summarizeTranscript(client, title, transcript);

    completeJob(id, {
      id,
      url: sourceUrl,
      title,
      createdAt: new Date().toISOString(),
      transcript,
      summary,
      segments
    });
  } catch (error) {
    failJob(id, toUserError(error));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function getMetadata(ytdlp: string, ffmpeg: string, url: string): Promise<VideoMetadata> {
  const { stdout } = await runCommand(
    ytdlp,
    [...getYtDlpRuntimeArgs(ffmpeg), "--dump-single-json", "--no-playlist", url],
    {
      timeoutMs: 120_000
    }
  );
  return JSON.parse(stdout) as VideoMetadata;
}

async function downloadAudio(
  ytdlp: string,
  ffmpeg: string,
  url: string,
  workDir: string
): Promise<string> {
  const outputTemplate = path.join(workDir, "source.%(ext)s");
  await runCommand(
    ytdlp,
    [
      ...getYtDlpRuntimeArgs(ffmpeg),
      "--no-playlist",
      "--extract-audio",
      "--audio-format",
      "m4a",
      "--audio-quality",
      "0",
      "-o",
      outputTemplate,
      url
    ],
    { timeoutMs: 0 }
  );

  const files = await readdir(workDir);
  const audioFile = files.find((file) => /^source\.(m4a|mp3|webm|wav|opus|aac)$/i.test(file));
  if (!audioFile) {
    throw new Error("yt-dlp finished without producing an audio file.");
  }
  return path.join(workDir, audioFile);
}

function getYtDlpRuntimeArgs(ffmpeg: string): string[] {
  return [
    "--ffmpeg-location",
    getFfmpegLocation(ffmpeg),
    "--js-runtimes",
    `node:${process.execPath}`
  ];
}

function getFfmpegLocation(ffmpeg: string): string {
  const normalized = ffmpeg.toLowerCase();
  if (normalized.endsWith("ffmpeg.exe") || normalized.endsWith("ffmpeg")) {
    return path.dirname(ffmpeg);
  }
  return ffmpeg;
}

async function chunkAudio(ffmpeg: string, audioPath: string, workDir: string): Promise<string[]> {
  const chunkPattern = path.join(workDir, "chunk-%04d.mp3");
  await runCommand(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      audioPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "segment",
      "-segment_time",
      String(CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      chunkPattern
    ],
    { timeoutMs: 0 }
  );

  const files = await readdir(workDir);
  return files
    .filter((file) => /^chunk-\d+\.mp3$/i.test(file))
    .sort()
    .map((file) => path.join(workDir, file));
}

async function transcribeChunk(client: OpenAI, chunkPath: string): Promise<TranscriptSegment[]> {
  const transcription = (await client.audio.transcriptions.create({
    file: createReadStream(chunkPath),
    model: transcribeModel,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"]
  })) as VerboseTranscription;

  const segments = transcription.segments ?? [];
  return segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    text: segment.text
  }));
}

async function summarizeTranscript(
  client: OpenAI,
  title: string,
  transcript: string
): Promise<string> {
  const response = await client.responses.create({
    model: summaryModel,
    instructions:
      "Summarize YouTube transcripts for a reader who wants the substance quickly. Be concise, factual, and preserve key names, numbers, and decisions.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Title: ${title}\n\nTranscript:\n${transcript.slice(0, 120_000)}`
          }
        ]
      }
    ]
  });

  return response.output_text.trim();
}

async function checkBinary(command: string, args: string[], label: string): Promise<void> {
  try {
    await runCommand(command, args, { timeoutMs: 15_000 });
  } catch {
    throw new Error(
      `${label} is required but was not found. Install ${label} or set ${label === "yt-dlp" ? "YTDLP_PATH" : "FFMPEG_PATH"} in .env.local.`
    );
  }
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new Error(`${name} is missing. Add it to .env.local and restart the dev server.`);
  }
}

function toUserError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const code = error.code ? ` (${error.code})` : "";
    return `OpenAI API error ${error.status}${code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }
  return "The job failed unexpectedly.";
}
