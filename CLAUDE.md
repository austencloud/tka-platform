# Claude Code Guidelines for TKA Scribe

> **Meta-instruction**: This file is a living document. Claude should actively help build it out based on patterns observed in conversations. When the user expresses a general policy, preference, or recurring frustration, Claude should ask: _"Would you like me to add this to CLAUDE.md so future sessions follow this pattern?"_

---

## ⛔️⛔️⛔️ STOP: READ THIS BEFORE ANY GIT OPERATION ⛔️⛔️⛔️

# CATASTROPHIC DATA LOSS PREVENTION

**On January 2, 2026, Claude ran `git checkout -- .` and DESTROYED 8 HOURS OF USER WORK.**

**The changes were UNRECOVERABLE. The user lost an entire day of development.**

**This must NEVER happen again.**

---

## ABSOLUTE RULE: ASK BEFORE DISCARDING UNCOMMITTED CHANGES

### 🚫 FORBIDDEN COMMANDS - NEVER RUN WITHOUT EXPLICIT USER CONFIRMATION:

```
git checkout -- .
git checkout -- <any-file>
git reset --hard
git reset HEAD~
git clean -fd
git clean -f
```

### ✅ REQUIRED: ASK AND WAIT FOR CONFIRMATION

Before running any command that discards uncommitted changes:

1. **Tell the user exactly what you're about to do** and that it will discard their uncommitted work
2. **Wait for explicit confirmation** - something clearly affirmative like "yes", "go for it", "sure", "do it", etc.
3. **Do NOT run the command in the same message as asking** - wait for their response first

### 🧠 MENTAL MODEL:

**Every file in `git status` that shows as modified = HOURS OF USER WORK**

Do not think: "These look like corrupted files, I'll restore them"
Do think: "These are the user's precious uncommitted changes that may represent hours or days of work"

### ⚠️ IF YOU ARE UNCERTAIN:

**ASK THE USER. DO NOT GUESS. DO NOT ASSUME.**

The cost of asking is 10 seconds.
The cost of guessing wrong is 8 HOURS OF LOST WORK.

---

## File Size & Composition Philosophy

This project follows a **2025+ AI-assisted development approach**:

- **Single responsibility per file** - each file does one thing well
- **Composition over consolidation** - build features by composing small services
- **Don't warn about "too many files"** - AI navigation makes file count a non-issue
- **Extract when there are multiple responsibilities** - not to hit arbitrary line counts
- **Service-based architecture** - logic lives in services, components orchestrate

### Why this matters for AI-assisted development:

- Smaller files = smaller context windows = faster, cheaper, more accurate AI assistance
- Git diffs are cleaner and easier to review
- Each file is fully readable in one screen
- Easier to test, modify, and reason about in isolation
- When user says "fix X", AI can read one focused file instead of hunting through 500 lines

### What's NOT a good split:

- Re-export files that just forward imports
- Wrapper components that add no logic
- Splitting cohesive logic across files just to reduce line count
- Utility functions that belong together (e.g., string utils can live in one file)

---

## Technical Stack & Patterns

### Import Strategy: No Barrel Exports

**CRITICAL: Never use barrel exports (index.ts files that re-export other modules).**

**Why we removed them:**

- Barrel exports cause massive bundle bloat in Vite
- Importing one item from a barrel loads and evaluates the entire barrel
- Network requests skyrocket (especially in dev mode)
- Tree-shaking doesn't work reliably with re-exports
- Harder to trace dependencies

**What to do instead:**

- **Always import directly from source files** using relative paths
- Example: `import { MyComponent } from '../../components/MyComponent.svelte'`
- NOT: `import { MyComponent } from '../../components'`

**Rules:**

- Never create `index.ts` files in `src/` directory
- If you see an `index.ts` that re-exports, flag it for removal
- Direct imports are more verbose but vastly better for performance
- IDEs handle relative imports just fine with autocomplete

### Svelte 5

- Use **runes** (`$state`, `$derived`, `$effect`) not legacy reactive syntax
- Use `$props()` with TypeScript interfaces
- Prefer `$derived` over `$effect` when computing values

