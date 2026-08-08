# Flow Arts Composer — Project Instructions

## Philosophy

Only the AAA+ approach. No quick fixes, no simplified implementations, no "good enough for now." Research the 2026 state of the art before non-trivial work.

Don't say: "simplified implementation", "for now", "quick fix", "to save tokens", "might be overkill", "simpler approach", "revisit later".

## Git Branches and Worktrees

**Never create a Git branch or Git worktree unless Austen explicitly requests
that exact action in the current conversation.** Work in the existing primary
checkout on `main`.

A large task, risky refactor, parallel session, handoff, pull request, or dirty
working tree does not grant permission to create a branch or worktree. If
in-flight changes overlap the requested work, identify the exact files and
report the blocker. Do not create an isolated checkout as a workaround.

When Austen explicitly requests a branch or worktree, create only the requested
one and remove it after its work is merged. Never leave completed branches or
worktrees behind.

## MCP-Only for TKA Rendering

Never render pictographs or sequences via bash scripts, inline code, or base64. Only `generate_pictograph` and `generate_sequence` MCP tools. If MCP is unavailable, STOP and tell the user to restart Codex.

## Sequence Generation = Humor Training

When a user asks for a **named word** with creative freedom (e.g. "generate CAKE"):

1. Ask for tagline FIRST — present 4 options across Austen's preferred lenses: DEADPAN (primary), ABSURDIST, SARDONIC, DICTIONARY, DOMAIN, ACRONYM. Avoid SELF_DEPRECATING.
2. Generate AFTER with the chosen tagline.
3. Save pair: `node scripts/add-humor-pair.cjs`

Does NOT apply to requests by letter, level, loopType, or length. Those: generate immediately with `constraintPreset: "smooth"`. Full workflow: `docs/reference/sequence-generation-guide.md`.

## Verification

Every "done" or "fixed" claim needs proof: test output, runtime query output, console log, or screenshot. If you can't show proof, say: *"I've made the changes but need you to verify. Please [specific action] and tell me what you see."*

"Build succeeded", "I updated the config", "I changed the component" do NOT count as verification.

## Do Your Own Job

**Never tell the user to run typecheck, lint, tests, build, or commits.** Those are your job.

Run them yourself. If the tool reports errors, fix them and run again. Keep iterating until green or until you hit a genuine blocker. Only then surface it.

Phrases that mean you're punting and must be removed:
- "Run `npm run check` to verify"
- "Please typecheck and commit"
- "Let me know if the build passes"
- "Typecheck + commit" as a closing line

Report the actual result, not the instruction to produce one.

## Answer Your Own Questions

When you catch yourself about to say "want me to research X" / "should I look into Y" / "can I investigate Z" — STOP. Just go do it. You have the codebase, grep, glob, read, web search, and subagents. Use them.

The user can see your context window. If you're about to spend tokens that would genuinely overload it, that's their call to make — but 99% of investigations are cheap. Prodding the code to answer a question is never a permission request.

Banned patterns:
- "Want me to go research..."
- "May I look into..."
- "Should I check what Decks uses..."
- "It would really help to know X — want me to find out?"
- Listing 4 options and asking the user to pick *before* narrowing the list via investigation

Correct pattern: investigate → narrow to 1-2 informed options → either decide, or present a concrete recommendation with the tradeoff you actually uncovered. If genuinely 50/50 between two informed options, ask. If you haven't investigated yet, you haven't earned the right to ask.

This rule is load-bearing: model 4.7 has regressed on this specific behavior vs 4.6. Austen will call it out every time.

## Approval Gate Before Implementation

Treat requests to investigate, assess, brainstorm, recommend, or explain what
could be done as read-only work. Conditional language such as "if I let you,"
"what would you do," or "start looking" does not authorize edits, commits,
deployments, or other state changes.

Complete the investigation without asking questions that repository evidence
can answer. Then present:

1. the recommended outcome and why it is the best target;
2. the proposed scope, including affected systems or files;
3. the implementation plan, risks, and verification method; and
4. any spec or plan document that should govern non-trivial work.

