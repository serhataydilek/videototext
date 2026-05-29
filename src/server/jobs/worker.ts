import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TranscriptSegment } from "@/lib/types";
import { mergeSegments, offsetSegments, segmentsToTranscript } from "@/lib/transcript";
import { runCommand } from "@/server/process";
import { completeJob, failJob, updateJob } from "./store";

type VideoMetadata = {
  title?: string;
  webpage_url?: string;
};

type WhisperJsonOutput = {
  transcription?: Array<{
    offsets?: {
      from?: number;
      to?: number;
    };
    text?: string;
  }>;
};

const CHUNK_SECONDS = 600;

export async function processJob(id: string, url: string): Promise<void> {
  const workDir = path.join(tmpdir(), `youtube-video-to-text-${id}`);

  try {
    updateJob(id, {
      status: "running",
      progress: 0.03,
      stage: "checking",
      message: "Checking local tools and API configuration."
    });

    const ytdlp = process.env.YTDLP_PATH || "yt-dlp";
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const whisper = process.env.WHISPER_PATH || "whisper-cli";
    const whisperModel = process.env.WHISPER_MODEL_PATH;

    if (!whisperModel) {
      throw new Error("WHISPER_MODEL_PATH is missing. Add a local whisper.cpp model path to .env.local.");
    }

    await checkBinary(ytdlp, ["--version"], "yt-dlp");
    await checkBinary(ffmpeg, ["-version"], "ffmpeg");
    await checkBinary(whisper, ["--help"], "whisper.cpp");
    await checkFile(whisperModel, "WHISPER_MODEL_PATH");
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

    const segmentGroups: TranscriptSegment[][] = [];

    for (const [index, chunkPath] of chunkPaths.entries()) {
      const chunkNumber = index + 1;
      updateJob(id, {
        progress: 0.3 + (index / chunkPaths.length) * 0.5,
        stage: "transcribing",
        message: `Transcribing chunk ${chunkNumber} of ${chunkPaths.length} with local Whisper.`
      });

      const chunkSegments = await transcribeChunk(whisper, whisperModel, chunkPath, workDir, index);
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
      message: "Generating local summary."
    });

    const summary = summarizeTranscript(title, segments);

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

async function transcribeChunk(
  whisper: string,
  whisperModel: string,
  chunkPath: string,
  workDir: string,
  chunkIndex: number
): Promise<TranscriptSegment[]> {
  const outputPrefix = path.join(workDir, `whisper-${String(chunkIndex).padStart(4, "0")}`);
  await runCommand(
    whisper,
    [
      "-m",
      whisperModel,
      "-f",
      chunkPath,
      "-oj",
      "-ojf",
      "-of",
      outputPrefix,
      "-np",
      "-l",
      process.env.WHISPER_LANGUAGE || "en",
      "-t",
      process.env.WHISPER_THREADS || "4"
    ],
    { timeoutMs: 0 }
  );

  const json = JSON.parse(await readFile(`${outputPrefix}.json`, "utf8")) as WhisperJsonOutput;
  return (json.transcription ?? [])
    .map((segment) => ({
      start: (segment.offsets?.from ?? 0) / 1000,
      end: (segment.offsets?.to ?? 0) / 1000,
      text: segment.text ?? ""
    }))
    .filter((segment) => segment.text.trim().length > 0 && segment.end >= segment.start);
}

function summarizeTranscript(title: string, segments: TranscriptSegment[]): string {
  const duration = segments.at(-1)?.end ?? 0;
  const spokenSegments = segments.filter((segment) => !isNonSpeechSegment(segment.text));
  const transcriptText = spokenSegments.map((segment) => segment.text.trim()).join(" ");
  const sentences = splitSentences(transcriptText);
  const keyPoints = pickKeySentences(sentences, 5);
  const opening = sentences.slice(0, 2).join(" ");

  return [
    "Overview",
    `This transcript covers "${title}" and runs for about ${Math.max(1, Math.round(duration / 60))} minute(s).`,
    `${spokenSegments.length} spoken segment(s) were analyzed locally.`,
    "",
    "Key points",
    ...(keyPoints.length > 0
      ? keyPoints.map((point) => `- ${point}`)
      : ["- No clear spoken key points could be extracted."]),
    "",
    "Opening",
    opening || "No spoken opening could be extracted."
  ].join("\n");
}

function isNonSpeechSegment(value: string): boolean {
  return /^\s*\([^)]*(music|applause|laughter|silence)[^)]*\)\s*$/i.test(value);
}

function splitSentences(value: string): string[] {
  const sentences = value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24)
    .flatMap(splitLongSentence);

  return sentences;
}

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= 320) {
    return [sentence];
  }

  const words = sentence.split(" ");
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length > 260) {
      chunks.push(current);
      current = word;
      continue;
    }

    current = current ? `${current} ${word}` : word;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function pickKeySentences(sentences: string[], limit: number): string[] {
  const frequencies = buildWordFrequencies(sentences);

  return sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentence(sentence, frequencies) + positionBonus(index, sentences.length)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

function buildWordFrequencies(sentences: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();

  for (const sentence of sentences) {
    for (const word of sentence.toLowerCase().match(/[a-z0-9']{4,}/g) ?? []) {
      if (summaryStopWords.has(word)) {
        continue;
      }
      frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    }
  }

  return frequencies;
}

function scoreSentence(sentence: string, frequencies: Map<string, number>): number {
  const words = sentence.toLowerCase().match(/[a-z0-9']{4,}/g) ?? [];
  if (words.length === 0) {
    return 0;
  }

  const score = words.reduce((total, word) => total + (frequencies.get(word) ?? 0), 0);
  return score / Math.sqrt(words.length);
}

function positionBonus(index: number, total: number): number {
  if (total <= 1) {
    return 0.5;
  }

  return index < Math.ceil(total * 0.15) ? 0.4 : 0;
}

const summaryStopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "between",
  "could",
  "does",
  "doing",
  "from",
  "have",
  "into",
  "just",
  "like",
  "more",
  "most",
  "only",
  "over",
  "really",
  "some",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "through",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your"
]);

async function checkBinary(command: string, args: string[], label: string): Promise<void> {
  try {
    await runCommand(command, args, { timeoutMs: 15_000 });
  } catch {
    const envName =
      label === "yt-dlp" ? "YTDLP_PATH" : label === "ffmpeg" ? "FFMPEG_PATH" : "WHISPER_PATH";
    throw new Error(`${label} is required but was not found. Install ${label} or set ${envName} in .env.local.`);
  }
}

async function checkFile(filePath: string, envName: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${envName} points to a file that was not found: ${filePath}`);
  }
}

function toUserError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "The job failed unexpectedly.";
}