### State Management

- Use **context + runes** for shared state, not stores
- Services resolved via inversify DI container
- Settings persisted to Firebase with optimistic local updates

### Service Naming Convention (CRITICAL)

**Never use the word "Service" in service names.** Use descriptive, verb-based names instead.

This is a core architectural decision. The word "Service" is redundant - everything in the `services/` folder is already a service. Using action-oriented names makes the codebase more readable and intention-revealing.

**Naming patterns:**

| If the service does...  | Name it...      | Example                                   |
| ----------------------- | --------------- | ----------------------------------------- |
| Detection/checking      | `*Detector`     | `LOOPDetector`, `ReversalDetector`        |
| Management/coordination | `*Manager`      | `TurnManager`, `CollectionManager`        |
| Configuration           | `*Configurator` | `CardConfigurator`                        |
| Orchestration           | `*Orchestrator` | `GenerationOrchestrator`                  |
| Persistence/storage     | `*Persister`    | `SequencePersister`, `FilterPersister`    |
| Loading data            | `*Loader`       | `SequenceLoader`, `OptionLoader`          |
| Filtering               | `*Filter`       | `OptionFilter`, `DiscoverFilter`          |
| Sorting                 | `*Sorter`       | `OptionSorter`, `DiscoverSorter`          |
| Validation              | `*Validator`    | `SequenceValidator`                       |
| Transformation          | `*Transformer`  | `SequenceTransformer`                     |
| Analysis                | `*Analyzer`     | `SequenceAnalyzer`, `PositionAnalyzer`    |
| Calculation             | `*Calculator`   | `SequenceStatsCalculator`                 |
| Export/conversion       | `*Exporter`     | `SequenceExporter`, `CocoExporter`        |
| Import                  | `*Importer`     | `SequenceImporter`                        |
| Indexing                | `*Indexer`      | `SequenceIndexer`                         |
| Repository/CRUD         | `*Repository`   | `LibraryRepository`, `FeedbackRepository` |
| Playing media           | `*Player`       | `MusicPlayer`                             |
| Recording               | `*Recorder`     | `PerformanceRecorder`                     |
| Tracking                | `*Tracker`      | `SessionTracker`, `ActivityTracker`       |
| Handling events         | `*Handler`      | `DeepLinkSequenceHandler`                 |
| Notifying               | `*Notifier`     | `AdminNotifier`                           |
| Caching                 | `*Cache`        | `DiscoverCache`, `SequenceCache`          |

**Examples:**

```typescript
// ✅ CORRECT - Descriptive, action-oriented names
class LOOPDetector implements ILOOPDetector {}
class SequencePersister implements ISequencePersister {}
class TurnManager implements ITurnManager {}

// ❌ WRONG - Redundant "Service" suffix
class LOOPDetectionService implements ILOOPDetectionService {}
class SequencePersistenceService implements ISequencePersistenceService {}
class TurnManagementService implements ITurnManagementService {}
```

**Interface naming:** Interfaces follow the same pattern with `I` prefix:

- `ISequencePersister` (not `ISequencePersistenceService`)
- `ILOOPDetector` (not `ILOOPDetectionService`)

**When creating new services:**

1. Think: "What does this service DO?"
2. Name it after that action: Detector, Manager, Loader, etc.
3. Never append "Service" - it adds no information

### Styling

- Component-scoped `<style>` blocks
- CSS custom properties for design tokens
- Container queries (`cqw`, `cqh`) for component-relative sizing
- Mobile-first with progressive enhancement

### ⛔️ NEVER Create Global CSS Utility Classes in Svelte

**On January 3, 2026, Claude created `landing-utilities.css` with global classes like `.landing-section`, `.landing-container`, `.landing-h2` - then had to revert the entire change.**

**This was wrong. Svelte scopes styles for good reasons.**

**The mistake:** Seeing "duplicated" CSS like `.container { max-width: 1200px }` in multiple components and thinking "I should extract this to a shared file!"

**Why it's wrong:**

