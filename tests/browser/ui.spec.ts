import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { TranscriptResult } from "../../src/lib/types";

// These isolated UI cases mock the API. real.spec.ts exercises actual tools.
const result: TranscriptResult = {
  id: "job_fixture", title: "Browser QA fixture", url: "https://youtu.be/jNQXAC9IVRw",
  createdAt: "2026-11-14T00:00:00.000Z", summary: "A synthetic summary for isolated UI testing.",
  transcript: "[00:00:01 - 00:00:03] A synthetic sentence for browser testing.",
  segments: [{ start: 1, end: 3, text: "A synthetic sentence for browser testing." }]
};

async function mockJob(page: Page, data = result) {
  await page.route("**/api/jobs", route => route.fulfill({ status: 202, json: {
    job: { id: data.id, status: "queued", progress: 0, stage: "queued", message: "Waiting to start." }
  } }));
  await page.route("**/api/jobs/*/events", route => route.fulfill({
    contentType: "text/event-stream",
    body: `event: done\ndata: ${JSON.stringify({
      id: data.id, status: "completed", progress: 1, stage: "completed", message: "Transcript and summary are ready.", result: data
    })}\n\n`
  }));
}

async function submit(page: Page) {
  await page.getByLabel("YouTube URL").fill(result.url);
  await page.getByRole("button", { name: "Create transcript", exact: true }).click();
}

test("local API: invalid URL returns a visible error without transcription", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("YouTube URL").fill("https://example.org/not-a-video");
  await page.getByRole("button", { name: "Create transcript", exact: true }).click();
  await expect(page.locator(".error-message[role=alert]")).toContainText("valid YouTube video URL");
  await expect(page.getByRole("button", { name: "Create transcript", exact: true })).toBeEnabled();
});

test("mock: views, downloaded contents, refresh persistence and reopening history", async ({ page }) => {
  await mockJob(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("VideoToText");
  await submit(page);
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Timestamps", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Summary", exact: true }).click();
  await expect(page.locator(".summary")).toHaveText(result.summary);
  await page.getByRole("tab", { name: "Paragraph", exact: true }).click();
  await expect(page.locator(".paragraph-transcript")).toHaveText(result.segments[0].text);
  await page.getByRole("tab", { name: "Timestamps", exact: true }).click();
  await expect(page.locator(".timestamp")).toHaveText("00:00:01 - 00:00:03");
  for (const [button, extension] of [["TXT", "txt"], ["Markdown", "md"]]) {
    const pending = page.waitForEvent("download");
    await page.getByText("Export", { exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`${result.title}.${extension}`);
    const text = await readFile((await download.path())!, "utf8");
    expect(text).toContain(result.title);
    expect(text).toContain(result.url);
    expect(text).toContain(result.summary);
    expect(text).toContain(result.segments[0].text);
    expect(text).toContain("00:00:01 - 00:00:03");
  }
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await mockJob(page, { ...result, id: "job_second", title: "Second fixture", createdAt: "2026-11-14T00:01:00.000Z" });
  await submit(page);
  await expect(page.getByRole("heading", { name: "Second fixture", exact: true })).toBeVisible();
  await expect(page.locator(".history-item")).toHaveCount(2);
  await page.getByRole("button", { name: new RegExp(result.title) }).click();
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
});

test("mock: unavailable browser storage keeps completed results exportable", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await mockJob(page);
  await page.goto("/");
  await expect(page.locator(".error-message")).toContainText("Browser history is unavailable");
  await submit(page);
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await expect(page.locator(".error-message")).toContainText("Export it to keep a copy");
  const pending = page.waitForEvent("download");
  await page.getByText("Export", { exact: true }).click();
  await page.getByRole("button", { name: "TXT", exact: true }).click();
  expect(await (await pending).failure()).toBeNull();
});

test("mock: slow initial history read cannot hide a newly completed transcript", async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof original>) {
      const request = original.apply(this, args);
      Object.defineProperty(request, "onsuccess", { set(callback: (event: Event) => void) {
        request.addEventListener("success", event => setTimeout(() => callback.call(request, event), 1200));
      } });
      return request;
    };
  });
  await mockJob(page);
  await page.goto("/");
  await submit(page);
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await page.waitForTimeout(1600); // Deliberately exceed the injected storage delay.
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await expect(page.locator(".history-item")).toHaveCount(1);
});

test("mock: quota failure on save keeps the completed result visible", async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException("Storage full", "QuotaExceededError"); };
  });
  await mockJob(page);
  await page.goto("/");
  await submit(page);
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await expect(page.locator(".error-message[role=alert]")).toContainText("Export it to keep a copy");
  await expect(page.locator(".history-item")).toHaveCount(0);
});

