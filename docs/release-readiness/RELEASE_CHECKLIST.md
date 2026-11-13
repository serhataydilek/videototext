# Release preparation

Prepared **2026-11-14 (Europe/Istanbul)**. Nothing in this checklist authorizes publication, a tag, merge, npm upload, or Agensi submission.

## Proposed version and title

**0.2.1 — Safer local transcription and clearer agent setup**

These changes correct reliability/security behavior and documentation around existing CLI/web/skill capabilities. They do not add a new input type, hosted service, output format or major workflow. A patch release is more appropriate than 0.3.0. `package.json` deliberately remains **0.2.0** until release approval; no tag or release has been created. The prepared ZIP is unversioned to avoid implying an approved release.

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
- Browser visual/IndexedDB acceptance, automatic client skill discovery, Agensi MCP delivery and real Linux/macOS inference are unverified.

## Validation record

| Check | Result |
| --- | --- |
| Baseline tests | 32/32 passed |
| Final local tests | 53/53 passed in 7 files |
| `corepack pnpm exec tsc --noEmit` | Passed |
| `corepack pnpm run build:cli` | Passed |
| `corepack pnpm build` | Passed, Next 15.5.29 |
| Fresh source install/build/help | Passed; unconfigured doctor exit 3, configured doctor exit 0 |
| Real YouTube CLI / independent agent JSON and MD | Passed; actual ASR errors preserved |
| Real production HTTP/SSE transcription | Page 200, terminal done, no failed event |
| Skill validator | Passed |
| Agensi ZIP validation | Two allowlisted UTF-8 files; CRC, frontmatter, content, size and SHA-256 checks passed; deterministic regeneration |
| Production registry audit | 0 critical, 1 high, 0 moderate/low; see technical audit |
| All-dependency registry audit | 3 critical, 16 high, 15 moderate, 1 low; no clean-audit claim |
| Browser / screenshot | Blocked by browser automation environment; no captures fabricated |
| `git diff --check` | Passed during preparation; final staged check required before commit |
| GitHub Actions | To be recorded after the explicitly requested branch push and draft PR |

## Review and publication gates

- [x] Branch starts from current merged main; existing dirty work was absent.
- [x] Confirmed high-priority runtime findings addressed without replacing CLI/web architecture.
- [x] Six requested reports and an allowlisted package generator prepared.
- [x] Generated ZIP and execution artifacts ignored by Git; no `.env.local`, tool/model or personal paths intended in public artifacts.
- [ ] Review the final scoped diff and explicitly approve merge; no automatic merge.
- [ ] Decide whether remaining development-tool advisories are acceptable for the release or require a separate tooling update.
- [ ] Complete browser acceptance on a usable local browser, including export and unavailable-storage behavior.
- [ ] Approve 0.2.1, then update the manifest as a release step and approve creation of a tag and GitHub Release.
- [ ] Obtain clarification on Agensi's delivery/export policy versus the MIT skill license; approve its free listing, permissions and submission independently.
- [ ] Test actual Agensi MCP delivery before claiming an Agensi integration works.
- [ ] npm publication remains out of scope and prohibited without separate approval; the manifest stays private.

**GitHub verdict:** suitable for draft code review; publication remains conditional on owner approval and the open gates above. **Agensi verdict:** structurally prepared but on hold for licensing/delivery clarification, owner review and platform testing. No request for approval is needed to finish the already authorized branch, commits and draft PR.