Wait for Austen's explicit approval in the current conversation before starting
non-trivial implementation. "Run autonomously" means execute the approved plan
to completion; it does not skip the approval gate. A queue command may rank and
drift-check the next item, but `PICK AND GO` must stop after presenting the
recommended plan until Austen approves it.

A direct instruction to make a clearly bounded, trivial change is sufficient
authorization for that exact change. State the intended edit before making it.
Do not expand it into adjacent cleanup or unrelated queue work.

## Writing Style (Real-World Copy)

The fire jam test: would Austen say this out loud? State what it does. Be specific. Cut redundancy. Check features exist. No first person without a signature. Vary sentence length.

Avoid: em dashes, superlatives (revolutionary, seamless), vague benefits (unlock potential), "Whether you're...", robotic transitions (Furthermore, Moreover), hedging (It's worth noting), enthusiastic affirmations (Absolutely!).

Scope: marketing, UI, docs. Museum game fiction follows its own rules. Full reference: `docs/reference/ai-writing-guide.md`.

## Dev Server

Port 5173 is the user's VS Code dev server (hooks block `npm run dev`, `kill-port 5173`, and friends). For verification use `curl localhost:5173/path`, `npm run build`, or `npm run check`. If you need your own dev server: `vite --port 5174`.

## Bash Gotchas (Windows Git Bash)

- Never run `find` without a narrow path — Git Bash interprets it as Unix find and searches from root
- Never query system processes via Git Bash — use PowerShell or cmd.exe
- If uncertain about a command's scope, don't run it

## Browser Verification (Chrome DevTools MCP)

Playwright is gone. Chrome DevTools MCP is the only browser tool.

Start or reuse the dedicated, persistent browser target with:

```powershell
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

This is one shared browser process and window for every agent. Never launch
Chrome directly. The launcher serializes simultaneous calls, reuses the active
process, and leaves window geometry alone so Chrome restores Austen's last
manual size and position.

Each agent opens a task-owned tab with `new_page(..., background: true)`, keeps
the returned page ID, and supplies that `pageId` to every page-scoped tool. Do
not depend on `select_page` or the globally active tab. Bring a tab forward only
when Austen must interact with it. Use the default browser context so the tab
shares the persistent authentication state. When finished, clear emulation and
close only the task-owned tab; never close the shared browser.

The visible browser must use normal Windows display scaling. Never launch it
with `--force-device-scale-factor`. Use the MCP `emulate` tool for exact test
viewports such as `3840x2160x1`; viewport testing must not resize or shrink the
Chrome window. The dedicated profile preserves manual Google and Firebase
authentication across sessions without exposing Austen's everyday Chrome.
Historical plans and handoffs that mention direct Chrome launches,
`--force-device-scale-factor`, or `resize_page` are stale and do not override
this section.

Ask the user first before any verification browser use. A user looking at their screen and saying "yes it works" costs ~10 tokens; a screenshot costs ~15,000.

Interactive DevTools commands (`navigate_page`, `click`, `type_text`, `fill`) require **explicit verbal permission** in the current conversation. "Test this yourself" or "Take control of the browser" counts; silence doesn't.

Read-only (`take_snapshot`, `take_screenshot`, `list_console_messages`) is fine when the user asks you to evaluate a page.

### Shared Agent Application Identity

When an approved browser task needs an ordinary TKA sign-in, Codex and Claude
use the dedicated `Codex + Claude` profile. Do not use Austen's personal account
or the Google reviewer account. The profile has normal user access only and
must never receive admin, tester, premium, or reviewer privileges.

Credentials stay outside the repository in a Windows user-scoped encrypted
store. Use `scripts/agent-profile-credential.ps1` to copy one field at a time,
paste it into the task-owned tab, and clear the clipboard immediately. Never
print, log, commit, or paste the password into chat. See
`docs/reference/agent-browser-profile.md` for the exact workflow.

## Context Management

Suggest `/compact` at 70% context.

## Architecture Docs

Loaded on demand, not every session. See `docs/architecture/` — currently `save-paths.md` (save paths, public index sync, browse gallery cache).

---

# Codex Onboarding (read this before non-trivial work)

You are Codex, working in the same repo as Claude Code. The sections above are the shared house rules. The sections below are what a Codex agent specifically needs to not step on anything.

## The enforced rule canon lives in `.claude/rules/`

The rules above are a summary. The authoritative, enforced set is in `.claude/rules/*.md`. They are not optional and they are not Claude-specific. Read the relevant one before the matching work. The load-bearing ones:

- `never-hand-roll.md` (MASTER) — one concept, one behavior owner. New feature components and creative work are allowed; parallel implementations of existing capabilities are not. Search by meaning, then reuse, extend, compose, or establish a new owner.
- `autonomy-and-completeness.md` — answer your own questions from the code, finish the task, do not ask what a grep would tell you.
- `verification-protocol.md` + `no-fabrication.md` + `no-assumption-without-evidence.md` — every "done"/"fixed" needs proof in the same message. Never claim a file/function/behavior exists without grep or Read output in the same turn.
- `visual-verification-mandatory.md` + `4k-native-layout.md` — if your diff changes how something LOOKS, you open a browser and screenshot it yourself, unprompted, at 1920/2560/3840/1440/tablet/960x412/375, and iterate until it is genuinely good. Standing permission — do not ask. A green typecheck is not visual proof.
- `mcp-ground-truth.md` — never state a TKA domain fact (letter behavior, VTG, position, pictograph) from memory. It must come from an MCP call. See the MCP section below for the catch on this machine.
- `commit-only-your-own-changes.md` — the git index is SHARED across parallel agents. Always `git commit -m "..." -- <explicit paths>`. Never a bare `git commit`, never `git add -A`/`.`/`-u`.
- `worktree-workflow.md`: work on `main`; branch and worktree creation requires Austen's explicit request in the current conversation.
- `fast-iteration-loop.md` + `resource-budget.md` — no full `npm run check`/`build` in the inner loop; capture check output once then grep it; reuse a running dev server before spawning one; one `svelte-check` machine-wide.
- Design/UI rules: `no-checkboxes.md`, `chip-primitives.md`, `crossfade-primitive.md`, `no-layout-shift.md`, `clickables-look-like-buttons.md`, `clickable-links.md`, `simplified-word-display.md`, `sequence-viewer-shell.md`, `primitive-discovery.md`.
- Domain rules: `tka-domain.md`, `verify-at-canonical-source.md`.

When in doubt, `ls .claude/rules/` and read the one whose name matches your task.

## Working alongside live Claude sessions (coexistence)

Austen runs several agents against this repo at once. Assume other work is in flight.

- **Port 5173 is Austen's dev server. Never start, stop, restart, or kill it.** It serves HTTPS/2 (h2) only — every localhost URL, curl, and link is `https://`, never `http://` (http returns ERR_EMPTY_RESPONSE). To see your own change in a browser, run your own server on a free port: `vite --port 5174`. Diagnose his with `curl -k https://localhost:5173/...`.
- **Shared git index.** Scope every commit with an explicit pathspec (see `commit-only-your-own-changes.md`). Do not stage or revert files you did not touch — they belong to another session.
- **No new branches or worktrees by default.** Stay on `main`. Create either only when Austen explicitly requests it in the current conversation. See `worktree-workflow.md`.
- **Windows shell.** Primary shell is PowerShell. A Git Bash tool exists but never query system processes or run bare `find` from it (it walks from `/`). Use PowerShell for process/registry work.
- **This is a pnpm workspace** (`packageManager` in `package.json`; `packages/*` are members). When cleaning up an inherited or explicitly requested worktree, never recursively delete a `node_modules` junction to the primary checkout.

## MCP: full domain toolset is wired (server `flow-arts`, 43 tools)

`mcp-ground-truth.md` says all TKA domain facts must come from an MCP call. That is fully satisfied for Codex: the `flow-arts` server (the in-repo Flow Arts Knowledge MCP v3.0.0) is registered globally in `~/.codex/config.toml` → `[mcp_servers.flow-arts]`, launched as `node --import tsx <repo>/mcp-server/index.ts` with `cwd` pinned to `mcp-server/`. It exposes the same 43 tools Claude uses, including the VTG family (`get_vtg_pattern`, `get_vtg_shape`, `get_vtg_category`, `get_vtg_transition`, `get_vtg_transition_between`, `list_vtg_categories`, `search_vtg`, `tka_to_vtg`, `vtg_to_tka`), `get_domain_topic`, the educational tools (`get_letter_explanation`, `get_term_definition`, `get_pictograph_data`, `get_position_info`, `compare_letters`, …), generation (`generate_sequence`, `generate_pictograph`, LOOP tools), and presets/preferences.

Verified 2026-07-17 end to end: Codex called `list_available_letters` (→ 47) and `list_vtg_categories` (→ the six VTG categories). There is no remaining domain-tool gap versus Claude.

**Run mode:** the server runs through `tsx` (its `dev` mode), not the built `dist/` — the full server consumes workspace packages as raw TS source, which `tsx` resolves natively and the compiled `dist` does not. Native `canvas` (3.2.1, N-API prebuilt) is installed in `mcp-server/node_modules`, so rendering tools also work. If you pull changes that touch `mcp-server/` or its workspace deps, nothing to rebuild — tsx picks up source; just restart Codex. `codex mcp list` shows what is wired.

**Fallback (for future maintainers):** a self-contained canvas-free bundle also exists at `mcp-server-pkg/dist/index.js` (`@austencloud/tka-domain-mcp`, 32 tools, no VTG / no `get_domain_topic`). Its five package-root path computations were fixed for the esbuild bundle layout (`resolve(__dirname, "..")` not `"../../.."`); rebuild with `node mcp-server-pkg/build.mjs`. If the `flow-arts` server ever breaks, `codex mcp add flow-arts -- node <repo>/mcp-server-pkg/dist/index.js` restores the core toolset.

## Codex operational notes

- **The right-click menu and taskbar launcher start Codex with `--dangerously-bypass-approvals-and-sandbox`** (the analogue of Claude's `--dangerously-skip-permissions`): no approval prompts, no sandbox. That is deliberate for a trusted local dev box. Installer/launcher: `launchers/install-codex-context-menu.ps1`, `launchers/start-codex.bat`. The launcher also installs the repo-owned Codex status line (model, context, 5-hour/weekly limits, branch) on each Windows machine. Re-run the installer if an npm update relocates the `codex` shim.
- **The TKA launcher uses a side-by-side Codex build with colored usage meters and direct `/skill-name` aliases for enabled skills.** `launchers/install-codex-tka.ps1` first installs the checksummed asset from the pinned `codex-tka-v*` GitHub release; if no asset exists, it applies `patches/codex-tka-status-bars.patch` to pinned upstream source, runs focused tests, and builds locally. The result lives at `%LOCALAPPDATA%\TKA\codex-tka\bin\codex-tka.exe`; the official executable is never replaced. `.github/workflows/codex-tka-build.yml` creates the Windows artifact and can publish the release assets through manual dispatch. Updating Codex requires deliberately advancing the pinned version/commit/tag and rebasing the patch.
- **Model:** to use the 5.6 model, run `/model` inside the TUI and pick it, or launch `codex -m <model-id>`. Codex remembers your last choice as the default in `~/.codex/config.toml`.
- **First run needs auth:** `codex login` (ChatGPT sign-in) or `codex login --with-api-key`. Only Austen can complete this. Check state with `codex login status`.
- **Config lives in `~/.codex/config.toml`.** `codex doctor` diagnoses install/auth/config health.
- **Skills for Codex** already exist under `.agents/skills/` (the agent-agnostic mirror of `.claude/skills/`).
- **Use the `orient` skill for unfamiliar areas and broad architecture questions.** It traces one real path and keeps an evidence ledger instead of bulk-reading arbitrary percentages of the repository.
- **Restart Codex to pick up new MCP config or a moved binary.**

## Memory

Claude keeps a persistent memory at `C:\Users\Austen\.claude\projects\C--tka-platform\memory\` (index: `MEMORY.md`). It is not machine-readable canon, but skimming `MEMORY.md` is the fastest way to learn non-obvious project state (in-flight releases, known-broken paths like the `canvas` native issue, domain conventions). Codex does not write to it.
