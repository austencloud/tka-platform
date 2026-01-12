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

**Tone: Matter-of-fact, not promotional.**

Write release notes like Claude Code's changelog - straightforward statements of what changed. No selling, no hype, no filler words.

### Good Examples (matter-of-fact)
- "Smoother animations on help overlays"
- "Fixed library sequences displaying wrong dates"
- "Renamed 'Customize' to 'Start/End' in generator"
- "New animated background options"

### Bad Examples (promotional AI-speak)
- ❌ "New animated backgrounds while you practice - aurora, galaxy, swimming fish, and forest themes"
- ❌ "Stunning new Milky Way Galaxy effect brings your sequences to life!"
- ❌ "Experience smoother, more polished animations throughout the app"

The "while you practice" and dashes with feature lists are promotional filler. Just state what changed.

### What NOT to feature prominently
- Technical/cosmetic changes (backgrounds, particle effects) - consolidate into one line like "New background options"
- Implementation details users don't care about
- Things that only make sense to developers

### Mark internal-only
`node scripts/fetch-feedback.js <id> internal-only true`
- Dev tooling, admin features, docs, refactoring, housekeeping

**Test:** Read it out loud. Does it sound like a press release or a changelog?

---

## /done Command

Two modes - automatically detected based on the first argument:

### Mode 1: Complete Existing Feedback

When first arg is a document ID (20-char alphanumeric):

```bash
/done abc123xyz "Fixed the issue"
/done abc123xyz "Admin notes" "User-facing notes"
```

### Mode 2: Auto-Create and Complete (Quick Log)

When first arg is a title (has spaces or descriptive text):

```bash
/done "Help button discovery overlay"
/done "Fix thumbnail cache" "Updated cache key derivation"
```

**What happens in auto-create mode:**

1. Creates feedback under Austen's profile
2. Sets status directly to `completed`
3. Marks as `internal-only` (excluded from user changelog)
4. Reports what was created with document ID

**Detection:** If first arg is 20+ alphanumeric chars with no spaces → existing ID. Otherwise → title for auto-create.

**Implementation:** See `.claude/commands/done.md` for full details.

---

## Playwright Usage

### ⛔ CRITICAL: NEVER USE INTERACTIVE PLAYWRIGHT WITHOUT EXPLICIT PERMISSION ⛔

**Default mode: User navigates, Claude observes.**

Interactive Playwright commands (`browser_navigate`, `browser_click`, `browser_type`, etc.) require **EXPLICIT VERBAL PERMISSION** in the current conversation.

### What Counts as Permission

User must say something like:
- "Go ahead and use Playwright autonomously"
- "You can navigate/click freely"
- "Take control of the browser"
- "Test this yourself with Playwright"

### What Does NOT Count as Permission

- User mentioning Playwright exists
- User asking you to test something (tell them WHERE to go, don't go yourself)
- User asking what's on a page (ask them to navigate and tell you when to look)
- Silence - if they haven't explicitly granted autonomous control, YOU DON'T HAVE IT

### Default Protocol (No Permission Granted)

1. **User is the navigator** - they control the browser
2. **Claude only observes** - snapshots/screenshots ONLY when user says "look at this"
3. **Claude advises** - tell user where to go, what to click, what to look for
4. **User confirms** - they tell Claude when they've arrived

### With Permission Granted

If user explicitly says "go ahead with Playwright" or equivalent, you may:
- Navigate to URLs
- Click elements
- Fill forms
- Take snapshots autonomously

Permission expires at end of conversation or when user revokes it.

### Always Allowed (Read-Only)

These never require permission:
- `browser_snapshot` - when user asks to evaluate a page
- `browser_take_screenshot` - when user asks to see something
- `browser_console_messages` - when debugging

### Why This Matters

- Snapshots consume 20k+ tokens each
- Autonomous navigation burns tokens on wrong pages
- User knows their app better than Claude
- Claude clicking around wastes time and money
- On January 7, 2026, Claude burned massive tokens navigating autonomously without permission

### Example: Default Mode (No Permission)

```
User: "The background builder isn't loading fish"
Claude: "Dev server should be at localhost:5173/background-builder.
        Navigate there and tell me when you're ready for me to look."
User: "I'm there now"
Claude: [takes snapshot, analyzes]
```

### Example: Permission Granted

```
User: "Go ahead and test the background builder with Playwright"
Claude: [NOW allowed to navigate, click, etc.]
Claude: [navigates to localhost:5173/background-builder]
Claude: [takes snapshot, analyzes, clicks around as needed]
```

---

## Context Management

When context exceeds **70%**, suggest `/compact` before continuing with new tasks.
