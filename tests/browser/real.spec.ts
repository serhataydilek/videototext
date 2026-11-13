import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

test("real: YouTube transcription, progress, views, exports and persisted history", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const stages = new Set<string>();
  await page.exposeFunction("recordStage", (stage: string) => stages.add(stage));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const stage = document.querySelector(".status-stage")?.textContent;
      if (stage) (window as unknown as { recordStage: (stage: string) => void }).recordStage(stage);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByLabel("YouTube URL").fill("https://youtu.be/jNQXAC9IVRw");
  await page.getByRole("button", { name: "Create transcript", exact: true }).click();
  await expect(page.locator(".primary-button")).toBeDisabled();
  await expect(page.locator(".status-stage")).not.toHaveText("queued", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Me at the zoo", exact: true })).toBeVisible({ timeout: 150_000 });
  await expect(page.locator(".status-stage")).toHaveText("completed");
  await expect(page.locator(".error-message")).toHaveCount(0);
  await page.getByRole("tab", { name: "Paragraph", exact: true }).click();
  await expect(page.locator(".paragraph-transcript")).not.toBeEmpty();
  await page.getByRole("tab", { name: "Timestamps", exact: true }).click();
  const segments = await page.locator(".segment").allTextContents();
  const speech = await page.locator(".segment > span:last-child").allTextContents();
  expect(segments.length).toBeGreaterThan(0);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/v0.2.1-desktop.png", fullPage: true });
  for (const [button, extension] of [["TXT", "txt"], ["Markdown", "md"]]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const download = await pending;
    const text = await readFile((await download.path())!, "utf8");
    expect(text).toContain("Me at the zoo");
    expect(text).toContain("https://youtu.be/jNQXAC9IVRw");
    expect(text).toContain("00:00:");
    for (const sentence of speech) expect(text).toContain(sentence);
    await writeFile(`release-artifacts/real-browser-transcript.${extension}`, text);
  }
  await page.getByRole("tab", { name: "Summary", exact: true }).click();
  await expect(page.locator(".summary")).toContainText("Key points");
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Me at the zoo", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Timestamps", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/screenshots/v0.2.1-mobile.png", fullPage: true });
  expect(stages.has("transcribing")).toBe(true);
  expect(errors).toEqual([]);
  await writeFile("release-artifacts/real-browser-evidence.json", JSON.stringify({
    url: "https://youtu.be/jNQXAC9IVRw", browser: await page.context().browser()!.version(),
    stages: [...stages], segments, pageErrors: errors, viewports: [{ width: 1280, height: 900 }, { width: 390, height: 844 }]
  }, null, 2));
});
