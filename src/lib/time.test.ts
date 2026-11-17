import { describe, expect, it } from "vitest";
import { formatSubtitleTimestamp, formatTimestamp, isValidTimeRange } from "./time";

describe("timestamp safety", () => {
  it.each([NaN, Infinity, -Infinity, -10, Number.MAX_VALUE])("formats invalid %s safely", value => {
    expect(formatTimestamp(value)).toBe("00:00:00");
    expect(formatSubtitleTimestamp(value, ",")).toBe("00:00:00,000");
    expect(isValidTimeRange(value, 10)).toBe(false);
  });
  it("preserves hour boundaries and rejects zero or reversed cue lengths", () => {
    expect(formatTimestamp(3600.125)).toBe("01:00:00");
    expect(formatSubtitleTimestamp(3599.9996, ".")).toBe("01:00:00.000");
    expect(isValidTimeRange(0, 0)).toBe(false);
    expect(isValidTimeRange(2, 1)).toBe(false);
  });
});