test("mock: malformed successful response produces an actionable error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/jobs", route => route.fulfill({ status: 200, contentType: "text/html", body: "Service unavailable" }));
  await page.goto("/");
  await submit(page);
  await expect(page.locator(".error-message")).toContainText("without a valid JSON response");
  expect(errors).toEqual([]);
});

test("mock: disconnected event stream permits another attempt", async ({ page }) => {
  await mockJob(page);
  await page.route("**/api/jobs/*/events", route => route.abort());
  await page.goto("/");
  await submit(page);
  await expect(page.locator(".error-message")).toContainText("Connection to the job stream was interrupted");
  await expect(page.getByRole("button", { name: "Create transcript", exact: true })).toBeEnabled();
});

test("mock: pending submission cannot be submitted twice", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/jobs", async route => {
    await gate;
    await route.fulfill({ status: 400, json: { error: "Enter a valid YouTube video URL." } });
  });
  await page.goto("/");
  await submit(page);
  try {
    await expect(page.locator(".primary-button")).toBeDisabled();
  } finally { release(); }
  await expect(page.locator(".error-message")).toContainText("valid YouTube video URL");
});

test("mock: failed history clearing is visible and preserves saved results", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockJob(page);
  await page.goto("/");
  await submit(page);
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.evaluate(() => {
    IDBObjectStore.prototype.clear = () => { throw new DOMException("Write denied", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.locator(".error-message")).toContainText("Could not clear browser history");
  await expect(page.locator(".history-item")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("mock: keyboard-accessible tabs and narrow mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockJob(page);
  await page.goto("/");
  await submit(page);
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Timestamps", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Paragraph", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(result.segments[0].text);
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Summary", exact: true })).toHaveAttribute("aria-selected", "true");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => {
      const panel = document.querySelector(".result-view")!;
      const tabs = document.querySelector(".tabs")!.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      return document.documentElement.scrollWidth <= window.innerWidth &&
        tabs.right <= bounds.right - parseFloat(getComputedStyle(panel).paddingRight) + 1;
    })).toBe(true);
  }
});


test("workspace: search is literal, case insensitive, highlighted, and clearable", async ({ page }) => {
  await mockJob(page, { ...result, segments: [
    { start: 0, end: 2.125, text: "Whisper whisper [a+b] <script>safe</script>" },
    { start: 4, end: 6, text: "Another segment." }
  ] });
  await page.goto("/"); await submit(page);
  await expect(page.locator(".segment")).toHaveCount(2);
  await page.getByRole("searchbox", { name: "Search transcript", exact: true }).fill("WHISPER");
  await expect(page.locator(".segment")).toHaveCount(1);
  await expect(page.locator("mark")).toHaveCount(2);
  await expect(page.locator(".search-status")).toContainText("2 matches");
  await page.getByRole("searchbox", { name: "Search transcript", exact: true }).fill("[a+b]");
  await expect(page.locator("mark")).toHaveText("[a+b]");
  await expect(page.locator(".segment")).toContainText("<script>safe</script>");
  await page.getByRole("searchbox", { name: "Search transcript", exact: true }).fill("not present");
  await expect(page.locator(".search-status")).toContainText("No matches found");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".segment")).toHaveCount(2);
  await page.getByRole("tab", { name: "Paragraph", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search transcript", exact: true }).fill("whisper");
  await expect(page.locator("mark")).toHaveCount(2);
  await page.getByRole("tab", { name: "Summary", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search transcript", exact: true }).fill("synthetic");
  await expect(page.locator(".summary mark")).toHaveText("synthetic");
});

test("workspace: timestamps open YouTube at the segment start", async ({ page }) => {
  await mockJob(page, { ...result, url: result.url + "?t=99#old", segments: [{ start: 61.9, end: 65, text: "Seek here." }] });
  await page.goto("/"); await submit(page);
  const link = page.getByRole("link", { name: "Open video at 00:01:01", exact: true });
  await expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=jNQXAC9IVRw&t=61s");
  await expect(link).toHaveAttribute("target", "_blank");
  await page.route("https://www.youtube.com/**", route => route.fulfill({ body: "Video fixture" }));
  const popup = page.waitForEvent("popup");
  await link.click();
  const video = await popup;
  await expect(video).toHaveURL("https://www.youtube.com/watch?v=jNQXAC9IVRw&t=61s");
  await video.close();
});

test("workspace: SRT, WebVTT and JSON downloads preserve segment timing", async ({ page }) => {
  await mockJob(page, { ...result, segments: [{ start: 1.125, end: 3.007, text: "Hello world." }] });
  await page.goto("/"); await submit(page);
  for (const [name, extension, expected] of [
    ["SRT", "srt", "1\n00:00:01,125 --> 00:00:03,007\nHello world.\n"],
    ["WebVTT", "vtt", "WEBVTT\n\n00:00:01.125 --> 00:00:03.007\nHello world.\n"],
    ["JSON", "json", ""]
  ]) {
    await page.getByText("Export", { exact: true }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`${result.title}.${extension}`);
    const content = await readFile((await download.path())!, "utf8");
    if (extension === "json") expect(JSON.parse(content).segments[0]).toEqual({ start: 1.125, end: 3.007, text: "Hello world." });
    else expect(content).toBe(expected);
  }
});

test("workspace: copy succeeds and clipboard rejection offers an export fallback", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await mockJob(page); await page.goto("/"); await submit(page);
  await page.getByRole("button", { name: "Copy transcript", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(result.segments[0].text);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error("Denied"); }; });
  await page.getByRole("button", { name: "Copied", exact: true }).click();
  await expect(page.locator(".copy-feedback")).toContainText("Clipboard unavailable");
});

