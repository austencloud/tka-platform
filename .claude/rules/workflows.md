# Command & Workflow Behaviors

## /check Command

- Analyzes TypeScript errors and determines optimal fix strategy
- **Two strategies based on error count and complexity:**
  - **Single session** (<15 errors): Fix all errors directly
  - **Parallel subagents** (15+ errors): Launch Task agents for different file groups
- **Always assess root causes** - don't just count errors, understand cascading type issues
- **Present analysis before acting** - show error summary, recommended strategy, and rationale
- **Get confirmation** before proceeding with fixes

---

## /fb Command

**Show the feedback first, then discuss.**

When running `/fb`, immediately display what was claimed so the user knows exactly what we're working on. Include:

- **Title** and **ID**
- **Type** (bug/feature/enhancement) and **Priority**
- **Who submitted it** and **when**
- **Module/Tab** it affects
- **The full description** - word for word
- **Any existing notes or subtasks**

Format naturally - doesn't have to be a rigid template, but all the above must be visible before any analysis or recommendations.

**Then:**
1. Share your interpretation and suggested approach
2. **Ask for confirmation** before starting work - never jump into implementation

**After implementing:**
- Summarize what changed
- Give clear testing steps
- Describe expected behavior

---

## Feedback & Release Workflow

- Full workflow documentation: `docs/FEEDBACK-WORKFLOW.md`
- Quick reference:
  - **5 statuses**: `new → in-progress → in-review → completed → archived`
  - **Kanban phase** (new → in-progress → in-review): Active development
  - **Staging phase** (completed): Items ready for next release
  - **Release phase** (archived + fixedInVersion): Released and versioned
- Key commands:
  - `/fb` - Claim and work on feedback
  - `node scripts/release.js -p` - Preview next release
  - `/release` - Ship completed items as a version
- Remember: `completed` means "ready to ship", not "shipped" (that's `archived`)

---

## /release Command (CRITICAL)

**A release is NOT complete until the GitHub Release is created.**

When executing a release, complete ALL steps:

1. **Preview** - `node scripts/release.js -p`
2. **Commit** - Ensure all changes are committed
3. **Execute** - `node scripts/release.js --version X.Y.Z --confirm`
4. **Push tag** - `git push origin main && git push origin vX.Y.Z`
5. **Create GitHub Release** (use Git Bash on Windows):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file release-notes.md
   ```
   Or write notes inline (Git Bash required for heredoc):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" -F - <<EOF
   ## What's New
   ### Fixed
   - [descriptions]
   ### Added
   - [descriptions]
   EOF
   ```
6. **Archive feedback** - `node scripts/archive-feedback.js X.Y.Z`
7. **Sync develop** - `git checkout develop && git merge main && git push`

**The GitHub Release is what users see.** Tags alone aren't enough.

---

## Release Notes Guidelines

**Audience: Flow artists, not developers.**

**Include:**
- Features they'll use
- Bug fixes that affected their workflow
- UX improvements they'll notice

**Mark internal-only** (`node scripts/fetch-feedback.js <id> internal-only true`):
- Dev tooling, admin features, docs, refactoring, housekeeping

**Test:** Would a flow artist who doesn't code care about this?

---

## /done Command

When `/done` is called with no matching feedback item:

1. Auto-create feedback under Austen's profile
2. Auto-complete it immediately
3. Mark internal-only if it's dev/infrastructure work
4. Report what was created

**Source field:** `"terminal"` (vs `"app"` for user-submitted) - allows filtering dev work from real user feedback.

---

## Playwright Usage

**Don't use Playwright unless explicitly asked.**

- Snapshots consume 20k+ tokens
- Never proactively "test" or "verify" via Playwright
- Let the user test in their browser
- Only use when given specific instructions

---

## Context Management

When context exceeds **70%**, suggest `/compact` before continuing with new tasks.