1. **Svelte scopes styles intentionally** - each component is self-contained and deleteable
2. **"Duplication" in scoped styles isn't a problem** - it's explicit, isolated, no hidden dependencies
3. **Global utility classes create coupling** - change the global, break N components
4. **Goes against the framework's philosophy** - Svelte chose scoping for a reason

**What to share in Svelte:**

| ✅ SHARE (via CSS variables)             | ❌ DON'T SHARE (keep scoped)                |
| ---------------------------------------- | ------------------------------------------- |
| Colors: `var(--theme-card-bg)`           | Layout: `.container { max-width }`          |
| Spacing tokens: `var(--spacing-md)`      | Typography: `h2 { font-size }`              |
| Border radii: `var(--radius-lg)`         | Section padding: `.section { padding }`     |
| Semantic colors: `var(--semantic-error)` | Grid definitions: `.grid { display: grid }` |

**The rule:** Share design tokens (values), not layout classes (rules).

**If you see "duplicated" layout CSS across Svelte components:**

- That's fine. Leave it alone.
- Each component owns its own layout.
- The "duplication" is actually encapsulation.

### CSS Variable Hierarchy (3 Layers)

See `src/lib/shared/settings/utils/background-theme-calculator.ts` for implementation.

**Layer 1: Static Layout Tokens (`--settings-*`)**

- Defined in `settings-tokens.css`
- Spacing, radius, typography, transitions
- Do NOT change with background

**Layer 2: Dynamic Theme Variables (`--theme-*`)**

- Injected by background-theme-calculator based on luminance
- Adapt to light/dark backgrounds
- Use for: surfaces, text, borders, accents, shadows
- Variables: `--theme-panel-bg`, `--theme-card-bg`, `--theme-accent`, `--theme-text`, etc.

**Layer 3: Semantic Colors (`--semantic-*`, `--prop-*`)**

- Constant colors that never change with background
- Status: `--semantic-error`, `--semantic-success`, `--semantic-warning`, `--semantic-info`
- Domain-specific: `--prop-blue`, `--prop-red`

**Pattern for new components:**

```css
.card {
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  color: var(--theme-text, #ffffff);
}
.error {
  color: var(--semantic-error);
}
```

**Legacy (`--*-current`)**: Still used by 30+ components. Migration ongoing.

### Unified Panel Background System

**Problem:** Panels had inconsistent backgrounds - some used glassmorphism blur, some used gradients, some used solid colors.

**Solution:** Use theme variables exclusively. NO blur effects on content panels.

**Panel Types:**

1. **Main Panels** (full-screen content areas):

   ```css
   background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
   ```

2. **Cards/Sub-panels** (nested content):

   ```css
   background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
   border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
   ```

3. **Hover States**:
   ```css
   border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
   ```

**Override Drawer Glassmorphism:**

Most drawers should NOT have blur. Override the defaults:

```css
:global(.your-drawer-class) {
  --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  --sheet-filter: none; /* Disable blur */
}
```

**When to use blur:** ONLY for modal backdrops to dim content behind. Never for content panels, drawers, forms, or interactive surfaces.

See `docs/UNIFIED_PANEL_BACKGROUNDS.md` for full guidelines.

### Testing Philosophy: "Earned Tests"

**Core principle:** Tests are earned, not given. Code must prove it deserves a test.

**Why this approach:**

- Most tests die - they get written, code changes, they're deleted
- Tests are insurance - only pay for expensive risks
- Production is the first test - real users find real bugs
- Zero fluff tolerance - if it doesn't provide measurable value, delete it

**When to write tests:**

| Scenario                           | Write Test? | Why                                  |
| ---------------------------------- | ----------- | ------------------------------------ |
| Pure algorithm/calculation         | ✅ Yes      | Math is stable, bugs are subtle      |
| Silent data corruption risk        | ✅ Yes      | You won't notice until it's too late |
| Bug that regressed twice           | ✅ Yes      | Proven problem worth preventing      |
| New feature, still evolving        | ❌ No       | Will change, test will die           |
| UI component                       | ❌ No       | You'll see if it's broken            |
| Glue code / wiring                 | ❌ No       | Obvious when broken                  |
| Something you'd notice immediately | ❌ No       | Your eyes are the test               |

