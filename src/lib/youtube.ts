import { z } from "zod";

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

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
