# Agensi research

Access date for all sources: **2026-11-14 (Europe/Istanbul)**. These are observed documentation rules, not approval from Agensi. No account, listing, upload or submission was created.

## Delivery and first use

**Documented:** Agensi delivers instructions through MCP, not an installed application. Executables are rejected. It does not host MCP servers. A connected agent loads a skill and fetches supporting text when needed. Shipped scripts can execute in the user's session as temporary, unchanged files; this is not an application installer. [What you can sell](https://www.agensi.io/docs/what-you-can-sell), [How agents load skills](https://www.agensi.io/docs/how-agents-load-skills).

**Consequence for VideoToText:** a new user needs a local shell-capable agent, a source checkout, Node/Corepack/pnpm, yt-dlp, FFmpeg/ffprobe, whisper-cli and a separately downloaded GGML model. Loading our instructions alone cannot produce a transcript. A remote agent must have tools installed in its own execution environment; it cannot automatically use binaries on the user's laptop.

**Recommendation implemented:** the skill checks CLI availability, runs doctor, explains missing dependencies and links the reviewed source setup. It uses the direct Node entry point if global linking is unavailable. Setup requires user authorization; no automatic binary download, remote shell installer, restriction bypass, or paid fallback was added. Instructions-only delivery is useful after installation, but creates substantial first-use friction. Present this as a free companion to the CLI, not instant hosted transcription.

## Package requirements (documented)

[Packaging](https://www.agensi.io/docs/packaging): ZIP with `SKILL.md` at any depth; one skill file produces one skill, multiple produce a pack. Frontmatter needs a top-level `name`; supply `description` for discovery. The form can also read `summary`, `version`, `tags`, `keywords`, `use_cases`, and `docs_url`. This package retains only portable `name` and `description`; enter listing fields separately.

Website limits: 50 MB, 1,000 files, 50 skills per pack. Agent upload: 100 files, 5 MB, text only. Delivery includes all skill manifests and up to 200 supporting text files within 6 million characters. Bundled dependency directories are prohibited; executable/model formats including `.exe`, `.dll`, `.bin`, and `.wasm` fail file checks. Binary images/PDFs may be uploaded but are not served as readable skill content.

Prepared layout:

```text
videototext-agensi.zip
├── SKILL.md
└── LICENSE.txt
```

The archive is generated with `python scripts/package-agensi.py`; only these two allowlisted UTF-8 files are included. No tool, model, transcript, environment file, repository history or dependency is bundled. This is local structural validation, not Agensi's security scan.

## Free listing and metadata (documented)

[Creator quickstart](https://www.agensi.io/docs/creator-quickstart): account, Creator Mode, profile, ZIP submission, then review. Listing is non-exclusive. [Pricing](https://www.agensi.io/docs/pricing-your-skill): free usage requires a connected agent but no payout method. Set **Free ($0)** permanently for this project; no paid API or upsell is part of the workflow. An agent provider can have its own billing, independent of VideoToText.

[Website submission](https://www.agensi.io/docs/submit-on-the-website): unique title up to 60 characters, summary up to 300, Markdown description, real request/result example, compatibility note, up to three categories, tags/use cases, and detected permission review. Logo is optional (512×512 recommended); screenshots/video are optional. No outside paid checkout or upsell links. The draft listing is in [AGENSI_LISTING.md](AGENSI_LISTING.md).

## Discovery (documented)

The website and agent search use the same catalogue. Website filters include Free; categories, keyword search, and account-limited AI search help discovery. Agent search considers relevance but boosts paid entries when sufficiently relevant; website AI search also favors paid entries inside relevance groups. Free pricing does not guarantee prominent placement. [Find skills](https://www.agensi.io/docs/find-skills).

**Recommendation:** use explicit terms such as YouTube transcription, local Whisper, timestamped JSON and Markdown notes. Do not claim ranking, adoption, speed or accuracy advantages.

## Permissions and security (documented versus proposed)

[Review and approval](https://www.agensi.io/docs/review-and-approval): uploads undergo checks for structure, file types, dangerous commands, secrets, environment harvesting, networking combined with local reads, obfuscation, and prompt injection. Scan results feed AI and human review; warnings or apparent failures can require human interpretation. New listings require a person. We have not run these platform checks and cannot promise acceptance.

**Proposed disclosures:** terminal/process execution; network to YouTube/media hosts (setup also accesses GitHub, npm and model hosts); read tool/model/config files; temporary audio writes/deletes; export writes to user-selected paths; configured environment variables. No credentials, privileged service, or additional MCP server needed. The documentation does not establish a universal permission-frontmatter allowlist or guarantee that a shell-capable client will permit execution. Verify the form's detected permissions before submission. Do not hide warnings or encode instructions to evade scanning.

## Versions and license

[Updates](https://www.agensi.io/docs/updates): replacement ZIPs need a higher numeric/dotted version and repeat review; the existing version stays live until approval. Agents load the newest approved version. Text/price edits may go live directly. A platform skill update does not update the separately installed CLI or tools. Recommend keeping the listing version aligned with the approved CLI release and reminding users to rebuild their checkout.

**Submission blocker:** the [loading documentation](https://www.agensi.io/docs/how-agents-load-skills) says every load carries a directive prohibiting saving/exporting the skill. [Terms §§8–9](https://www.agensi.io/terms) retain creator ownership, grant platform delivery rights, and impose usage/export restrictions; the buyer-license wording specifically discusses card/credit acquisition. Neither source clearly documents how a free, separately MIT-licensed package overrides the generic delivery directive. This creates an unresolved policy mismatch, not a conclusion that the MIT license is invalid.

Keep the repository and packaged instructions MIT. Before submission, obtain platform clarification that a free MIT listing can retain redistribution rights and can point users to its independently hosted source. Do not ask agents to extract or save Agensi-delivered instructions. Users can install the separately MIT-licensed GitHub copy directly. No platform terms were accepted here and no contact was sent.

## Verdict

**Package structurally prepared; submission on hold.** Its delivery model can support a companion skill, with explicit separate setup. Owner approval, platform licensing clarification, listing permission review and an actual MCP delivery test remain prerequisites. Agensi cannot be advertised as hosting Whisper or providing a one-click install.