**The "silent bug" test:** Ask yourself: "If this breaks, will I notice immediately, or will it silently produce wrong output?" Only test the silent ones.

**When to delete tests:**

- Code changed so much the test is meaningless
- Test requires complex mocking that breaks constantly
- You can't remember why the test exists
- Test is for something you'd notice immediately if broken

**Current test files (as of Dec 2024):**

Tests live in `tests/unit/` and cover core algorithms where bugs would be subtle:

- `DimensionCalculationService.test.ts` - Export dimension math
- `GridPositionDeriver.test.ts` - Grid position calculations
- `ReversalDetectionService.test.ts` - Prop reversal detection
- `DataTransformer.test.ts` - Pictograph data transforms

Run tests: `npm test`

---

### Typography System (Accessibility-First)

Defined in `src/app.css`. Two-tier minimum font size system:

**Tier 1: Essential Text (14px / 0.875rem minimum)**

- Use `var(--font-size-min)` or `var(--font-size-sm)`
- For: body text, form labels, buttons, links, error messages
- Any text users MUST read to understand/use the interface

**Tier 2: Supplementary Text (12px / 0.75rem minimum)**

- Use `var(--font-size-compact)` or `var(--font-size-xs)`
- For: navigation labels under icons, badges, timestamps, metadata
- Captions where context is already clear from surrounding UI

**Rules:**

- NEVER go below 12px for any user-visible text
- Icons can be smaller (10-12px) as they're not text
- Always use semantic tokens, not raw pixel values
- Include fallback: `var(--font-size-compact, 12px)`

**Pattern for new components:**

```css
.body-text {
  font-size: var(--font-size-min, 14px);
}
.badge {
  font-size: var(--font-size-compact, 12px);
}
.nav-label {
  font-size: var(--font-size-compact, 12px);
}
```

---

## Conversation Patterns

### /check command behavior

- Analyzes TypeScript errors and determines optimal fix strategy
- **Three strategies based on error count and complexity:**
  - **Single session** (<10 simple errors): Fix all errors immediately
  - **Multiple subagents** (10-50 errors): Launch parallel Task agents for different file groups
  - **Multiple Claude Code instances** (>50 errors or complex cascades): Generate scoped prompts for separate sessions
- **Always assess root causes** - don't just count errors, understand cascading type issues
- **Present analysis before acting** - show error summary, recommended strategy, and rationale
- **Get confirmation** before proceeding with fixes

### /fb command behavior

**CRITICAL FIRST STEP: Display feedback verbatim before ANY analysis**

When running `/fb`, you MUST start your response with the raw feedback details in this exact format:

```
## Claimed Feedback: [Title or "Untitled"]

**ID:** [document-id]
**Type:** [bug/feature/enhancement]
**Priority:** [low/medium/high]
**User:** [username]
**Created:** [timestamp]
**Module/Tab:** [module] / [tab]

---

**Description:**
[Full feedback text exactly as provided]

---

**Previous Notes:** [if any]

**Subtasks:** [if any]

---
```

**Then and only then** proceed with your assessment, interpretation, and recommendations.

**MANDATORY: Get confirmation before proceeding**

- After displaying feedback and providing your assessment, you MUST ask for explicit confirmation
- NEVER start working or delegating to subagents without user approval
- This applies to ALL feedback items (trivial, medium, and complex)
- Example: "Should I proceed with implementing this?" or "Would you like me to delegate this to Haiku?"

- **After implementing feedback**, provide clear testing instructions:
  - Summarize what was changed
  - List specific steps to verify the fix works
  - Include what to look for (expected behavior)
  - This helps when user has multiple feedback windows open

### Feedback & Release Workflow

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

### /release command behavior (CRITICAL)

**A release is NOT complete until the GitHub Release is created.**

When executing a release, you MUST complete ALL of these steps:

