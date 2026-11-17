import { describe, expect, it } from "vitest";
import { isValidYoutubeUrl, youtubeTimestampUrl } from "./youtube";

describe("isValidYoutubeUrl", () => {
  it("accepts common YouTube video URLs", () => {
    expect(isValidYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isValidYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isValidYoutubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects non-video and non-YouTube URLs", () => {
    expect(isValidYoutubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isValidYoutubeUrl("https://www.youtube.com/@openai")).toBe(false);
    expect(isValidYoutubeUrl("not a url")).toBe(false);
  });
});


describe("timestamp links", () => {
  it.each([
    "https://youtu.be/dQw4w9WgXcQ?t=99#old",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=99&t=10#old",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ/"
  ])("opens the original video at whole seconds for %s", url => {
    expect(youtubeTimestampUrl(url, 61.9)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=61s");
    expect(youtubeTimestampUrl(url, 0)).toContain("t=0s");
  });

  it.each([NaN, Infinity, -1, Number.MAX_VALUE])("rejects invalid time %s", value => {
    expect(youtubeTimestampUrl("https://youtu.be/dQw4w9WgXcQ", value)).toBeNull();
  });

  it("does not create links from unsafe or malformed source URLs", () => {
    for (const url of ["javascript:alert(1)", "https://evil.example/watch?v=dQw4w9WgXcQ", "no URL"]) {
      expect(youtubeTimestampUrl(url, 1)).toBeNull();
    }
  });
});
