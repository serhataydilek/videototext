import { describe, expect, it } from "vitest";
import { isValidYoutubeUrl } from "./youtube";

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