1. **Preview** - Run `node scripts/release.js -p` to see what's staged
2. **Commit** - Ensure all changes are committed
3. **Execute** - Run `node scripts/release.js --version X.Y.Z --confirm`
4. **Push tag** - `git push origin main && git push origin vX.Y.Z`
5. **Create GitHub Release** - **MANDATORY, DO NOT SKIP**:

   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(cat <<'EOF'
   ## What's New

   ### 🐛 Fixed
   - [user-friendly descriptions]

   ### ✨ Added
   - [user-friendly descriptions]

   ### 🔧 Improved
   - [user-friendly descriptions]
   EOF
   )"
   ```

6. **Archive feedback** - Run `node scripts/archive-feedback.js X.Y.Z`
7. **Sync develop** - `git checkout develop && git merge main && git push origin develop`

**The GitHub Release is what users see.** Pushing tags alone is not enough - users won't see the release notes without `gh release create`.

### What Goes in Release Notes (Critical!)

**Release notes are for FLOW ARTISTS, not developers.** Think like a user who creates choreography, doesn't code, and just wants to know what's better for them.

**✅ Include (mark as user-facing):**

- Features flow artists will use (new UI, new creative tools, new capabilities)
- Bug fixes that impact choreography workflow (crashes, broken features, incorrect animations)
- UX improvements they'll notice (performance, smoother interactions, easier workflows)
- **User perspective test:** Would a flow artist care about this?

**❌ Mark as internal-only** (`node scripts/fetch-feedback.js.js <id> internal-only true`):

- Developer workflow tooling (release scripts, feedback systems, build tools)
- Admin-only features (analytics, feedback Kanban, internal dashboards)
- Documentation for developers (workflow docs, architecture notes)
- Housekeeping (file organization, script cleanup, dev dependencies)
- Internal refactoring that doesn't change user experience
- **Rule of thumb:** If it's not visible or useful to a flow artist, mark it internal-only

**When writing release changelogs:**

- **Audience:** Flow artists who want to create better choreography
- **Skip:** Anything developer-focused or admin-only
- **Language:** Plain English, not technical jargon
- **Version bumps:** Only bump minor (0.x.0) when there are substantial user-facing improvements
- Always ask: "Would a flow artist who doesn't code care about this?"

### When Claude should proactively ask about updating this file:

- User expresses frustration about Claude repeatedly doing something wrong
- User states a general principle ("I always want...", "Never do...", "My preference is...")
- User corrects Claude on an architectural decision
- A pattern emerges across multiple requests

### Memory sync

- CLAUDE.md is the source of truth;

### Playwright Usage (IMPORTANT)

**DO NOT use Playwright for navigation or snapshots unless explicitly instructed.**

- Playwright snapshots are token-expensive (can consume 20k+ tokens per snapshot)
- Never proactively navigate with Playwright to "test" or "verify" fixes
- Only use Playwright when the user explicitly says to use it AND provides specific instructions
- If user wants to test, let THEM navigate in the browser - don't do it automatically
- Trust the user to test and report back

---

## New Module Checklist

**When creating a new module, complete these steps:**

### Step 1: Add to `moduleLoaders` in ModuleRenderer.svelte

```typescript
// src/lib/shared/modules/ModuleRenderer.svelte
const moduleLoaders = {
  // ... existing modules
  yourmodule: () => import("../../features/your-module/YourModule.svelte"),
};
```

### Step 2: Add to MODULE_DEFINITIONS in module-definitions.ts

```typescript
// src/lib/shared/navigation/config/module-definitions.ts
{
  id: "yourmodule",
  label: "Your Module",
  icon: '<i class="fas fa-icon" style="color: #hexcolor;" aria-hidden="true"></i>',
  color: "#hexcolor",
  description: "What your module does",
  isMain: true,
  sections: [], // Or YOUR_MODULE_TABS if it has tabs
}
```

### Step 3: Add DI module if needed

If your module has injectable services:

```typescript
// src/lib/shared/inversify/modules/yourmodule.module.ts
// Then register in loadFeatureModule() in di.ts
```

### Navigation is automatic

New modules **automatically get bottom navigation** on mobile. The system uses a blocklist pattern - only modules explicitly added to `MODULES_WITHOUT_NAV` in `layout-state.svelte.ts` will hide navigation.

**You do NOT need to manually add navigation.** Just complete the steps above and your module will have working navigation.

If you need to **hide** navigation for a specific module (rare), add it to `MODULES_WITHOUT_NAV` with a comment explaining why.

---

## Project-Specific Notes

- TKA Scribe is a Svelte 5 + TypeScript application
- Uses inversify for dependency injection
- Firebase for persistence and auth
- Focus on animation and interactive pictograph rendering

### Option Picker Architecture

The option picker has two layout branches but uses a **shared rendering primitive**:

```
Shared Primitive (single source of truth for pictograph rendering):
$lib/shared/pictograph/option/OptionPictograph.svelte

