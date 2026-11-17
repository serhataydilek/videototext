"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Copy, Download, ExternalLink, FileText, Loader2, Menu, Plus, Search, Trash2, X } from "lucide-react";
import { buildExport, safeFilename, type ExportFormat } from "@/lib/export";
import { formatTimestamp, formatTimestampRange, isValidTimeRange } from "@/lib/time";
import { isValidYoutubeUrl, youtubeTimestampUrl } from "@/lib/youtube";
import type { JobSnapshot, TranscriptResult, TranscriptSegment } from "@/lib/types";

type ViewMode = "transcript" | "paragraph" | "summary";
const modes = [["transcript", "Timestamps"], ["paragraph", "Paragraph"], ["summary", "Summary"]] as const;
const formats = [["txt", "TXT"], ["md", "Markdown"], ["json", "JSON"], ["srt", "SRT"], ["vtt", "WebVTT"]] as const;
const dbName = "youtube-video-to-text";
const storeName = "transcripts";

export function VideoToTextApp() {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TranscriptResult[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [activeResult, setActiveResult] = useState<TranscriptResult | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const isRunning = isStarting || job?.status === "queued" || job?.status === "running";
  const progress = job && Number.isFinite(job.progress) ? Math.round(Math.max(0, Math.min(1, job.progress)) * 100) : 0;
  const filteredHistory = history.filter(item => `${item.title} ${item.url} ${item.transcript}`.toLowerCase().includes(historyQuery.trim().toLowerCase()));

  useEffect(() => {
    loadHistory().then((items) => {
      setHistory((current) => current.reduce((loaded, result) => upsertResult(loaded, result), items));
      setActiveResult((current) => current ?? items[0] ?? null);
    }).catch(() => setError("Browser history is unavailable. You can still transcribe and export results."));
    return () => sourceRef.current?.close();
  }, []);

  useEffect(() => {
    if (job?.status !== "completed" || !job.result) return;
    setActiveResult(job.result);
    saveResult(job.result).then(() => {
      setHistory((items) => upsertResult(items, job.result!));
    }).catch(() => setError("Transcript is ready, but browser history could not be saved. Export it to keep a copy."));
  }, [job]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    historyRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const mobile = window.matchMedia("(max-width: 760px)");
    const handleResize = () => { if (!mobile.matches) setSidebarOpen(false); };
    mobile.addEventListener("change", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      mobile.removeEventListener("change", handleResize);
    };
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  }

  async function startJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRunning) return;
    setIsStarting(true);
    setError(null);
    setJob(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok || !payload.job || typeof payload.job.id !== "string") {
        setError(payload.error ?? "The server did not return a valid job. Try again after checking the local server.");
        return;
      }
      setJob(payload.job);
      subscribeToJob(payload.job.id);
    } catch {
      setError("Could not reach the local transcription server. Make sure the app is running and reload the page.");
    } finally { setIsStarting(false); }
  }

  function subscribeToJob(id: string) {
    sourceRef.current?.close();
    const source = new EventSource(`/api/jobs/${id}/events`);
    sourceRef.current = source;
    const updateFromEvent = (event: MessageEvent<string>) => {
      setJob(JSON.parse(event.data) as JobSnapshot);
    };
    source.addEventListener("snapshot", updateFromEvent);
    source.addEventListener("done", (event) => { updateFromEvent(event as MessageEvent<string>); source.close(); });
    source.addEventListener("failed", (event) => { updateFromEvent(event as MessageEvent<string>); source.close(); });
    source.onerror = () => {
      const message = "Connection to the job stream was interrupted. The server may still be processing; wait before trying again.";
      setError(message);
      setJob((current) => current?.id === id && current.status !== "completed"
        ? { ...current, status: "failed", stage: "connection lost", message } : current);
      source.close();
    };
  }

  async function clearHistory() {
    try {
      await clearResults();
      setHistory([]);
      setActiveResult(null);
    } catch { setError("Could not clear browser history. Your saved transcripts were kept."); }
  }

  function newTranscript() {
    setActiveResult(null);
    setJob(null);
    setError(null);
    setUrl("");
    setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close history" onClick={closeSidebar} tabIndex={-1} />}
      <aside id="history-sidebar" ref={historyRef} className={`sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Transcript history"
        onKeyDown={event => {
          if (!sidebarOpen) return;
          if (event.key === "Escape") { event.preventDefault(); closeSidebar(); }
          if (event.key === "Tab") {
            const elements = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input");
            const first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <div className="brand"><FileText size={21} aria-hidden /><h1>VideoToText</h1><span className="version">0.3</span>
          <button className="icon-button mobile-only" onClick={closeSidebar} aria-label="Close sidebar"><X size={18} aria-hidden /></button>
        </div>
        <button className="new-button" onClick={newTranscript} disabled={isRunning}><Plus size={16} aria-hidden /> New transcript</button>
        <div className="history-header"><h2>History <span>{history.length}</span></h2>
          <button className="icon-button" onClick={clearHistory} disabled={history.length === 0} title="Clear history" aria-label="Clear history"><Trash2 size={14} aria-hidden /></button>
        </div>
        <label className="search-field history-search"><Search size={15} aria-hidden /><input type="search" aria-label="Search history" placeholder="Search history…" value={historyQuery} onChange={event => setHistoryQuery(event.target.value)} /></label>
        <div className="history-list">
          {filteredHistory.map(item => <button className={`history-item ${activeResult?.id === item.id ? "selected" : ""}`} key={item.id}
            aria-current={activeResult?.id === item.id ? "true" : undefined} onClick={() => { setActiveResult(item); if (sidebarOpen) closeSidebar(); }}>
            <FileText size={15} aria-hidden /><span><span className="history-title">{item.title}</span>
            <span className="history-date">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {item.segments.length} segments</span></span>
          </button>)}
          {!filteredHistory.length && <div className="history-empty">{historyQuery ? "No matching transcripts." : "Your transcripts will appear here."}</div>}
        </div>
        <div className="sidebar-footer"><span className="local-dot" /> Local workspace<span>v0.3.0</span></div>
      </aside>
      <main className="workspace" inert={sidebarOpen ? true : undefined}>
        <header className="workspace-header"><div><button ref={menuRef} className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open history" aria-expanded={sidebarOpen} aria-controls="history-sidebar"><Menu size={18} aria-hidden /></button>
          <span className="breadcrumb">Workspace</span><span className="breadcrumb-divider">/</span><span>{activeResult ? "Transcript" : "New transcript"}</span></div>
          <span className="local-label"><span className="local-dot" /> On-device processing</span>
        </header>
        <div className="workspace-body">
          <section className="composer" aria-label="New transcription">
            <div className="section-heading"><h2>Transcribe a video</h2><span>YouTube → text</span></div>
            <form className="url-form" onSubmit={startJob}>
              <label className="sr-only" htmlFor="youtube-url">YouTube URL</label>
              <input ref={inputRef} id="youtube-url" className="url-input" value={url} onChange={event => setUrl(event.target.value)} placeholder="Paste a YouTube URL…" disabled={isRunning} autoComplete="off" spellCheck={false} />
              <button className="primary-button" disabled={isRunning || !url.trim()}>{isRunning ? <Loader2 size={15} className="spin" aria-hidden /> : <ArrowRight size={15} aria-hidden />}{isRunning ? "Processing" : "Create transcript"}</button>
            </form>
            <p className="input-hint">Powered by whisper.cpp. No account. No paid API.</p>
            {(job || isStarting || error) && <div className={`status-panel ${job?.status === "failed" || error ? "has-error" : ""}`}>
              {(job || isStarting) && <><div className="status-line"><span className="status-stage">{isStarting ? "Connecting" : job?.stage}</span><span>{progress}%</span></div>
                <div className="progress-track" role="progressbar" aria-label="Job progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                <p className="status-message" role="status">{isStarting ? "Connecting to your local transcription server." : job?.message}</p></>}
              {(error || job?.error) && <div className="error-message" role="alert">{error || job?.error}</div>}
            </div>}
          </section>
          <section className="content-panel" aria-label={activeResult?.title ?? "Transcript workspace"}>
            {activeResult ? <ResultView key={activeResult.id} result={activeResult} /> : <div className="empty-state">
              <div className="empty-symbol"><FileText size={28} strokeWidth={1.3} aria-hidden /></div>
              <h2>{isRunning ? "Your transcript is taking shape" : "From video to working knowledge"}</h2>
              <p>{isRunning ? "Audio is processed on your machine. Your timestamped transcript will appear here when it’s ready." : "Paste a YouTube link above to get a searchable, timestamped transcript and a local summary."}</p>
              {!isRunning && <div className="empty-steps"><span>01 <span>Paste a link</span></span><span>02 <span>Transcribe locally</span></span><span>03 <span>Find & export</span></span></div>}
            </div>}
          </section>
          <footer className="workspace-footer"><span>Inference stays on your machine.</span><span>whisper.cpp / FFmpeg / yt-dlp</span></footer>
        </div>
      </main>
    </div>
  );
}

async function readJsonResponse(response: Response): Promise<{ error?: string; job?: JobSnapshot }> {
  try { return (await response.json()) as { error?: string; job?: JobSnapshot }; }
  catch { return { error: `The server returned ${response.status} without a valid JSON response.` }; }
}

function ResultView({ result }: { result: TranscriptResult }) {
  const [viewMode, setViewMode] = useState<ViewMode>("transcript");
  const [query, setQuery] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const needle = query.trim().toLowerCase();
  const segments = result.segments.filter(segment => segment.text.trim());
  const visibleSegments = segments.filter(segment => segment.text.toLowerCase().includes(needle));
  const paragraphs = segmentsToParagraphs(segments);
  const visibleText = viewMode === "summary" ? result.summary : viewMode === "paragraph" ? paragraphs.join("\n\n") : "";
  const matchCount = needle ? (viewMode === "transcript" ? visibleSegments.map(segment => segment.text).join("\n") : visibleText).toLowerCase().split(needle).length - 1 : 0;
  const end = Math.max(0, ...segments.filter(segment => isValidTimeRange(segment.start, segment.end)).map(segment => segment.end));
  const sourceUrl = isValidYoutubeUrl(result.url) ? result.url : null;

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(buildExport(result, "txt"));
      setCopyState("copied");
    } catch { setCopyState("failed"); }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 3000);
  }

  return <div className="result-view">
    <header className="result-header"><div className="result-title"><div className="eyebrow">TRANSCRIPT <span>·</span> {segments.length} SEGMENTS <span>·</span> {formatTimestamp(end)}</div>
      <h2>{result.title}</h2>
      {sourceUrl ? <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">{result.url}<ExternalLink size={12} aria-hidden /></a> : <span className="source-link">Source URL unavailable</span>}
    </div><div className="actions">
      <button className="secondary-button" onClick={copyTranscript}>{copyState === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copyState === "copied" ? "Copied" : "Copy transcript"}</button>
      <details className="export-menu" ref={exportRef} onKeyDown={event => { if (event.key === "Escape" && exportRef.current) { exportRef.current.open = false; exportRef.current.querySelector("summary")?.focus(); } }}>
        <summary className="secondary-button"><Download size={14} aria-hidden />Export<ChevronDown size={12} aria-hidden /></summary>
        <div className="export-options">{formats.map(([format, label]) => <button key={format} aria-label={label} onClick={() => { downloadText(result, format); if (exportRef.current) exportRef.current.open = false; }}>{label}<span>.{format}</span></button>)}</div>
      </details>
    </div></header>
    <span className={`copy-feedback ${copyState === "failed" ? "error-message" : ""}`} role="status">{copyState === "failed" ? "Clipboard unavailable. Use Export to save a copy." : copyState === "copied" ? "Transcript copied to clipboard." : ""}</span>
    <div className="result-toolbar"><div className="tabs" role="tablist" aria-label="Result sections" onKeyDown={event => {
      const index = modes.findIndex(([mode]) => mode === viewMode);
      const next = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 }[event.key];
      if (next === undefined) return;
      event.preventDefault(); setViewMode(modes[next][0]);
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")[next].focus();
    }}>{modes.map(([mode, label]) => <button key={mode} id={`result-tab-${mode}`} role="tab" aria-controls="result-panel" aria-selected={viewMode === mode} tabIndex={viewMode === mode ? 0 : -1} className={`tab ${viewMode === mode ? "active" : ""}`} onClick={() => setViewMode(mode)}>{label}</button>)}</div>
      <label className="search-field transcript-search"><Search size={14} aria-hidden /><input type="search" aria-label="Search transcript" placeholder="Find in transcript…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    {needle && <div className="search-status" role="status">{matchCount ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}` : "No matches found."}<button onClick={() => setQuery("")}>Clear search</button></div>}
    <div id="result-panel" role="tabpanel" aria-labelledby={`result-tab-${viewMode}`} tabIndex={0}>
      {viewMode === "summary" ? <div className="summary"><HighlightedText text={result.summary || "No summary is available."} query={query} /></div>
      : viewMode === "paragraph" ? <div className="paragraph-transcript">{paragraphs.map((paragraph, index) => <p key={index}><HighlightedText text={paragraph} query={query} /></p>)}</div>
      : <div className="transcript"><div className="transcript-column-head"><span>TIME</span><span>TRANSCRIPT <span className="timestamp-hint">Click a timestamp to open video ↗</span></span></div>
        {visibleSegments.map((segment, index) => {
          const validRange = isValidTimeRange(segment.start, segment.end);
          const href = validRange ? youtubeTimestampUrl(result.url, segment.start) : null;
          const label = validRange ? formatTimestampRange(segment.start, segment.end) : "Time unavailable";
          return <div className="segment" key={index}>{href ? <a className="timestamp" href={href} target="_blank" rel="noreferrer" aria-label={`Open video at ${formatTimestamp(segment.start)}`} title={label}>{label}</a> : <span className="timestamp">{label}</span>}<span><HighlightedText text={segment.text} query={query} /></span></div>;
        })}
        {!segments.length && <p className="no-segments">No transcript segments are available.</p>}
      </div>}
    </div>
  </div>;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const parts = [];
  let cursor = 0;
  const lower = text.toLowerCase();
  let index = lower.indexOf(needle);
  while (index !== -1) {
    parts.push(text.slice(cursor, index), <mark key={index}>{text.slice(index, index + needle.length)}</mark>);
    cursor = index + needle.length;
    index = lower.indexOf(needle, cursor);
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function segmentsToParagraphs(segments: TranscriptSegment[]): string[] {
  const paragraphs: string[] = [];
  let current = "";
  let sentenceCount = 0;
  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;
    current = current ? `${current} ${text}` : text;
    sentenceCount += text.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
    if (current.length >= 650 || sentenceCount >= 5) { paragraphs.push(current); current = ""; sentenceCount = 0; }
  }
  if (current) paragraphs.push(current);
  return paragraphs.length ? paragraphs : ["No transcript text is available."];
}

function downloadText(result: TranscriptResult, format: ExportFormat) {
  const mime = { txt: "text/plain", md: "text/markdown", json: "application/json", srt: "application/x-subrip", vtt: "text/vtt" };
  const blob = new Blob([buildExport(result, format)], { type: `${mime[format]};charset=utf-8` });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFilename(result.title)}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(result);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Browser history write was aborted."));
    });
  } finally {
    db.close();
  }
}

async function loadHistory(): Promise<TranscriptResult[]> {
  const db = await openDb();
  try {
    const items = await new Promise<TranscriptResult[]>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as TranscriptResult[]);
      request.onerror = () => reject(request.error);
    });
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } finally {
    db.close();
  }
}

async function clearResults(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Browser history clearing was aborted."));
    });
  } finally {
    db.close();
  }
}
