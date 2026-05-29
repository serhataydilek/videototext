import type { TranscriptSegment } from "./types";
import { formatTimestampRange } from "./time";

export function offsetSegments(
  segments: TranscriptSegment[],
  offsetSeconds: number
): TranscriptSegment[] {
  return segments.map((segment) => ({
    start: roundSeconds(segment.start + offsetSeconds),
    end: roundSeconds(segment.end + offsetSeconds),
    text: normalizeSegmentText(segment.text)
  }));
}

export function mergeSegments(segmentGroups: TranscriptSegment[][]): TranscriptSegment[] {
  return segmentGroups
    .flat()
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function segmentsToTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => `[${formatTimestampRange(segment.start, segment.end)}] ${segment.text}`)
    .join("\n");
}

function normalizeSegmentText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function roundSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}
