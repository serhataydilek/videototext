import { spawn } from "node:child_process";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; signal?: AbortSignal; maxStdoutBytes?: number } = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    options.signal?.throwIfAborted();
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let timeout: NodeJS.Timeout | undefined;
    let stopped: Error | undefined;
    let stdoutBytes = 0;

    // yt-dlp can launch ffmpeg and Node. Stop the tree before deleting its files.
    function stop(reason: Error) {
      if (stopped || !child.pid) return;
      stopped = reason;
      if (process.platform === "win32") {
        const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true, stdio: "ignore"
        });
        killer.on("error", () => child.kill());
        killer.on("exit", (code) => { if (code) child.kill(); });
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill();
        }
      }
    }
    const abort = () => stop(new Error("Interrupted."));
    options.signal?.addEventListener("abort", abort, { once: true });

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        stop(new Error(`${command} timed out after ${options.timeoutMs}ms.`));
      }, options.timeoutMs);
    }

    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > (options.maxStdoutBytes ?? 8 * 1024 * 1024)) {
        stop(new Error(`${command} exceeded the stdout size limit.`));
        return;
      }
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8192);
    });

    child.on("error", (error) => {
      stopped ??= error;
    });

    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      if (stopped) {
        reject(stopped);
        return;
      }

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
    });
  });
}
