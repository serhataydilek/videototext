import { describe, expect, it } from "vitest";
import { mergeSegments, offsetSegments, segmentsToTranscript } from "./transcript";

describe("transcript utilities", () => {
  it("offsets and normalizes chunk segments", () => {
    expect(offsetSegments([{ start: 1, end: 2.234, text: " hello   world " }], 600)).toEqual([
      { start: 601, end: 602.23, text: "hello world" }
    ]);
  });

  it("merges chunk output in timestamp order", () => {
    expect(
      mergeSegments([
        [{ start: 20, end: 22, text: "later" }],
        [{ start: 1, end: 3, text: "first" }]
      ])
    ).toEqual([
      { start: 1, end: 3, text: "first" },
      { start: 20, end: 22, text: "later" }
    ]);
  });

  it("formats timestamped transcript lines", () => {
    expect(segmentsToTranscript([{ start: 1, end: 62, text: "hello" }])).toBe(
      "[00:00:01 - 00:01:02] hello"
    );
  });
});
