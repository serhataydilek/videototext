import type { TranscriptResult } from "./types";
import { formatSubtitleTimestamp, formatTimestampRange, isValidTimeRange } from "./time";

export type ExportFormat = "txt" | "md" | "json" | "srt" | "vtt";

export function buildExport(result: TranscriptResult, format: ExportFormat): string {
  return { txt: buildTxtExport, md: buildMarkdownExport, json: (data: TranscriptResult) => JSON.stringify(data, null, 2),
    srt: buildSrtExport, vtt: buildVttExport }[format](result);
}

function subtitleCues(result: TranscriptResult, separator: "," | "."): string[] {
  return result.segments.filter((segment) => isValidTimeRange(segment.start, segment.end) && segment.text.trim())
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((segment) => {
      // Plain cue text: neutralize markup and cue delimiters, including blank lines.
      const text = segment.text.replace(/\s+/g, " ").trim()
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `${formatSubtitleTimestamp(segment.start, separator)} --> ${formatSubtitleTimestamp(segment.end, separator)}\n${text}`;
    });
}

export function buildSrtExport(result: TranscriptResult): string {
  const cues = subtitleCues(result, ",");
  return cues.length ? cues.map((cue, index) => `${index + 1}\n${cue}`).join("\n\n") + "\n" : "";
}

export function buildVttExport(result: TranscriptResult): string {
  const cues = subtitleCues(result, ".");
  return "WEBVTT\n\n" + (cues.length ? cues.join("\n\n") + "\n" : "");
}

export function buildTxtExport(result: TranscriptResult): string {
  return [
    result.title,
    result.url,
    `Created: ${result.createdAt}`,
    "",
    "Summary",
    result.summary,
    "",
    "Transcript",
    ...result.segments.map(
      (segment) => `[${formatTimestampRange(segment.start, segment.end)}] ${segment.text}`
    )
  ].join("\n");
}

export function buildMarkdownExport(result: TranscriptResult): string {
  const transcript = result.segments
    .map((segment) => `- **${formatTimestampRange(segment.start, segment.end)}** ${segment.text}`)
    .join("\n");

  return [
    `# ${escapeMarkdown(result.title)}`,
    "",
    `Source: ${result.url}`,
    `Created: ${result.createdAt}`,
    "",
    "## Summary",
    "",
    result.summary,
    "",
    "## Transcript",
    "",
    transcript
  ].join("\n");
}

export function safeFilename(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "youtube-transcript"
  );
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}