Desktop (≥750px) - wrapper handles state polling:
OptionCardContent.svelte → OptionPictograph

Mobile (<750px) - wrapper receives darkMode as prop:
OptionPictographCell.svelte → OptionPictograph
```

**Key files:**

- `$lib/shared/pictograph/option/OptionPictograph.svelte` - THE renderer (edit this for rendering changes)
- `$lib/shared/pictograph/option/PreparedPictographData.ts` - shared type definition
- `OptionCardContent.svelte` - desktop wrapper (polls for Dark Mode state)
- `OptionPictographCell.svelte` - mobile wrapper (receives darkMode prop from parent)

**When fixing rendering issues:** Edit `OptionPictograph.svelte` - both desktop and mobile use it.

### User Identity

- **Primary developer**: Austen Cloud (austencloud@gmail.com)
- When submitting feedback via scripts, default to `--user austen`

### Feedback Script Syntax (CRITICAL)

**The feedback script uses POSITIONAL arguments, NOT flags.**

```bash
# ✅ CORRECT - Positional arguments
node scripts/fetch-feedback.js create "Title here" "Description here" feature module tab

# ❌ WRONG - Do NOT use flag syntax
node scripts/fetch-feedback.js create --title "Title" --description "Desc" --type feature
```

**Create syntax:**

```bash
node scripts/fetch-feedback.js create "title" "description" [type] [module] [tab]
```

- `type`: bug, feature, enhancement, general (default: enhancement)
- `module`: compose, create, discover, settings, etc.
- `tab`: optional sub-tab

**Update status syntax:**

```bash
node scripts/fetch-feedback.js <id> <status> "resolution notes"
```

- Status: new, in-progress, in-review, completed, archived

**Examples:**

```bash
# Create a feature
node scripts/fetch-feedback.js create "What's New modal" "Shows version changes to users" feature settings

# Mark completed
node scripts/fetch-feedback.js abc123 completed "Released in v0.7.2"

# Delete
node scripts/fetch-feedback.js delete abc123
```

### /done command behavior (auto-create workflow)

When `/done` is called and there's no matching feedback item for the work just completed:

1. **Auto-create** a feedback item under Austen's profile (`--user austen`)
2. **Auto-complete** it immediately with appropriate admin notes
3. **Mark internal-only** if it's infrastructure/developer work (not user-facing)
4. **Do NOT ask** for confirmation - just do it automatically
5. Report what was created so the user knows it's tracked

**Source field distinction:**

Feedback items have a `source` field to distinguish origin:

- `source: "app"` - User submitted through the in-app feedback form (real user feedback)
- `source: "terminal"` - Created via CLI/Claude Code (dev work log)

When auto-creating via `/done`, the script automatically sets `source: "terminal"`. This allows filtering "what users actually submitted" vs "what devs proactively fixed."

**Terminal-sourced items (via /done):**

Unlike app feedback (problem → resolution), terminal items are work logs:

- Work is already complete when created
- Title describes what was done (not a problem to solve)
- Description has details of the work
- Created directly as `completed` status
- No separate "resolution notes" needed (description IS the resolution)

**Format:**

- **Title**: Brief description of completed work
  - Example: "Simplified Analytics dashboard to 3 metrics"
- **Description**: Details of what was changed and why
  - What was the work? What files were affected? What's the outcome?

---

_Last updated: 2026-01-04_

---

## Context Management

When context usage exceeds 20%, proactively suggest running /compact before continuing with new tasks.
