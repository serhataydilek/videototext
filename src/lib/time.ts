export function formatTimestamp(seconds: number): string {
  const safeSeconds = isValidTimestamp(seconds) ? Math.floor(seconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function isValidTimestamp(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 0 && Number.isSafeInteger(Math.round(seconds * 1000));
}

export function isValidTimeRange(start: number, end: number): boolean {
  return isValidTimestamp(start) && isValidTimestamp(end) && Math.round(end * 1000) > Math.round(start * 1000);
}

export function formatSubtitleTimestamp(seconds: number, separator: "," | "."): string {
  const milliseconds = isValidTimestamp(seconds) ? Math.round(seconds * 1000) : 0;
  return `${formatTimestamp(Math.floor(milliseconds / 1000))}${separator}${String(milliseconds % 1000).padStart(3, "0")}`;
}

export function formatTimestampRange(start: number, end: number): string {
  return `${formatTimestamp(start)} - ${formatTimestamp(end)}`;
}
