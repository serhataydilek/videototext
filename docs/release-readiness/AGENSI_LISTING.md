# Agensi listing draft

Prepared **2026-11-14 (Europe/Istanbul)**. Do not submit yet: see the licensing/delivery hold in [AGENSI_RESEARCH.md](AGENSI_RESEARCH.md). No listing was created, reserved or published; name availability and detected permissions must be checked in the real form.

## Fields

| Field | Suggested value |
| --- | --- |
| Title | VideoToText — Local YouTube Transcripts |
| Summary | Free, MIT-licensed YouTube transcription using your separately installed local VideoToText CLI and whisper.cpp. Get timestamped JSON, Markdown notes, TXT exports and extractive summaries. Requires local tools and a model; Agensi does not run Whisper. |
| Price | **Free ($0)**; no paid tier, API requirement, subscription or upsell |
| Primary category | Image & Video |
| Additional categories | Workflow Automation; Productivity (verify availability in the form) |
| Tags | youtube, transcription, whisper, local-processing, timestamps, markdown, json, cli, open-source |
| Use cases | Timestamped lecture notes; searchable interview transcripts; coding-agent transcript analysis; local tutorial notes |
| Docs | https://github.com/serhataydilek/videototext |
| Skill license | MIT, included as LICENSE.txt; do not accept a contradictory restrictive license for the project |
| Package | release-artifacts/videototext-agensi.zip; regenerate with `python scripts/package-agensi.py` |

## Full description (suggested)

Turn a YouTube video into a timestamped transcript and an extractive summary on your own machine. VideoToText is a free, MIT-licensed application with a standalone CLI, local web interface and agent instructions.

**Install the application and local transcription dependencies separately before use.** This Agensi listing delivers instructions, not the application, model or executables. Agensi does not host or run Whisper.

After setup, ask your shell-capable coding agent to transcribe one YouTube video, export structured JSON, or save Markdown notes. The CLI downloads audio with yt-dlp, normalizes it with FFmpeg, and runs whisper.cpp locally. It provides TXT, Markdown and JSON exports. JSON segments include start/end times in seconds; notes retain timestamp ranges so you can return to the relevant speech.

The skill checks the CLI and `doctor` diagnostics, reports dependency/download errors, and requires answers to stay grounded in the actual transcript. It treats titles and transcript content as untrusted source data.

