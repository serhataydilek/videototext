# Technical audit

**Final v0.2.1 update:** the original PR #2 findings below are retained as a baseline. The final dependency review and browser evidence are appended at the end; earlier browser-unverified and advisory-count statements are historical.

Audit date: **2026-11-14 (Europe/Istanbul)**. Baseline: merged main `5a7be3e`, package version 0.2.0. Working branch: `feat/release-readiness`. Scope includes all tracked application, CLI, pipeline, tests, skill, setup, manifest/lockfile and CI files. No credentials or local configuration are reproduced here.

## Findings and disposition

Severity reflects impact in this **single-user local application**. “Not demonstrated” does not mean impossible. Effort: S = local patch, M = broader lifecycle work, L = migration/platform work.

| Priority | Evidence / root cause | Impact | Effort | Disposition / validation |
| --- | --- | --- | --- | --- |
| P0 critical | Locked Next 15.5.18 falls in upstream Windows RCE advisory range | Network-reachable Windows server compromise | S | Updated Next/eslint-config-next to 15.5.29; build/typecheck/tests passed. [Upstream advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) |
| P1 high | Lockfile included vulnerable sharp, PostCSS, nanoid, source-map-js | Image/build dependency risks; applicability depends on feature/input | S | Scoped dependency overrides retain Next 15; resolved sharp 0.35.5, Next's PostCSS 8.5.32, nanoid ≥3.3.18, source-map-js 1.2.2. Production audit now 0 critical, 1 high; see residual below. [Image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) |
| P1 high | `POST /api/jobs` accepted cross-origin simple requests; server default listened beyond loopback | A browser page or network client could trigger expensive local processing | S | Loopback defaults for dev/start; reject non-loopback Host, mismatched Origin and non-JSON content. Tests cover forms, Origin, DNS-rebinding Host and Next's reconstructed localhost URL. This is not authentication |
| P1 high | yt-dlp inherited ambient configs/plugins | User-level output paths, cookie/proxy settings or executable hooks could change processing unexpectedly | S | Pipeline passes `--ignore-config` / `--no-plugin-dirs`; tests assert arguments. Existing yt-dlp customizations are intentionally no longer honored. [Upstream options](https://github.com/yt-dlp/yt-dlp) |
| P1 medium | SSE route attached listeners without disconnect cleanup | Abandoned clients retained listeners; subsequent enqueue into a cancelled stream could disrupt job updates | S | Abort and cancellation remove listeners; terminal events close cleanly. Three stream lifecycle tests |
| P2 medium | Offsets used `index * 600`, while FFmpeg segment boundaries depend on sample/packet timing | Accumulating timestamp drift on multi-chunk videos | S | Measure each WAV with ffprobe and accumulate actual durations. AAC reproduction produced 600.002625, 600.003625 and 0.999500 seconds; mocked regression deliberately uses 600.125 seconds |
| P2 medium | Whisper JSON was only a TS cast; missing offsets silently became zero | Misleading timestamps or crashes from malformed upstream data | S | Reject absent/reversed/negative/non-numeric offsets or invalid text; clamp intervals to actual chunk duration and discard empty spans. Failure tests preserve earlier exports and clean temporary files |
| P2 medium | Ongoing livestream could keep downloading without finishing | Unbounded waiting/storage for a workflow intended for finite videos | S | Reject metadata `is_live` before download with an actionable message; completed broadcasts still supported |
| P2 medium | Child stdout accumulated without a limit | Unexpected tool output could grow process memory | S | 8 MiB default cap terminates the process tree with an explicit error; real-child test. stderr was already bounded to its last 8 KiB |
| P2 medium | CLI handled SIGINT only | Normal POSIX termination could skip cleanup | S | SIGTERM uses the same abort/cleanup path and exit 130. SIGINT/timeout subprocess behavior tested on Windows; POSIX signal delivery is not locally verified |
| P2 medium | Browser result selection waited for successful IndexedDB write | A successful transcript could remain invisible when storage failed | S | Display result immediately; handle history-load/save errors with export guidance. Type/build validation only; browser storage-failure behavior not interactively verified |
| P2 medium | Vitest alias used URL pathname, which is not a Windows filesystem path | Newly added route tests failed to resolve `@/` | S | `fileURLToPath` fixes spaces/drive letters without an extra plugin; all 53 tests pass |
| P2 residual | In-memory web jobs are retained indefinitely, with no concurrency or disk quota | Long sessions/parallel jobs can exhaust local resources | M | Documented local single-user restriction. No queue/auth/storage platform added. A bounded queue/retention policy remains future lifecycle work |
| P2 residual | Web worker has no abort signal on server shutdown; SIGKILL/power loss cannot execute finally | Lost job state and possibly orphaned children/temp audio | M | Documented separately from the CLI guarantee; no claim of crash-safe cleanup or resumability |
| P2 residual | No whole-job deadline; audio download/conversion/inference can run a long time | Slow or hung tool/model may require interruption | M | Metadata/probes have deadlines; downloader sockets bounded to 30 seconds with upstream retries. No arbitrary inference-speed limit introduced; Ctrl+C supported in CLI |
| P3 low | Extractive summary uses English stopwords/ASCII word scoring and rounds short durations to at least one minute | Weak multilingual ranking and coarse overview wording | S/M | Clearly disclosed, no quality guarantee or translation feature added |
| P3 low | TXT/Markdown timestamps omit fractional seconds; hard chunk cuts have no overlap | Display loses precision; words can straddle boundaries | M | JSON preserves hundredths; documented estimates/limitations. No forced alignment, diarization or boundary-quality claim |
| P3 low | `next lint` has no project ESLint configuration | Standalone lint onboarding is incomplete | S | Not silently treated as a successful lint run. Requested tests, standalone tsc, CLI and production builds are the validation gates here |

## Architecture and correctness

`src/server/transcribe.ts` is the shared pipeline. The CLI calls it directly; `jobs/worker.ts` adapts its progress/results for the in-memory web store. Shared types, URL validation, timestamp helpers and export functions avoid duplicate transcription logic. Pure helpers are tested. TypeScript passes; it cannot validate executable JSON, which now receives explicit runtime checks.

Errors propagate to CLI stderr/exit codes or failed job events. The pipeline owns a unique system-temp directory with a `finally` cleanup. CLI writes a unique temporary sibling and renames only after success, preserving an existing export on transcription/write failures. A successful output intentionally replaces the destination. Missing parents and unwritable paths remain clear I/O failures. These are unrestricted user-selected local destinations, not a multi-user filesystem sandbox.

## Security boundaries

Subprocess execution uses argument arrays and `shell: false`; URLs have a strict YouTube-host/video-ID schema, reject credentials/custom ports and are not used as filenames. A real child test preserves shell metacharacters literally. All generated media/chunk filenames are internal. Model/executable paths come from trusted local configuration; do not accept an attacker-supplied `.env.local` or binary. The supplied URL remains the export source instead of trusting an arbitrary metadata `webpage_url`.

React displays source text as text, not `dangerouslySetInnerHTML`. Markdown exports contain raw source prose, so render exported documents with an untrusted-content policy; do not execute embedded content. Transcripts/metadata can contain prompt injection: the skill now explicitly treats these as data and forbids following their instructions. This is instruction-level mitigation, not proof against every model attack.

Loopback binding plus request checks reduce exposure but provide no users, auth, rate limit, storage quota or public-hosting security model. Do not publish this server on the Internet. Third-party tools/model weights retain their own licenses; FFmpeg builds may have GPL components. Obtain them from trusted upstream distributions. No binaries are redistributed in the skill ZIP and no tool installation is automated.

## Dependency audit and residual exposure

Registry audit snapshots on the access date:

| Scope | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Baseline production | 3 | 13 | 9 | 0 |
| After fixes, production | 0 | 1 | 0 | 0 |
| After fixes, all dependencies | 3 | 16 | 15 | 1 |

These count advisories, not proven exploits or unique vulnerable packages. Remaining production finding: [Zod collection-validation memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), patched in 4.6.6. This repository uses Zod only for a URL string/refinement, not the affected array-validation behavior; no reachable array parse was found. No unnecessary Zod major migration was performed. Do not describe the dependency audit as clean.

Development-only critical findings include [Vitest UI/API file access/execution](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp) and tinypool prototype-pollution gadgets ([worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)). The project invokes `vitest run` without UI/browser/API mode and does not feed network input to worker options. No upstream prototype-pollution source was demonstrated here. Do not expose a Vitest/Vite UI or run untrusted tests as safe data. A coordinated tooling upgrade is still recommended before claiming all-dependency security readiness; it is not disguised as a small runtime patch.

## Compatibility and validation limits

Local checks used Windows, Node 24.14.0, pinned pnpm 11.5.0, Python 3.14.3 for packaging, existing yt-dlp/FFmpeg/whisper.cpp and an English base model. CI targets Node 22 on Ubuntu, Windows and macOS; its actual PR run is recorded in the release checklist. A successful mocked CI run does not prove real audio inference on those OSes or every Node version satisfying `engines`.

The [Codex documentation](https://learn.chatgpt.com/docs/build-skills), [Claude Code documentation](https://code.claude.com/docs/en/skills), and [Cursor documentation](https://cursor.com/docs/skills) support the listed name/description skill layout and local directories. A real agent followed the skill and ran the local CLI successfully. Automatic discovery in those three clients and Agensi MCP delivery were not tested.

Production HTTP and browser outcomes, clean-source installation and the uncorrected real transcript are in [USER_EXPERIENCE.md](USER_EXPERIENCE.md). No penetration test, multilingual quality study, large-video benchmark, multi-hour fault test or crash-safe cleanup claim is made.

## Final v0.2.1 dependency review — 2026-11-14

Official advisory pages were revisited on this date. Safe updates within existing dependency ranges resolved js-yaml to 4.3.2, brace-expansion to 1.1.22 / 5.0.13, and Vite's PostCSS to 8.5.32. Framework/runtime major versions were retained. Playwright 1.65.0 is a development-only test dependency, justified by the actual browser fault regressions and genuine acceptance test; its browser binaries are not part of the application or skill ZIP.

| Audit scope | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Before final updates, all dependencies | 3 | 16 | 15 | 1 |
| Final, all dependencies | 3 | 2 | 11 | 1 |
| Final, production only | 0 | 1 | 0 | 0 |

These are registry advisory counts, not proof of exploitability. No affected production path was identified for the remaining Zod array issue: `src/lib/youtube.ts` uses only `z.string().trim().url().refine(...)`. Arrays fail its string check; no collection schema processes attacker-controlled items. Migrating Zod to a new major solely to erase a non-applicable advisory was not justified. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

The remaining development criticals are Vitest UI/API access and tinypool worker/run-option prototype-pollution gadgets. The project runs `vitest run`, with no Vitest UI, browser mode or public API listener, and does not pass network-derived worker options. The **Playwright** browser suite is separate from Vitest Browser Mode. No prototype-pollution source reaching tinypool was demonstrated. Do not run untrusted tests or expose Vite/Vitest tooling. [Vitest advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp), [tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).

The remaining high Vite finding concerns Windows editor-opening middleware and a crafted file argument. VideoToText serves through Next, not Vite; the unit tests do not expose that editor middleware. Other remaining Vite/esbuild/mocker/minimatch findings are also development tooling, not transcription endpoints. Patched versions fall outside the current compatible ranges: Vitest/Vite/tinypool/minimatch need major-version coordination, and esbuild needs a different 0.x range. No unsupported transitive override or test-runner migration was introduced in this maintenance patch. [Editor middleware advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm). This is a documented residual tooling risk, not a clean audit claim.

The loopback Host/Origin/content-type restrictions remain intact. Actual browser POST and download behavior passed without weakening them; existing route/process tests still pass. Final browser tests also confirmed and fixed the storage-read race, duplicate submission window, stuck form after stream loss, invisible malformed-response/clear failures, inaccessible view tabs, and mobile tab fit. See [USER_EXPERIENCE.md](USER_EXPERIENCE.md) for the distinction between real inference and isolated fault fixtures. The local single-user/no-quota/no-resume limitations remain.
