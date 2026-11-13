# VideoToText v0.2.1 — Safer local transcription and browser reliability

VideoToText remains free, MIT-licensed and local-first, with no mandatory paid API, account, subscription or paid tier. Use the standalone CLI, local web app, or agent skill to create timestamped transcripts and extractive notes from YouTube audio.

## Fixes

- Measure WAV chunk durations for timestamp offsets and validate Whisper output before export.
- Reject ongoing livestreams and preserve the validated video source URL.
- Clean up disconnected event streams, handle CLI SIGTERM, and bound captured subprocess output.
- Keep completed transcripts visible when browser storage is blocked/full or an initial history read is delayed.
- Show actionable malformed-response and history-clear errors, prevent duplicate pending submissions, and restore controls after an interrupted progress stream.
- Add keyboard-operable view tabs, screen-reader status/error semantics, and a mobile tab-strip fit correction.
- Bind local web commands to loopback, validate job-request origins/hosts, and ignore ambient yt-dlp configuration/plugins.
- Update Next.js 15 and scoped runtime dependencies, plus compatible development dependency security patches.

## Documentation and validation

Source installation, model selection, privacy and agent setup are documented. Genuine desktop/mobile screenshots and a reproducible Playwright suite now accompany the existing unit tests. A real Windows Chromium run exercised the YouTube download → FFmpeg → whisper.cpp → browser result, progress, all views, TXT/Markdown downloads and persisted history. Isolated UI fault tests are explicitly identified as mocked; CI does not download videos or run speech inference.

The Agensi ZIP remains a free, text-only companion skill containing instructions and the MIT license. **Agensi does not install VideoToText or host Whisper.** The CLI, tools and GGML model must be installed separately. Marketplace submission remains on hold pending licensing/redistribution clarification.

## Upgrade from 0.2.0

Preserve your `.env.local` and exports. Update your checkout to the approved v0.2.1 revision, then run:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:cli
node dist/cli/main.js doctor
```

Keep an existing linked checkout in place. For the web app, rebuild with `corepack pnpm build` and restart with `corepack pnpm start`. Update a locally installed skill by copying its separately MIT-licensed GitHub folder. An Agensi instruction update does not update your CLI or tools.

## Compatibility and known limitations

- Node.js minimum remains 22.13.0; pnpm is pinned to 11.5.0. The package remains private. Existing CLI options and JSON/export formats are preserved.
- Tool/model installation remains separate. Global yt-dlp configs/plugins are intentionally ignored; custom/public web hosts are unsupported.
- Whisper can mishear speech or hallucinate over noise. Timestamps are estimates; TXT/Markdown display whole seconds. Ten-minute cuts have no overlap. Summaries favor English and can repeat recognition errors.
- Local web jobs have no auth, disk quota, bounded retention or resumability. Closing a tab stops its event subscription, not the server's transcription. Forced termination cannot guarantee cleanup.
- The dependency audit is **not clean**: one production Zod array-validation advisory has no affected array parse in this application; development-only Vitest/Vite/tinypool/minimatch/esbuild advisories remain. See `TECHNICAL_AUDIT.md` for counts and applicability. No major framework or test-runner migration is bundled here.
- Browser acceptance used Chromium on Windows with desktop/mobile viewports. Physical phones, other browser engines, automatic agent-skill discovery, Agensi MCP delivery and real Linux/macOS speech inference remain unverified.

This file prepares release text. No tag, GitHub Release, npm package or marketplace listing is created by this change.
