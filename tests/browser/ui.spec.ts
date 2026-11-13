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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("YouTube Video To Text");
  await submit(page);
  await expect(page.getByRole("heading", { name: result.title, exact: true })).toBeVisible();
  await expect(page.locator(".summary")).toHaveText(result.summary);
  await page.getByRole("tab", { name: "Paragraph", exact: true }).click();
  await expect(page.locator(".paragraph-transcript")).toHaveText(result.segments[0].text);
  await page.getByRole("tab", { name: "Timestamps", exact: true }).click();
  await expect(page.locator(".timestamp")).toHaveText("00:00:01 - 00:00:03");
  for (const [button, extension] of [["TXT", "txt"], ["Markdown", "md"]]) {
    const pending = page.waitForEvent("download");
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
  await page.getByRole("tab", { name: "Summary", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Paragraph", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(result.segments[0].text);
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Timestamps", exact: true })).toHaveAttribute("aria-selected", "true");
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