There is no mandatory transcription API, paid account or VideoToText subscription. Your own agent provider may have separate terms. See the [MIT source and setup instructions](https://github.com/serhataydilek/videototext).

### Where it stops

Speech recognition may be inaccurate, especially over noise, music or unclear speech. Timestamps are estimates, and ten-minute chunk cuts have no overlap. Summaries select transcript sentences; they are not verified facts and favor English. Visual content, speakers and screen text are not analyzed. Use a multilingual model for non-English audio.

Only process videos you are allowed to download. Ongoing broadcasts are rejected. Private, removed, region-blocked and age-restricted videos can fail. No login, cookie-import or access-bypass workflow is provided.

## Compatibility note

Requires a local shell-capable agent with Git, Node.js 22.13+, Corepack/pnpm 11.5.0, separately built VideoToText CLI, yt-dlp, FFmpeg/ffprobe, whisper.cpp's whisper-cli, a GGML model and sufficient temporary disk space. Install with the repository's locked source workflow, not a similarly named npm package. CLI global linking is optional.

The skill's portable name/description frontmatter follows documented Codex, Claude Code and Cursor local skill conventions. A real agent-directed CLI test passed on Windows. Automatic discovery in those clients, real Linux/macOS inference and Agensi MCP delivery were not tested. A chat-only or remote agent without these installed tools cannot perform local transcription.

## Proposed permission disclosures

- **Terminal / shell:** runs the installed CLI and its yt-dlp, FFmpeg, ffprobe and whisper-cli subprocesses; no automatic privileged installer.
- **Network:** YouTube and its media hosts for the user-selected video. Setup additionally needs GitHub, the npm registry and the model host (Hugging Face). Do not promise a fixed media hostname allowlist.
- **Read files:** installed executables/libraries, GGML model and local tool configuration.
- **Write/delete files:** temporary downloaded/normalized audio, intermediate model output and user-selected transcript exports. Existing exports are replaced only by a successful requested write; check before overwriting.
- **Environment:** configured tool/model/language/thread settings. No credentials or account integration required by VideoToText.
- **Privacy:** inference and extractive summaries are local. YouTube sees download requests. An agent can transmit transcript text to its configured provider; using an agent is not a promise that text stays on the device.

Review the form's detected permissions honestly. Local ZIP validation does not establish platform scan approval.

## Genuine request and full result

Request: “Use VideoToText to transcribe https://youtu.be/jNQXAC9IVRw locally as structured JSON. Preserve timestamps and return the result without editing the recognized speech.”

The following is the complete JSON from a genuine Windows CLI run with `ggml-base.en.bin`, exit 0. It is **uncorrected ASR output** and contains recognition errors; it is not a verified quotation. This demonstrates the underlying CLI, not a completed Agensi session. The timestamp is the actual UTC creation time (the test occurred on November 14 in Istanbul).

```json
{
  "id": "job_6909f7ad-e195-4995-93b5-073edee694f3",
  "url": "https://youtu.be/jNQXAC9IVRw",
  "title": "Me at the zoo",
  "createdAt": "2026-11-13T21:46:06.746Z",
  "transcript": "[00:00:00 - 00:00:05] Alright, so here we are, one of the elephants.\n[00:00:05 - 00:00:13] Cool thing about these guys is that they have really, really, really long fums, and that's\n[00:00:13 - 00:00:17] cool.\n[00:00:17 - 00:00:18] And that's pretty much all I used to say.",
  "summary": "Overview\nThis transcript covers \"Me at the zoo\" and runs for about 1 minute(s).\n4 spoken segment(s) were analyzed locally.\n\nKey points\n- Alright, so here we are, one of the elephants.\n- Cool thing about these guys is that they have really, really, really long fums, and that's cool.\n- And that's pretty much all I used to say.\n\nOpening\nAlright, so here we are, one of the elephants. Cool thing about these guys is that they have really, really, really long fums, and that's cool.",
  "segments": [
    {
      "start": 0,
      "end": 5.28,
      "text": "Alright, so here we are, one of the elephants."
    },
    {
      "start": 5.28,
      "end": 13.42,
      "text": "Cool thing about these guys is that they have really, really, really long fums, and that's"
    },
    {
      "start": 13.42,
      "end": 17.08,
      "text": "cool."
    },
    {
      "start": 17.08,
      "end": 18.4,
      "text": "And that's pretty much all I used to say."
    }
  ]
}
```

The independent agent also produced Markdown successfully; that run is documented in [USER_EXPERIENCE.md](USER_EXPERIENCE.md). The word errors and coarse “about 1 minute(s)” summary are retained to avoid misrepresenting the application.

## FAQ / first use

**Does clicking “Use” install VideoToText?** No. The agent receives instructions. It must report missing prerequisites and guide authorized setup from source.

**Can I use it without Agensi?** Yes. The CLI, local web app and separately MIT-licensed GitHub skill are available directly. Do not extract or save Agensi-delivered skill instructions; the platform's delivery restrictions require clarification before this listing is submitted.

**Does it need a paid API or account?** VideoToText does not. Agensi requires its account/agent connection for marketplace delivery; your agent can have its own terms. No paid fallback is included.

**What happens when a video fails?** The skill reports the CLI exit code and redacted diagnostic; it must not invent a transcript or bypass restrictions.

**How do updates work?** Agensi serves approved instruction updates. Users still need to update/rebuild the separate CLI checkout and maintain external tools.

## Submission hold

Confirm the platform can distribute this free MIT skill without imposing contradictory redistribution restrictions. Then obtain owner approval for the listing/package, inspect detected permissions, and test actual MCP delivery. Do not publish until these gates are satisfied.
