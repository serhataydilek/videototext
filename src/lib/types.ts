export type JobStatus = "queued" | "running" | "completed" | "failed";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  transcript: string;
  summary: string;
  segments: TranscriptSegment[];
};

export type JobSnapshot = {
  id: string;
  status: JobStatus;
  progress: number;
  stage: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  result?: TranscriptResult;
  error?: string;
};

export type JobEvent =
  | { type: "snapshot"; job: JobSnapshot }
  | { type: "done"; job: JobSnapshot }
  | { type: "error"; job: JobSnapshot };
