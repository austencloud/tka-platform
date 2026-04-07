# TKA Composer - Claude Code Guidelines

## Development Philosophy: Build for Generations

**Only the AAA+ approach. No quick fixes, no simplified implementations, no "good enough for now."**

1. **No quick fixes. Ever.** Never offer temporary solutions or tiers of quality. There is only one tier: flawless.
2. **Research the 2026 state of the art.** Before implementing anything non-trivial, web search for what the community has learned.
3. **Zero technical debt.** No "we'll fix it later" comments. No shortcuts.
4. **Proper architecture always.** DI, composition, single responsibility. If unsure, research first.
5. **Build the full product.** Never suggest MVP approaches or simplified versions.

Never say: "simplified implementation", "for now", "quick fix", "to save tokens", "might be overkill", "simpler approach", "revisit later". Spend whatever tokens are necessary to do it right.

---

## CRITICAL: Sequence Generation = Humor Training

**When generating sequences with creative freedom (no specific tagline given), this is a humor training opportunity.**

1. **Ask for tagline FIRST** - present 4 options across preferred lenses
2. **Generate sequence AFTER** - with the chosen tagline
3. **Save the training pair** - `node scripts/add-humor-pair.cjs`

**Humor profile:** `mcp-server/src/core/humor-profile.json`
**Full workflow:** `.claude/rules/sequence-generation.md`

Austen's preferred lenses: DEADPAN (primary), ABSURDIST, SARDONIC, DICTIONARY, DOMAIN, ACRONYM
Avoid: SELF_DEPRECATING

---

## CRITICAL: MCP-Only for TKA Rendering

**NEVER render pictographs/sequences via bash scripts, inline code, or base64.** Only use MCP tools:
- `generate_pictograph` - single pictograph (~50 tokens)
- `generate_sequence` - choreo card (~50 tokens)

If MCP tools are unavailable, STOP and tell user to restart Claude Code. Do NOT fall back to bash/node/base64.

---

## CRITICAL: Never Claim "Fixed" Without Verification

Full protocol in `.claude/rules/verification-protocol.md`. The short version:

Every "done" or "fixed" claim MUST include proof (test output, runtime query, console output, or screenshot). If you can't show proof, say: "I've made the changes but need you to verify. Please [specific action] and tell me what you see."

"Build succeeded", "I updated the config", "I changed the component" do NOT count as verification.

---

## Writing Style: Avoid AI-isms

**The fire jam test:** Would Austen say this out loud at a fire jam? If it sounds like a press release, rewrite it.

**Scope:** Real-world copy only (marketing, UI, docs). Museum game fiction follows its own tone rules.

### Core Rules

1. **State what it does.** Not what it "empowers you to do."
2. **Be specific.** "See the pictograph while you spin" not "seamlessly integrate notation."
3. **Cut redundancy.** Don't say the same thing twice with different words.
4. **Check features exist.** Don't describe capabilities the software doesn't have.
5. **No first person** on pages without a signature.
6. **Vary sentence length.** Short punches. Then longer when needed. Fragments work.
7. **Default to plain.** "Videos" not "Visual Showcase."

