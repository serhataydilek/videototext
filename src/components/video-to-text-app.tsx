"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Download, FileText, History, Loader2, Trash2, Youtube } from "lucide-react";
import { buildMarkdownExport, buildTxtExport, safeFilename } from "@/lib/export";
import { formatTimestampRange } from "@/lib/time";
import type { JobSnapshot, TranscriptResult, TranscriptSegment } from "@/lib/types";

type ViewMode = "summary" | "paragraph" | "transcript";

const dbName = "youtube-video-to-text";
const storeName = "transcripts";

export function VideoToTextApp() {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TranscriptResult[]>([]);
  const [activeResult, setActiveResult] = useState<TranscriptResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("summary");

  const isRunning = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    loadHistory().then((items) => {
      setHistory(items);
      setActiveResult(items[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (job?.status !== "completed" || !job.result) {
      return;
    }

    saveResult(job.result).then(() => {
      setHistory((items) => upsertResult(items, job.result!));
      setActiveResult(job.result!);
      setViewMode("summary");
    });
  }, [job]);

  async function startJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setJob(null);

    let response: Response;
    try {
      response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
    } catch {
      setError("Could not reach the local transcription server. Make sure the app is running and reload the page.");
      return;
    }

    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setError(payload.error ?? "Could not start the job.");
      return;
    }

    const nextJob = payload.job as JobSnapshot;
    setJob(nextJob);
    subscribeToJob(nextJob.id);
  }

  function subscribeToJob(id: string) {
    const source = new EventSource(`/api/jobs/${id}/events`);

    const updateFromEvent = (event: MessageEvent<string>) => {
      setJob(JSON.parse(event.data) as JobSnapshot);
    };

    source.addEventListener("snapshot", updateFromEvent);
    source.addEventListener("done", (event) => {
      updateFromEvent(event as MessageEvent<string>);
      source.close();
    });
    source.addEventListener("failed", (event) => {
      updateFromEvent(event as MessageEvent<string>);
      source.close();
    });
    source.onerror = () => {
      setError("Connection to the job stream was interrupted. Restart the job if progress does not continue.");
      source.close();
    };
  }

  async function clearHistory() {
    await clearResults();
    setHistory([]);
    setActiveResult(null);
  }

  const selectedTitle = useMemo(
    () => activeResult?.title ?? "Transcript workspace",
    [activeResult]
  );

  return (
    <main className="app-shell">
      <div className="workspace">
        <aside>
          <section className="sidebar">
            <div className="brand">
              <Youtube size={34} strokeWidth={2.2} aria-hidden />
              <h1>YouTube Video To Text</h1>
              <p>Paste a video URL, transcribe the audio locally, and save the result in this browser.</p>
            </div>

            <form className="url-form" onSubmit={startJob}>
              <label className="input-label" htmlFor="youtube-url">
                YouTube URL
              </label>
              <input
                id="youtube-url"
                className="url-input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isRunning}
              />
              <button className="primary-button" disabled={isRunning || !url.trim()}>
                {isRunning ? <Loader2 size={18} className="spin" aria-hidden /> : <FileText size={18} aria-hidden />}
                {isRunning ? "Processing" : "Create transcript"}
              </button>
            </form>

            {(job || error) && (
              <div className="status-panel">
                {job && (
                  <>
                    <div className="status-line">
                      <span className="status-stage">{job.stage}</span>
                      <span>{Math.round(job.progress * 100)}%</span>
                    </div>
                    <div className="progress-track" aria-label="Job progress">
                      <div className="progress-bar" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                    </div>
                    <p className="status-message">{job.message}</p>
                  </>
                )}
                {(error || job?.error) && <div className="error-message">{error || job?.error}</div>}
              </div>
            )}
          </section>

          <section className="history-panel">
            <div className="history-header">
              <h2>
                <History size={16} aria-hidden /> History
              </h2>
              <button className="icon-button" onClick={clearHistory} disabled={history.length === 0} title="Clear history">
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
            <div className="history-list">
              {history.map((item) => (
                <button className="history-item" key={item.id} onClick={() => setActiveResult(item)}>
                  <span className="history-title">{item.title}</span>
                  <span className="history-date">{new Date(item.createdAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="content-panel" aria-label={selectedTitle}>
          {activeResult ? (
            <ResultView result={activeResult} viewMode={viewMode} setViewMode={setViewMode} />
          ) : (
            <div className="empty-state">
              <div>
                <Clock size={42} aria-hidden />
                <h2>No transcript selected</h2>
                <p>Completed transcripts will appear here and remain available from this browser history.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function readJsonResponse(response: Response): Promise<{ error?: string; job?: JobSnapshot }> {
  try {
    return (await response.json()) as { error?: string; job?: JobSnapshot };
  } catch {
    return { error: `The server returned ${response.status} without a valid JSON response.` };
  }
}

function ResultView({
  result,
  viewMode,
  setViewMode
}: {
  result: TranscriptResult;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}) {
  return (
    <div className="result-view">
      <header className="result-header">
        <div>
          <h2>{result.title}</h2>
          <a className="source-link" href={result.url} target="_blank" rel="noreferrer">
            {result.url}
          </a>
        </div>
        <div className="actions">
          <button className="secondary-button" onClick={() => downloadText(result, "txt")}>
            <Download size={17} aria-hidden /> TXT
          </button>
          <button className="secondary-button" onClick={() => downloadText(result, "md")}>
            <Download size={17} aria-hidden /> Markdown
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Result sections">
        <button className={`tab ${viewMode === "summary" ? "active" : ""}`} onClick={() => setViewMode("summary")}>
          Summary
        </button>
        <button className={`tab ${viewMode === "paragraph" ? "active" : ""}`} onClick={() => setViewMode("paragraph")}>
          Paragraph
        </button>
        <button className={`tab ${viewMode === "transcript" ? "active" : ""}`} onClick={() => setViewMode("transcript")}>
          Timestamps
        </button>
      </div>

      {viewMode === "summary" ? (
        <div className="summary">{result.summary}</div>
      ) : viewMode === "paragraph" ? (
        <div className="paragraph-transcript">
          {segmentsToParagraphs(result.segments).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <div className="transcript">
          {result.segments.map((segment, index) => (
            <div className="segment" key={`${segment.start}-${index}`}>
              <span className="timestamp">{formatTimestampRange(segment.start, segment.end)}</span>
              <span>{segment.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function segmentsToParagraphs(segments: TranscriptSegment[]): string[] {
  const paragraphs: string[] = [];
  let current = "";
  let sentenceCount = 0;

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) {
      continue;
    }

    current = current ? `${current} ${text}` : text;
    sentenceCount += countSentenceEndings(text);

    if (current.length >= 650 || sentenceCount >= 5) {
      paragraphs.push(current);
      current = "";
      sentenceCount = 0;
    }
  }

  if (current) {
    paragraphs.push(current);
  }

  return paragraphs.length > 0 ? paragraphs : ["No transcript text is available."];
}

function countSentenceEndings(value: string): number {
  return value.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
}

function downloadText(result: TranscriptResult, format: "txt" | "md") {
  const content = format === "txt" ? buildTxtExport(result) : buildMarkdownExport(result);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFilename(result.title)}.${format}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function upsertResult(items: TranscriptResult[], result: TranscriptResult): TranscriptResult[] {
  return [result, ...items.filter((item) => item.id !== result.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveResult(result: TranscriptResult): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(result);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadHistory(): Promise<TranscriptResult[]> {
  const db = await openDb();
  const items = await new Promise<TranscriptResult[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as TranscriptResult[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function clearResults(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
