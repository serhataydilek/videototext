import { z } from "zod";
import { isValidTimestamp } from "./time";

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

export function youtubeTimestampUrl(value: string, seconds: number): string | null {
  if (!isValidYoutubeUrl(value) || !isValidTimestamp(seconds)) return null;
  const source = new URL(value);
  const id = source.hostname === "youtu.be" || source.pathname !== "/watch"
    ? source.pathname.split("/").filter(Boolean).at(-1)!
    : source.searchParams.get("v")!;
  const target = new URL("https://www.youtube.com/watch");
  target.searchParams.set("v", id);
  target.searchParams.set("t", `${Math.floor(seconds)}s`);
  return target.href;
}

export const youtubeUrlSchema = z.string().trim().url().refine(isValidYoutubeUrl, {
  message: "Enter a valid YouTube video URL."
});

export function isValidYoutubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (!["http:", "https:"].includes(url.protocol) || !youtubeHosts.has(host) ||
        url.username || url.password || url.port) {
      return false;
    }

    const videoId = /^[A-Za-z0-9_-]{11}$/;
    if (host === "youtu.be") {
      return /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
    }
    if (url.pathname === "/watch") {
      return videoId.test(url.searchParams.get("v") ?? "");
    }
    return /^\/(shorts|live)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}
