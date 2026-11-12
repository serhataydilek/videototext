import { transcribe } from "../transcribe";
import { completeJob, updateJob } from "./store";

export async function processJob(id: string, url: string): Promise<void> {
  const result = await transcribe(id, url, (update) => updateJob(id, { ...update, status: "running" }));
  completeJob(id, result);
}
