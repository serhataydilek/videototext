# Release preparation

Prepared **2026-11-14 (Europe/Istanbul)**. Nothing in this checklist authorizes publication, a tag, merge, npm upload, or Agensi submission.

## Prepared version and title

**0.2.1 — Safer local transcription and clearer agent setup**

These changes correct reliability/security behavior and documentation around existing CLI/web/skill capabilities. They do not add a new input type, hosted service, output format or major workflow. A patch release is more appropriate than 0.3.0. Following successful browser validation and the owner's explicit preparation request, `package.json` is now **0.2.1**, with `private: true` and MIT preserved. The frozen lockfile is consistent; it does not store the root package version. No tag or release has been created. The instructions-only ZIP remains unversioned and submission remains on hold.

Final release text: [RELEASE_NOTES_v0.2.1.md](RELEASE_NOTES_v0.2.1.md). The notes below retain the original maintenance-release scope and are supplemented by the final browser fixes.

## Draft release notes

VideoToText remains free and MIT-licensed, with no transcription API, account requirement, subscription or paid tier. This maintenance release improves the existing local YouTube → Whisper → transcript/summary workflow.

### Fixed

- Use measured WAV durations for offsets across ten-minute chunks and validate Whisper's timestamp/text data before exporting.
- Reject ongoing livestreams with a clear message instead of starting an open-ended audio download.
- Remove SSE listeners after client disconnects or completed jobs.
- Keep a completed web result available when browser history cannot be saved, with export guidance.
- Abort CLI processing on SIGTERM as well as Ctrl+C, and cap captured child stdout.
- Bind the web commands to loopback and reject cross-origin, non-JSON and non-loopback job submissions.
- Ignore ambient yt-dlp config/plugin directories for predictable processing; preserve the validated source URL.
- Update Next.js 15 and scoped transitive dependencies for known security advisories; correct Windows test alias resolution.
- Preserve a new result across a delayed history read; report storage-clear and malformed-response failures, prevent duplicate pending submissions, and restore controls after stream failure.
- Provide keyboard-operated view tabs, accessible progress/error status and a tab-strip fit fix at mobile widths.

### Documentation and skill

- Complete clone/build/direct-Node instructions, optional CLI linking, dependency/model guidance, permissions, privacy, and limitations.
- Agent instructions cover doctor, JSON, Markdown, timestamp evidence, output preservation, errors and untrusted transcript content.
- Research and a $0 Agensi listing/package are prepared, with a licensing/delivery hold clearly identified.

### Upgrade

