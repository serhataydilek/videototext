import type { TranscriptResult } from "./types";
import { formatTimestampRange } from "./time";

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