**Avoid:** em dashes, superlatives (revolutionary, seamless), vague benefits (unlock potential), "Whether you're...", robotic transitions (Furthermore, Moreover), hedging (It's worth noting), enthusiastic affirmations (Absolutely!).

**Full reference with examples and blacklisted words:** `docs/reference/ai-writing-guide.md`

---

## Rules

`.claude/rules/` contains always-loaded rules (keep these small):
- `code-style.md` - Imports, DI, Svelte 5, TypeScript
- `service-naming.md` - Never use "Service" suffix
- `styling.md` - Core CSS rules (full reference in `docs/reference/styling-guide.md`)
- `testing.md` - Earned tests philosophy
- `workflows.md` - Skill commands, Playwright rules, context management
- `project-patterns.md` - Module checklist
- `sequence-generation.md` - Core generation rules (full reference in `docs/reference/sequence-generation-guide.md`)
- `verification-protocol.md` - Verification requirements
- `tka-domain.md` - Domain terminology and MCP tool rules

---

## Quick Reference

- **Stack:** Svelte 5 + TypeScript + Inversify DI + Firebase
- **User:** Austen Cloud (austencloud@gmail.com)
- **Context:** Suggest `/compact` at 70% capacity

---

## Architecture

See `docs/architecture/` for detailed architecture docs (loaded on demand, not every session):
- `save-paths.md` — Two separate save paths, public index sync, browse gallery cache, module boundaries

---

## Memory Discipline: Token Budget Is Real

Every file in `memory/` and `.claude/rules/` is loaded into EVERY conversation. At ~35k tokens of preamble, this is expensive. Claude must treat memory like production code: every line must earn its place.

### Before Writing to Memory, Ask:

1. **"Does Claude need this in EVERY conversation?"** If no, it belongs in `docs/` (read on demand).
2. **"Is this a recurring gotcha or a one-time status update?"** Status updates don't belong in memory. Gotchas that will bite future sessions do.
3. **"Does this duplicate something already in rules or CLAUDE.md?"** If yes, don't write it.
4. **"Is this reference material or working instructions?"** Reference material (theory, research, API docs) goes in `docs/reference/`, not memory.

### What BELONGS in Memory

- Recurring technical gotchas (patterns that cause bugs across sessions)
- Active domain tables Claude needs to reference frequently
- One-liner status of in-progress projects (not phase-by-phase logs)

### What DOES NOT Belong in Memory

- Research dumps, theory documents, source lists
- Detailed phase completion logs (condense to one line)
- Anything available via MCP tools (TKA domain knowledge)
- Anything that duplicates rules files
- Information that's only relevant during the current session

### Size Guardrails

- MEMORY.md: keep under 80 lines. If approaching 100, trim completed project statuses.
- Supplementary memory files: only create if the topic is a recurring gotcha that needs detail. Ask user first.
- If you want to save something large (>20 lines), put it in `docs/` instead and note the path in MEMORY.md.

---

## Shared Skills System

TKA uses 7 shared skills from `@austencloud/claude-skills`: **commit**, **changelog**, **check**, **ai-bust**, **monolith**, **deadcode**, **audit**.

- **Config:** `.claude/skills.config.json` declares which skills this project uses and project-specific template variables.
- **Sync:** `npx @austencloud/claude-skills sync` renders templates into `.claude/skills/` and `.claude/agents/`.
- **Do not edit synced files directly.** They have a managed-by comment at the top. Edits go to the template in `F:/_CODE/shared-packages/packages/claude-skills/templates/` and then re-sync.
- **Audit tooling:** `ac-audit` and `ac-evidence` CLI commands come from `@austencloud/code-quality`, replacing the old `scripts/audit-tracker.cjs` and `scripts/collect-evidence.cjs`.
- **Project-specific skills** (museum, lab, concepts, fb, release, etc.) are NOT managed by the shared package. Those live in `.claude/skills/` and `.claude/commands/` and are edited directly.

---

## Dev Server Ports - CRITICAL

**Port 5173 belongs to the user. NEVER touch it.**

The user runs their dev server via VS Code on port 5173. The `npm run dev` script includes `kill-port 5173` which will destroy their session.

### Rules:
1. **NEVER run `npm run dev`** - it kills port 5173
2. **NEVER run `kill-port 5173`** - same reason
3. **Port 5174 is Claude's port** - if you need a dev server: `vite --port 5174`
4. **Assume 5173 is running** - you can `curl localhost:5173/...` to test
5. **Recommend, don't execute** - if a restart is needed, tell the user

### For verification, use:
- `npm run build` - check compilation
- `npm run check` - TypeScript errors
- `curl localhost:5173/path` - test the user's running server

---

## Never Run Unbounded System Searches

- Never run `find` without an explicit, narrow path (Git Bash interprets it as Unix find)
- Never run system process queries through Git Bash (use PowerShell or cmd.exe)
- When checking if something is running, ask the user
- If uncertain about a command's scope, don't run it