test("workspace: searchable legacy IndexedDB history, new transcript, and clearing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async data => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("youtube-video-to-text", 1);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("transcripts", "readwrite");
        tx.objectStore("transcripts").put(data);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, result);
  await page.reload();
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search history", exact: true }).fill("synthetic sentence");
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search history", exact: true }).fill("no match");
  await expect(page.getByText("No matching transcripts.", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search history", exact: true }).fill("");
  await page.getByRole("button", { name: "New transcript", exact: true }).click();
  await expect(page.getByLabel("YouTube URL")).toBeFocused();
  await page.locator(".history-item").click();
  await expect(page.getByRole("tab", { name: "Timestamps", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Clear history", exact: true }).click();
  await expect(page.locator(".history-item")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".history-item")).toHaveCount(0);
  await expect(page.getByText("From video to working knowledge", { exact: true })).toBeVisible();
});

test("workspace: invalid timestamps and empty segments remain safe", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockJob(page, { ...result, segments: [
    { start: -1, end: 2, text: "Negative" }, { start: 4, end: 2, text: "Reversed" },
    { start: 0, end: 1, text: "   " }, { start: 1, end: 1, text: "Zero" }
  ] });
  await page.goto("/"); await submit(page);
  await expect(page.locator(".segment")).toHaveCount(3);
  await expect(page.locator("a.timestamp")).toHaveCount(0);
  await expect(page.locator(".timestamp").first()).toHaveText("Time unavailable");
  await mockJob(page, { ...result, id: "empty", segments: [] });
  await submit(page);
  await expect(page.getByText("No transcript segments are available.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("workspace: mobile history drawer supports selection, dismissal and keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockJob(page); await page.goto("/"); await submit(page);
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Open history", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search history", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open history", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Open history", exact: true }).click();
  await page.locator(".history-item").click();
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await page.getByRole("button", { name: "Open history", exact: true }).click();
  await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await page.getByRole("button", { name: "Open history", exact: true }).click();
  await page.getByRole("button", { name: "New transcript", exact: true }).click();
  await expect(page.getByLabel("YouTube URL")).toBeFocused();
  await expect(page.locator(".status-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Open history", exact: true }).click();
  await page.screenshot({ path: "release-artifacts/v0.3-mobile-history.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect(page.getByLabel("YouTube URL")).toBeEnabled();
});

test("workspace: progress and desktop/mobile rendered layouts", async ({ page }) => {
  await page.route("**/api/jobs", route => route.fulfill({ status: 202, json: { job: { id: "progress", status: "running", progress: 0.53, stage: "transcribing", message: "Transcribing chunk 1 of 2 with local Whisper." } } }));
  // Keep the SSE request open while asserting live progress.
  await page.route("**/api/jobs/*/events", () => {});
  await page.goto("/"); await submit(page);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "53");
  await expect(page.locator(".status-message")).toContainText("chunk 1 of 2");
  await expect(page.getByRole("button", { name: "Processing", exact: true })).toBeDisabled();
  await mockJob(page, { ...result, title: "Building a local transcription workspace", segments: [
    { start: 0, end: 8.125, text: "A local-first workflow keeps inference on your machine. Start with a video, then turn the spoken ideas into searchable text." },
    { start: 8.125, end: 17.5, text: "Timestamps connect every passage to its source. Open the original video to check context and verify a quotation." },
    { start: 17.5, end: 29, text: "Export your transcript as text, Markdown, JSON, or subtitles. SRT and WebVTT preserve timing for your editing workflow." }
  ] });
  await page.reload(); await submit(page);
  await expect(page.locator(".segment")).toHaveCount(3);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".result-header")).toBeVisible();
    await page.screenshot({ path: `release-artifacts/v0.3-workspace-${width}.png`, fullPage: true, animations: "disabled" });
  }
});
