import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { JobSnapshot, TranscriptResult, TranscriptSegment } from "../lib/types";
import { mergeSegments, offsetSegments, segmentsToTranscript } from "../lib/transcript";
import { runCommand } from "./process";
import { checkDependencies, getConfig, DependencyError } from "./dependencies";

type VideoMetadata = {
  title?: string;
  is_live?: boolean;
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

type Progress = Pick<JobSnapshot, "progress" | "stage" | "message">;

export async function transcribe(
  id: string, url: string, onProgress: (update: Progress) => void, signal?: AbortSignal
): Promise<TranscriptResult> {
  onProgress({ progress: 0.03, stage: "checking", message: "Checking local tools and configuration." });
  const config = getConfig();
  const checks = await checkDependencies(config, signal);
  const errors = checks.filter((check) => !check.ok);
  if (errors.length) throw new DependencyError(errors.map((check) => check.message).join("\n"));
  const { ytdlp, ffmpeg } = config;
  const workDir = await mkdtemp(path.join(tmpdir(), "youtube-video-to-text-"));
  try {
    onProgress({
      progress: 0.08,
      stage: "metadata",
      message: "Reading video metadata."
    });

    const metadata = await getMetadata(ytdlp, ffmpeg, url, signal);
    if (metadata.is_live) throw new Error("This video is still live. Try again after the broadcast has ended.");
    const title = metadata.title?.trim() || "Untitled YouTube video";

    onProgress({
      progress: 0.14,
      stage: "downloading",
      message: "Downloading and extracting audio with yt-dlp."
    });

    const audioPath = await downloadAudio(ytdlp, ffmpeg, url, workDir, signal);

    onProgress({
      progress: 0.28,
      stage: "chunking",
      message: "Normalizing and splitting audio with ffmpeg."
    });

    const chunkPaths = await chunkAudio(ffmpeg, audioPath, workDir, signal);
    if (chunkPaths.length === 0) {
      throw new Error("ffmpeg did not create any audio chunks.");
    }

    const segmentGroups: TranscriptSegment[][] = [];
    let offset = 0;

    for (const [index, chunkPath] of chunkPaths.entries()) {
      const chunkNumber = index + 1;
      onProgress({
        progress: 0.3 + (index / chunkPaths.length) * 0.5,
        stage: "transcribing",
        message: `Transcribing chunk ${chunkNumber} of ${chunkPaths.length} with local Whisper.`
      });

      const { stdout } = await runCommand(config.ffprobe, [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", chunkPath
      ], { signal, timeoutMs: 15_000 });
      const duration = Number(stdout.trim());
      if (!Number.isFinite(duration) || duration <= 0) throw new Error("ffprobe returned an invalid chunk duration.");
      const chunkSegments = await transcribeChunk(config, chunkPath, workDir, index, duration, signal);
      segmentGroups.push(offsetSegments(chunkSegments, offset));
      offset += duration;
    }

    const segments = mergeSegments(segmentGroups);
    const transcript = segmentsToTranscript(segments);
    if (!transcript) {
      throw new Error("Transcription completed but returned no text.");
    }

    onProgress({
      progress: 0.84,
      stage: "summarizing",
      message: "Generating local summary."
    });

    const summary = summarizeTranscript(title, segments);

    return {
      id,
      url,
      title,
      createdAt: new Date().toISOString(),
      transcript,
      summary,
      segments
    };
  } finally {
    await rm(workDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

async function getMetadata(ytdlp: string, ffmpeg: string, url: string, signal?: AbortSignal): Promise<VideoMetadata> {
  const { stdout } = await runCommand(
    ytdlp,
    [...getYtDlpRuntimeArgs(ffmpeg), "--dump-single-json", "--no-playlist", url],
    {
      signal, timeoutMs: 120_000
    }
  );
  return JSON.parse(stdout) as VideoMetadata;
}

async function downloadAudio(
  ytdlp: string,
  ffmpeg: string,
  url: string,
  workDir: string,
  signal?: AbortSignal
): Promise<string> {
  const outputTemplate = path.join(workDir, "source.%(ext)s");
  await runCommand(
    ytdlp,
    [
      ...getYtDlpRuntimeArgs(ffmpeg),
      "--no-progress",
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
    { signal }
  );

  const files = await readdir(workDir);
  const audioFile = files.find((file) => /^source\.(m4a|mp3|webm|wav|opus|aac)$/i.test(file));
  if (!audioFile) {
    throw new Error("yt-dlp finished without producing an audio file.");
  }
  return path.join(workDir, audioFile);
}

function getYtDlpRuntimeArgs(ffmpeg: string): string[] {
  const location = ffmpeg === path.basename(ffmpeg) ? [] : ["--ffmpeg-location", path.resolve(ffmpeg)];
  // User-level configs can contain output paths, cookies, proxies or --exec hooks.
  return ["--ignore-config", "--no-plugin-dirs", "--socket-timeout", "30",
    ...location, "--js-runtimes", `node:${process.execPath}`];
}

async function chunkAudio(ffmpeg: string, audioPath: string, workDir: string, signal?: AbortSignal): Promise<string[]> {
  const chunkPattern = path.join(workDir, "chunk-%04d.wav");
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
      "-c:a",
      "pcm_s16le",
      "-f",
      "segment",
      "-segment_time",
      String(CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      chunkPattern
    ],
    { signal }
  );

  const files = await readdir(workDir);
  return files
    .filter((file) => /^chunk-\d+\.wav$/i.test(file))
    .sort()
    .map((file) => path.join(workDir, file));
}

async function transcribeChunk(
  config: ReturnType<typeof getConfig>,
  chunkPath: string,
  workDir: string,
  chunkIndex: number,
  duration: number,
  signal?: AbortSignal
): Promise<TranscriptSegment[]> {
  const outputPrefix = path.join(workDir, `whisper-${String(chunkIndex).padStart(4, "0")}`);
  await runCommand(
    config.whisper,
    [
      "-m",
      config.model,
      "-f",
      chunkPath,
      "-oj",
      "-of",
      outputPrefix,
      "-np",
      "-l",
      config.language,
      "-t",
      config.threads
    ],
    { signal }
  );

  const json = JSON.parse(await readFile(`${outputPrefix}.json`, "utf8")) as WhisperJsonOutput;
  if (!Array.isArray(json.transcription)) throw new Error("Whisper returned an invalid transcription JSON file.");
  return json.transcription.map((segment) => {
    const start = segment?.offsets?.from;
    const end = segment?.offsets?.to;
    if (typeof start !== "number" || typeof end !== "number" ||
        !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start ||
        typeof segment.text !== "string") {
      throw new Error("Whisper returned invalid segment timestamps or text.");
    }
    return { start: Math.min(start / 1000, duration), end: Math.min(end / 1000, duration), text: segment.text };
  }).filter((segment) => segment.text.trim().length > 0 && segment.end > segment.start);
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