After the release is approved and merged, preserve `.env.local` and saved exports, update a clean source checkout to the approved version, then run:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:cli
node dist/cli/main.js doctor
```

An existing `npm link` continues to point to that checkout; rebuild it in place. For the web app, run `corepack pnpm build` and restart `corepack pnpm start`. Copy the updated skill from GitHub into the documented client skill folder when using a local skill. Agensi instruction updates do not update installed application files or dependencies.

### Compatibility notes

Node minimum remains 22.13.0; pnpm remains pinned at 11.5.0. CLI options, JSON fields, exports, routes and MIT license remain. SIGTERM now exits 130 after attempted cleanup. Existing yt-dlp global configs/plugins are intentionally ignored. The web server supports loopback hostnames (`localhost`, `127.0.0.1`, `[::1]`), not custom/public deployment hosts. Model/tool binaries remain separately installed. Platform CI is mocked pipeline validation; only Windows received a real audio test here.

### Known limitations

- Speech recognition can be wrong; timestamps are estimates. JSON has fractional seconds, TXT/Markdown display whole seconds. Hard chunk cuts can split speech.
- Summary extraction favors English and can repeat recognition errors; short duration descriptions are coarse.
- No auth, disk quota, bounded web queue/retention or resume support. Web-server shutdown and forced termination do not promise cleanup.
- No overall inference deadline. Private/restricted/unavailable videos can fail; no bypass workflow is provided.
- Remaining registry advisories: production Zod array-validation issue with no affected array parse found in this code; development tooling advisories remain. The full audit is not clean.
- Chromium desktop/mobile viewport and storage-fault acceptance now pass. Physical phones, other browser engines, automatic client skill discovery, Agensi MCP delivery and real Linux/macOS inference are unverified.

## Validation record

| Check | Result |
| --- | --- |
| Baseline tests | 32/32 passed |
| Final local tests | 53/53 passed in 7 files |
| `corepack pnpm exec tsc --noEmit` | Passed |
| `corepack pnpm run build:cli` | Passed |
| `corepack pnpm build` | Passed, Next 15.5.29 |
| Fresh source install/build/help | Passed; unconfigured doctor exit 3, configured doctor exit 0 |
| Final clean Git clone | Source `fda2b7f`: frozen install, CLI build/help and web build passed; unconfigured doctor exit 3; version 0.2.1 and clean Git status |
| Real YouTube CLI / independent agent JSON and MD | Passed; actual ASR errors preserved |
| Real production HTTP/SSE transcription | Page 200, terminal done, no failed event |
| Chromium browser regressions | 10 passed: 9 use synthetic API/fault fixtures and 1 exercises real invalid-URL validation; no transcription tools required |
| Real Chromium backend transcription | 1 passed with actual YouTube/FFmpeg/whisper.cpp; progress, views, TXT/Markdown contents and refreshed history verified |
| Skill validator | Passed |
| Agensi ZIP validation | Two allowlisted UTF-8 files; CRC, frontmatter, content, size and SHA-256 checks passed; deterministic regeneration |
| Production registry audit | 0 critical, 1 high, 0 moderate/low; see technical audit |
| All-dependency registry audit | Now 3 critical, 2 high, 11 moderate, 1 low after compatible js-yaml/brace-expansion/PostCSS updates; no clean-audit claim |
| Browser / screenshot | Real Windows Chromium 158.0.8127.18, 1280×900 and 390×844 captures inspected; additional 320px mobile fit check passed |
| `git diff --check` | Full branch diff and staged report checks passed |
| Merged baseline CI | [CI run 43517518635](https://github.com/serhataydilek/videototext/actions/runs/43517518635): all three OS jobs passed on PR #2 merge `032f25ebbf250b8903247f8bcbeab78a2c5fd8fe` |
| Final branch CI | [CI run 43520419879](https://github.com/serhataydilek/videototext/actions/runs/43520419879): Ubuntu, Windows and macOS all passed frozen install, 53 unit tests, TypeScript, CLI/web builds and 10 Chromium regressions for `f02c7e8c66d56067e8edc92be48c22836503ca90` |

[PR #2](https://github.com/serhataydilek/videototext/pull/2) is confirmed merged. The final branch is based on its latest merge commit, with no unrelated dirty files at the start. No main branch modification, force push or automatic merge is part of final preparation.

Final review is [draft PR #3](https://github.com/serhataydilek/videototext/pull/3), `release/v0.2.1-final` → `main`. Source/validation commit: `fda2b7fccee1baed5cbc89d8f3d89a9c18c7b3e4`; release-notes/screenshots commit: `f02c7e8c66d56067e8edc92be48c22836503ca90`. The subsequent evidence-only commit changes this checklist, with no application/test/package changes.

## Review and publication gates

- [x] Branch starts from current merged main; existing dirty work was absent.
- [x] Confirmed high-priority runtime findings addressed without replacing CLI/web architecture.
- [x] Six requested reports and an allowlisted package generator prepared.
- [x] Generated ZIP and execution artifacts ignored by Git; no `.env.local`, tool/model or personal paths intended in public artifacts.
- [ ] Review the final scoped diff and explicitly approve merge; no automatic merge.
- [x] Review remaining advisory applicability; apply compatible transitive patches and document unresolved development-tool findings.
- [x] Complete real Chromium browser acceptance, including exports, unavailable/quota-blocked storage and mobile/keyboard behavior.
- [x] Prepare the authorized 0.2.1 manifest update while keeping the package private.
- [ ] Approve merge, then separately approve creation of the v0.2.1 tag and GitHub Release.
- [ ] Obtain clarification on Agensi's delivery/export policy versus the MIT skill license; approve its free listing, permissions and submission independently.
- [ ] Test actual Agensi MCP delivery before claiming an Agensi integration works.
- [ ] npm publication remains out of scope and prohibited without separate approval; the manifest stays private.

**GitHub verdict:** browser acceptance is complete for the tested environment and three-platform branch CI passed; ready for final draft review. Owner approval is still required before merge/tag/release. **Agensi verdict:** structurally validated, still on hold for licensing/delivery clarification and platform testing. Do not contact Agensi or Joeri as part of this work.

## Exact steps after separate approval (not executed)

First review and approve the final draft PR and merge it through the normal GitHub review flow. Confirm all three OS jobs passed on the resulting merge commit. Then use a clean checkout or preserve local work before switching revisions:

```sh
git fetch origin
git switch --detach origin/main
node -p "require('./package.json').version"
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm run build:cli
corepack pnpm build
corepack pnpm exec playwright install chromium
corepack pnpm run test:browser
git status --short
git rev-parse HEAD
```

The version must be 0.2.1, the tree clean, and HEAD must equal the specifically approved merge SHA. With **separate tag/release approval**, replace the placeholder below with that full SHA:

```sh
git tag -a v0.2.1 APPROVED_MERGE_SHA -m "VideoToText v0.2.1"
git push origin refs/tags/v0.2.1
gh release create v0.2.1 --repo serhataydilek/videototext --verify-tag --title "VideoToText v0.2.1 — Safer local transcription and browser reliability" --notes-file docs/release-readiness/RELEASE_NOTES_v0.2.1.md
```

Tag the exact approved SHA. No npm or Agensi publishing command is included. The Agensi ZIP is not a GitHub application binary and should not be described as one.
