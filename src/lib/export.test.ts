import { describe, expect, it } from "vitest";
import { buildExport, buildMarkdownExport, buildSrtExport, buildTxtExport, buildVttExport, safeFilename } from "./export";
import type { TranscriptResult } from "./types";

const result: TranscriptResult = {
  id: "job_1",
  url: "https://youtu.be/example",
  title: "Demo: Video",
  createdAt: "2026-05-29T00:00:00.000Z",
  summary: "A short summary.",
  transcript: "[00:00:00 - 00:00:02] Hello",
  segments: [{ start: 0, end: 2, text: "Hello" }]
};

describe("exports", () => {
  it("builds text export", () => {
    expect(buildTxtExport(result)).toContain("Summary\nA short summary.");
    expect(buildTxtExport(result)).toContain("[00:00:00 - 00:00:02] Hello");
  });

  it("builds markdown export", () => {
    expect(buildMarkdownExport(result)).toContain("# Demo: Video");
    expect(buildMarkdownExport(result)).toContain("- **00:00:00 - 00:00:02** Hello");
  });

  it("creates safe filenames", () => {
    expect(safeFilename('bad:/name*')).toBe("badname");
    expect(safeFilename("")).toBe("youtube-transcript");
  });
});


describe("subtitle exports", () => {
  const subtitles = { ...result, segments: [
    { start: 0.125, end: 1.9996, text: " Hello & <world>\n\nnext --> cue " },
    { start: 3661.007, end: 3662.05, text: "An hour later." }
  ] };

  it("numbers SRT cues and rounds milliseconds with carry", () => {
    expect(buildSrtExport(subtitles)).toBe("1\n00:00:00,125 --> 00:00:02,000\nHello &amp; &lt;world&gt; next --&gt; cue\n\n2\n01:01:01,007 --> 01:01:02,050\nAn hour later.\n");
  });

  it("writes WebVTT with a header and dot milliseconds", () => {
    expect(buildVttExport(subtitles)).toBe("WEBVTT\n\n00:00:00.125 --> 00:00:02.000\nHello &amp; &lt;world&gt; next --&gt; cue\n\n01:01:01.007 --> 01:01:02.050\nAn hour later.\n");
  });

  it("skips invalid and empty cues, sorts a copy and numbers continuously", () => {
    const segments = [
      { start: 2, end: 3, text: "Second" }, { start: 0, end: 1, text: "First" },
      ...[NaN, Infinity, -1, Number.MAX_VALUE].map(start => ({ start, end: 2, text: "Invalid" })),
      { start: 0, end: Infinity, text: "Invalid end" }, { start: 2, end: 1, text: "Reversed" },
      { start: 1, end: 1, text: "Zero" }, { start: 1, end: 1.0001, text: "Sub-millisecond" },
      { start: 0, end: 1, text: " \n " }
    ];
    expect(buildSrtExport({ ...result, segments })).toBe("1\n00:00:00,000 --> 00:00:01,000\nFirst\n\n2\n00:00:02,000 --> 00:00:03,000\nSecond\n");
    expect(segments[0].text).toBe("Second");
  });

  it("handles no usable segments without fabricated timestamps", () => {
    const empty = { ...result, segments: [] };
    expect(buildSrtExport(empty)).toBe("");
    expect(buildVttExport(empty)).toBe("WEBVTT\n\n");
  });

  it("keeps legacy export serialization and the JSON shape unchanged", () => {
    expect(buildExport(result, "txt")).toBe(buildTxtExport(result));
    expect(buildExport(result, "md")).toBe(buildMarkdownExport(result));
    expect(buildExport(result, "json")).toBe(JSON.stringify(result, null, 2));
    expect(buildExport(result, "srt")).toBe(buildSrtExport(result));
    expect(buildExport(result, "vtt")).toBe(buildVttExport(result));
  });
});
