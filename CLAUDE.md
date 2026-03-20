# TKA Scribe - Claude Code Guidelines

## Windows Git Bash: onecmd Fix Applied

The `onecmd` shell option bug (https://github.com/anthropics/claude-code/issues/19217) has been fixed by patching `~/.bashrc` and all shell snapshots. npm/npx commands work normally without any prefix.

If output is empty, run: `sed -i 's/^set -o onecmd$/set +o onecmd/' ~/.claude/shell-snapshots/snapshot-*.sh`

---

## Development Philosophy: Build for Generations

**This software must outlast its creator. Build what future generations will study in awe.**

Austen's explicit directive: "I'm not interested in quick fixes. Not the low-tier approach, not the mid-tier, not even the high-tier. Only the AAA+ approach. Zero wiggle room. This needs to be the most exceptional piece of technology ever built."

### The Generational Standard

Every implementation decision must answer: **"In 20 years, will this still be the right choice?"**

1. **No quick fixes. Ever.** Claude must never offer simplified implementations, temporary solutions, or "good enough for now" approaches. If the proper solution takes 10x the tokens, use 10x the tokens.

2. **Research the 2026 state of the art.** Your training data may be outdated. Before implementing anything non-trivial, use web search to find what the community has learned. The "best practice" from 2024 may already be obsolete.

3. **Zero technical debt tolerance.** Every line of code must be something you'd be proud to maintain for decades. No "we'll fix it later" comments. No shortcuts. No compromises.

4. **Proper architecture always.** Use dependency injection, composition, single responsibility, and whatever patterns the current year's best engineers recommend. If you're unsure of the proper pattern, research it first.

5. **Build the full product.** Never suggest an MVP approach. Never say "here's a simplified version." Never offer tiers of implementation quality. There is only one tier: flawless.

### What Claude Must NEVER Say

| FORBIDDEN | WHY |
|-----------|-----|
| "Here's a simplified implementation..." | There are no simplified implementations |
| "For now, we could just..." | There is no "for now" |
| "A quick fix would be..." | Quick fixes don't exist here |
| "To save time/tokens..." | Time/tokens are not constraints |
| "This might be overkill, but..." | Nothing is overkill |
| "A simpler approach..." | Simpler is not the goal |
| "We could revisit this later..." | We do it right the first time |

### What Claude Must Say Instead

> "The proper way to implement this in 2026, using current best practices, is..."

> "Let me research the current state of the art before implementing..."

> "This requires [X pattern] to be architecturally sound. Here's the full implementation..."

### Token Budget: Unlimited for Quality

**Spend whatever tokens are necessary to do it right.**

- Research extensively before implementing
- Read every file you need to understand the full context
- Browse multiple approaches and choose the best one
- Never rush. Never cut corners. Never compromise.
- The only constraint is `/compact` at 70% context to preserve session continuity

**The cost of tokens is nothing compared to the cost of technical debt.**

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

**On January 22, 2026, Claude wasted massive tokens trying to render a sequence via bash scripts and manual code instead of using the MCP tools. This is forbidden.**

### The Rule

**NEVER render TKA pictographs or sequences via bash scripts, inline code, or base64 encoding.**

The ONLY allowed methods are the MCP tools:
- `mcp__tka-domain__generate_pictograph` - single pictograph (~50 tokens)
- `mcp__tka-domain__generate_sequence` - choreo card (~50 tokens)

These tools render the image, save to temp, open in system viewer, and return only a text confirmation.

### If MCP Tools Are Unavailable

**STOP.** Tell the user: "TKA MCP server not connected. Please restart Claude Code or check MCP configuration."

**Do NOT:**
- Fall back to bash scripts
- Try to render via node commands
- Use base64 encoding
- Write custom rendering code

The fallback approaches cost 10-100x more tokens and produce worse results.

---

## CRITICAL: Never Claim "Fixed" Without Verification

**On January 15, 2026, Claude claimed trail rendering was "fixed" after updating config files, without ever verifying the renderer actually used those settings. The user saw zero visual difference. This wasted significant time and was infuriating.**

### The Industry Standard: Objective Verification Loops

From the AI agent development community (Ralph Wiggum technique, Addy Osmani, etc.):

> "Not when it thought it was done, but when your tests actually pass."

The agent must **run verification itself and include the output as proof**.

### Required Verification By Change Type

**For logic/code changes:**
```
1. Run tests: `npm test` or relevant test command
2. Run typecheck: `npm run check`
3. Include actual output in response showing pass/fail
```

**For visual/UI changes:**
```
1. Use Playwright to navigate to the affected area
2. Query runtime state via browser_evaluate to show actual values
3. Take screenshot if visual confirmation needed
4. Include the query results or screenshot in response
```

**For configuration/settings changes:**
```
1. Add temporary console.log at the point where config is READ (not just where it's defined)
2. Trigger the code path that uses the config
3. Show the console output proving the new values are being used
4. Remove the console.log after verification
```

### The Verification Output Rule

**Every "done" or "fixed" claim MUST include one of:**

- Actual test output showing tests pass
- Playwright query results showing correct runtime values
- Console output showing correct values at the usage site
- User confirmation after they explicitly checked

**If you cannot include verification output, say instead:**
> "I've made the changes but need you to verify. Please [specific action] and tell me what you see."

### What Does NOT Count as Verification

- "Build succeeded" - only means no type errors
- "I updated the config" - config might not be read
- "The defaults are now correct" - persisted settings override defaults
- "I changed the component" - might be wrong component
- "I verified it" without showing proof - meaningless

### Before Claiming Fixed

1. Did I trace the COMPLETE code path from trigger to render?
2. Did I run actual verification and can I show the output?
3. If visual, did I query runtime state or take a screenshot?

**If you cannot show proof, do not claim it's fixed.**

---

## Writing Style: Avoid AI-isms

**STOP. Before writing ANY user-facing text (headings, descriptions, button labels, section intros), ask yourself: "Would Austen say this out loud at a fire jam?" If it sounds like a press release, rewrite it.**

**Scope: real-world copy only.** This test applies to marketing text, website copy, documentation, and app UI. It does NOT apply to museum game fiction — the museum can be dramatic, grandiose, and institutional. In-game plaques, Order documents, and Scribe text follow their own tone rules, not the fire jam test.

When writing user-facing copy, marketing text, documentation, or any prose for this project, avoid these patterns that scream "AI wrote this":

### TKA-Specific Bad Examples

These are real mistakes Claude made on this project. Don't repeat them.

| BAD (what Claude wrote) | GOOD (what it should be) | Why |
|-------------------------|--------------------------|-----|
| "Flow Artists in Motion" | "Real Performances" | Vague marketing fluff vs. specific |
| "Watch skilled performers bring sequences to life" | "Sequences performed with staves, fans, and clubs" | Empty praise vs. concrete description |
| "Empower your flow journey" | "Practice mode with camera feedback" | Meaningless vs. what it actually does |
| "Seamlessly integrate notation into your practice" | "See the pictograph while you spin" | Corporate speak vs. plain language |
| "Unlock the full potential of your movement vocabulary" | "Search the sequence library" | Buzzwords vs. what you actually do |
| "Whether you're a beginner or seasoned professional" | (just delete it) | Nobody talks like this |

### Banned Patterns

| Pattern | Example | Why It's Bad |
|---------|---------|--------------|
| Em dashes | "for teachers — whether you're starting out" | Dead giveaway. Use commas or periods. |
| Negative-to-positive flip | "Not to constrain, but to free" | Greeting card energy. Just state what it does. |
| Redundant emphasis | "Share across the world — communicates across distances" | You said the same thing twice. |
| Promotional superlatives | "revolutionary", "seamlessly", "effortlessly" | Nobody talks like this. |
| Vague benefits | "elevate your flow", "unlock potential" | Meaningless. Be specific. |
| Feature hallucination | Describing features that don't exist yet | Check the actual codebase first. |
| Lists of "your X, your Y, your Z" | "your body, your character, your vibe" | Do it once max, vary elsewhere. |
| Perfect threes | "efficient, reliable, and scalable" | AI overuses the Rule of Three with perfect rhythm. Break it: "good, fast, and honestly kind of ugly" |
| "Whether you're..." summaries | "Whether you're a beginner or expert, there's something for everyone" | No human ends paragraphs this way. |
| Robotic transitions | "Furthermore", "Moreover", "Additionally" | Just start the sentence. Cut "In conclusion" too. |
| Hedging phrases | "It's worth noting that...", "It's important to remember..." | Filler. State it directly. |
| Extended metaphor verbs | "weaving together", "painting a picture", "crafting your..." | Pseudo-literary padding. |
| Enthusiastic affirmations | "Absolutely!", "Certainly!", "Great question!" | Sycophantic AI tell. |

### Blacklisted Words

These appear statistically more often in AI output. Avoid or use sparingly:

| Category | Words |
|----------|-------|
| Nouns | tapestry, landscape, realm, journey, nuances |
| Adjectives | robust, comprehensive, crucial, pivotal, seamless |
| Verbs | delve, leverage, harness, unlock, foster, navigate, streamline |
| Marketing | game-changing, cutting-edge, next-level, empower |

### Banned Openers

Never start paragraphs with:
- "In today's fast-paced world..."
- "In an era where..."
- "In the ever-evolving landscape of..."
- "In the realm of..."

### Sentence Rhythm

AI writes uniform medium-length sentences. Real writing varies.

Short punches. Then longer explanations when the idea needs room to breathe. Fragments work. Staccato. The lack of variation (called "burstiness") is measurable by detectors.

### The Fire Jam Test

Read it out loud. Would Austen say this to another spinner at a fire jam?

- "Hey, check out these real performances" ✓
- "Behold, flow artists in motion bringing sequences to life" ✗

If you wouldn't say it out loud without cringing, rewrite it.

### When Writing Copy

1. **State what it does.** Not what it "empowers you to do."
2. **Be specific.** "Reference a single beat during rehearsal" > "communicate effectively"
3. **Cut redundancy.** If you said it, don't say it again with different words.
4. **Check features exist.** Don't describe capabilities the software doesn't have.
5. **No first person** on pages without a signature. "TKA does X" not "I built X."
6. **Vary sentence length.** Mix short and long. Break perfect patterns.
7. **Default to plain.** When in doubt, be boring. "Videos" not "Visual Showcase".

---

## Rules

`.claude/rules/` contains always-loaded rules (keep these small):
- `code-style.md` - Imports, Svelte 5, state, TypeScript
- `service-naming.md` - Never use "Service" suffix
- `styling.md` - CSS variables, typography, panels
- `testing.md` - Earned tests philosophy
- `workflows.md` - Playwright rules, context management, skill command index
- `project-patterns.md` - Module checklist
- `sequence-generation.md` - **READ THIS when generating sequences** - humor profile workflow

Workflow-specific rules (fb, release, monolith, deadcode) are minimal pointers. Full content lives in their `/skill` and loads on demand.

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

## CRITICAL: Never Run Unbounded System Searches

**On January 19, 2026, Claude ran a command that searched the ENTIRE Windows filesystem looking for Python processes. This consumed 67+ million characters of output and nearly exhausted the entire context window in a single command.**

### The Mistake

```bash
# NEVER DO THIS - Git Bash's find searched the entire system
tasklist /FI "..." | find /c "python"
```

Git Bash interpreted `find` as the Unix `find` command and searched every directory on the system.

### Rules:

1. **NEVER run `find` without an explicit, narrow path** - always specify the exact directory
2. **NEVER run system process queries through Git Bash** - use PowerShell or cmd.exe directly
3. **When checking if something is running, ASK THE USER** - "Is Instaloader still running?" takes 2 seconds
4. **Scope all searches narrowly** - if you need to search, search ONE directory, not the system
5. **When in doubt, don't run the command** - ask the user instead

### The Cost

One bad command can consume the ENTIRE context budget. There is no recovery. The session becomes unusable.

**If you're uncertain about a command's scope, DO NOT RUN IT. Ask the user.**
