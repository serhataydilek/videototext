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

    if (!youtubeHosts.has(host)) {
      return false;
    }

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean).length === 1;
    }

    if (url.pathname === "/watch" && url.searchParams.has("v")) {
      return Boolean(url.searchParams.get("v")?.trim());
    }

    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      return url.pathname.split("/").filter(Boolean).length >= 2;
    }

    return false;
  } catch {
    return false;
  }
}
