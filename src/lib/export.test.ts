import { describe, expect, it } from "vitest";
import { buildMarkdownExport, buildTxtExport, safeFilename } from "./export";
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
