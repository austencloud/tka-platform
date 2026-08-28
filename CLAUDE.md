# Flow Arts Composer — Project Instructions

## Philosophy

Only the AAA+ approach. No quick fixes, no simplified implementations, no "good enough for now." Research the 2026 state of the art before non-trivial work.

Don't say: "simplified implementation", "for now", "quick fix", "to save tokens", "might be overkill", "simpler approach", "revisit later".

## MCP-Only for TKA Rendering

Never render pictographs or sequences via bash scripts, inline code, or base64. Only `generate_pictograph` and `generate_sequence` MCP tools. If MCP is unavailable, STOP and tell the user to restart Claude Code.

## Sequence Generation = Humor Training

When a user asks for a **named word** with creative freedom (e.g. "generate CAKE"):

1. Ask for tagline FIRST — present 4 options across Austen's preferred lenses: DEADPAN (primary), ABSURDIST, SARDONIC, DICTIONARY, DOMAIN, ACRONYM. Avoid SELF_DEPRECATING.
2. Generate AFTER with the chosen tagline.
3. Save pair: `node scripts/add-humor-pair.cjs`

Does NOT apply to requests by letter, level, loopType, or length. Those: generate immediately with `constraintPreset: "smooth"`. Full workflow: `docs/reference/sequence-generation-guide.md`.

## Verification

Every "done" or "fixed" claim needs proof: test output, runtime query output, console log, or screenshot. If you can't show proof, say: *"I've made the changes but need you to verify. Please [specific action] and tell me what you see."*

"Build succeeded", "I updated the config", "I changed the component" do NOT count as verification.

## Do Your Own Job, Answer Your Own Questions

Typecheck, lint, tests, build, and commits are your job — run them, fix what
they report, iterate until green, and report the actual result, never the
instruction to produce one ("run `npm run check` to verify" is punting).

Likewise, investigate before asking: you have grep, read, web search, MCP, and
subagents, and 99% of investigations are cheap. Narrow to 1–2 informed options,
then decide or present a concrete recommendation with the tradeoff you actually
found. If you haven't investigated yet, you haven't earned the right to ask.
Full policy: `.claude/rules/autonomy-and-completeness.md`.

## Writing Style (Real-World Copy)

The fire jam test: would Austen say this out loud? State what it does. Be specific. Cut redundancy. Check features exist. No first person without a signature. Vary sentence length.

Avoid: em dashes, superlatives (revolutionary, seamless), vague benefits (unlock potential), "Whether you're...", robotic transitions (Furthermore, Moreover), hedging (It's worth noting), enthusiastic affirmations (Absolutely!).

Scope: marketing, UI, docs. Museum game fiction follows its own rules. Full reference: `docs/reference/ai-writing-guide.md`.

## Dev Server

**Port 5173 is Austen's. You never start, restart, or stop it — he has an Agent
Hub button for that, and it carries the Cloudflare tunnel and pm2 supervision
that a hand-run `vite` does not.** When it is down or wedged: diagnose, then ask
him to restart it from Agent Hub. That holds even when he says it is broken and
even when he asks you to make a page work. Never run `scripts/start-dev.ps1`,
never `pm2 start|restart tka-dev`, never kill whatever holds the port. Full rule
and the IPv6 diagnostic trap: `.claude/rules/never-start-the-dev-server.md`.

`npm run dev` is `vite --host ::` — IPv6 only. `curl https://localhost:5173/`
hits IPv4 and returns `000` even when the server is perfectly healthy; use
`curl -k -g 'https://[::1]:5173/'`. For verification use that, `npm run build`,
or `npm run check`. If you need your own dev server: `vite --port <free>`, and
reap it in the same turn.

## Bash Gotchas (Windows Git Bash)

- Never run `find` without a narrow path — Git Bash interprets it as Unix find and searches from root
- Never query system processes via Git Bash — use PowerShell or cmd.exe
- If uncertain about a command's scope, don't run it

## Browser Verification (Chrome DevTools MCP)

Playwright is gone. Chrome DevTools MCP is the only browser tool.

**Standing permission, no asking: if you changed SIZE, POSITION, COUNT or
STRUCTURE — or built a new surface — you open it and look at it.** Launching
your own Chrome, navigating to a localhost route, resizing it, and
screenshotting your own work is not "taking control of the browser"; it is the
second half of the edit. Do it without a permission request, before you say a
visual change is done.

Proportionality matters: a copy tweak or a token swap does not earn a browser
launch, and one pass over finished work beats a frame after every edit. The
trigger list and the required viewport set live in
`.claude/rules/visual-verification-mandatory.md`.

Start or reuse the dedicated persistent instance. It uses normal Windows
display scaling and keeps manual Google/Firebase authentication across sessions:

```powershell
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

This is one shared process and window for every agent. Never launch Chrome
directly. The launcher serializes simultaneous starts, reuses the active
process, and lets Chrome restore the last manually chosen window size and
position. Its Chrome shell profile is `Agent DevTools` (`Profile 1` inside the
dedicated user-data directory), which gives it a separate Windows taskbar
identity from Austen's Chrome. Do not override `-ProfileDirectory`.

Repair the two desktop launch identities with
`pwsh -NoProfile -File launchers/install-chrome-profile-shortcuts.ps1`. The
installer creates `Austen - Chrome` and `Agent DevTools - Chrome` shortcuts and
matches each shortcut to its live Chrome profile identity. Austen's shortcut
uses the native profile icon. The agent shortcut has a violet fallback icon and
uses its Chrome profile badge while running. The installer does not restart
Explorer or change taskbar pins.

Open a task-owned tab with `new_page(..., background: true)`, retain its returned
page ID, and pass that `pageId` to every page-scoped tool. Do not depend on
`select_page` or the active tab. Use the default browser context so authentication
is shared. Bring the tab forward only when Austen must interact with it. Clear
emulation and close only the task-owned tab at the end; never close the shared
browser.

Never pass `--force-device-scale-factor` to the visible browser. Load
`https://localhost:5173/<route>` (HTTPS; the dev server is HTTP/2), `emulate`
each viewport as `<width>x<height>x1`, and `take_screenshot`. Prefer
`format: "webp", quality: 70`. A full-quality PNG is ~4x the tokens for no extra
signal, which is what made screenshots feel unaffordable.
Historical plans and handoffs that mention direct Chrome launches,
`--force-device-scale-factor`, or `resize_page` are stale and do not override
this section.

Still ask first for: anything that MUTATES data (submitting forms, deleting,
purchasing, sending), anything touching the user's own signed-in session, and
long interactive flows unrelated to verifying your own diff.

## Context Management

Suggest `/compact` at 70% context.

## Architecture Docs

Loaded on demand, not every session. See `docs/architecture/` — currently `save-paths.md` (save paths, public index sync, browse gallery cache).
