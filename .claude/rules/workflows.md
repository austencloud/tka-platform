# Command & Workflow Behaviors

## Skill-Based Commands

These commands load their full workflow via skills. See the skill for details:

- `/check` - TypeScript error analysis and fixing
- `/fb` - Claim and work on feedback items
- `/release` - Create a new release version
- `/done` - Mark feedback completed or auto-create
- `/ai-bust` - Scan text for AI writing patterns
- `/monolith` - Detect and decompose monolithic files
- `/deadcode` - Find and remove unused code
- `/concepts` - Learn tab concept lesson development and tracking
- `/lab` - Triage lab tabs: graduate, keep, archive, or delete experiments
- `/skill-audit` - Audit a skill against writing-skills quality standards
- `/premium` - Audit premium gating status or classify new features as free/premium
- `/deck` - Enumerate, seed, and manage algorithmic LOOP decks

---

## Playwright Usage

### Ask the user first.

**Before using Playwright for verification, ask: "Can you check [X] and tell me what you see?"**

The user looking at their screen and telling you "yes it works" costs ~10 tokens.
A screenshot costs ~15,000 tokens. Clicking through the app costs 30,000+ tokens.

### Permission Model

Interactive Playwright commands (`browser_navigate`, `browser_click`, `browser_type`) require **explicit verbal permission** in the current conversation.

**Counts as permission:** "Go ahead and use Playwright autonomously", "Test this yourself", "Take control of the browser"

**Does NOT count:** User mentioning Playwright exists, asking you to test something (tell them WHERE to go), silence.

### Default Protocol (No Permission)

1. User navigates, Claude observes
2. Claude only takes snapshots/screenshots when user says "look at this"
3. Claude advises where to go, what to click, what to look for

### Always Allowed (Read-Only)

`browser_snapshot`, `browser_take_screenshot`, `browser_console_messages` - when user asks to evaluate a page.

---

## Context Management

When context exceeds **70%**, suggest `/compact` before continuing with new tasks.
