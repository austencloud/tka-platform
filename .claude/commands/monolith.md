---
description: Detect monolithic files with multiple responsibilities and propose DI-based decomposition
allowed-tools: Bash Read Edit Write Glob Grep Task TodoWrite
---

Run monolith detection to identify files with multiple responsibilities.

**IMPORTANT: Use auto-claim to prevent race conditions with other agents.**

Run the detection script with `--auto-claim` to atomically find and claim the top available file:

```bash
node scripts/find-monoliths.cjs --auto-claim
```

This command:
1. Acquires an exclusive lock (blocks other agents)
2. Scans for monoliths
3. Claims the top available file (not audited, not claimed)
4. Releases the lock
5. Outputs `CLAIMED_FILE: src/<path>` - parse this to know which file to work on

If auto-claim fails (no available files), inform the user and suggest `--claims` to see what's in progress.

After successfully claiming, **read the claimed file** and provide a full analysis:

1. **Read the file** - Don't ask permission, just read it
2. **Identify responsibilities** - List each distinct thing the file does
3. **Propose decomposition** - Suggest specific DI-registered services to extract
4. **Estimate complexity** - Simple (1 session), Medium (2-3 extractions), Complex (major refactor)

Present your analysis and recommendations, then ask if the user wants to proceed with decomposition.

---

## CRITICAL: Service Extraction Pattern

**Every extraction MUST follow this exact structure. No exceptions.**

### The ONLY Valid Extraction Pattern:

```
1. Interface:    services/contracts/I{Name}.ts
2. Implementation: services/implementations/{Name}.ts
3. DI Type:      Add to src/lib/shared/inversify/types.ts (or types/{domain}.types.ts)
4. DI Module:    Register in src/lib/shared/inversify/modules/{feature}.module.ts
5. Resolution:   Component uses resolve<I{Name}>(TYPES.I{Name})
```

### Example - Correct Extraction:

```typescript
// 1. Contract: services/contracts/ISequenceLoader.ts
export interface ISequenceLoader {
  loadFullSequence(seq: SequenceData): Promise<SequenceData | null>;
}

// 2. Implementation: services/implementations/SequenceLoader.ts
@injectable()
export class SequenceLoader implements ISequenceLoader {
  constructor(
    @inject(TYPES.IDiscoverLoader) private discoverLoader: IDiscoverLoader
  ) {}

  async loadFullSequence(seq: SequenceData): Promise<SequenceData | null> {
    // implementation
  }
}

// 3. Type symbol: src/lib/shared/inversify/types.ts
ISequenceLoader: Symbol.for("ISequenceLoader"),

// 4. Module registration: src/lib/shared/inversify/modules/{feature}.module.ts
options.bind(TYPES.ISequenceLoader).to(SequenceLoader);

// 5. Component resolution:
const loader = resolve<ISequenceLoader>(TYPES.ISequenceLoader);
```

### Service Naming (from service-naming.md):

| Action | Suffix | Example |
|--------|--------|---------|
| Load data | `*Loader` | `SequenceLoader` |
| Detect/check | `*Detector` | `LayoutDetector` |
| Manage state | `*Manager` | `PlaybackManager` |
| Calculate | `*Calculator` | `BeatCalculator` |
| Resolve/derive | `*Resolver` | `StateResolver` |
| Observe | `*Observer` | `ResizeObserver` |

**NEVER use "Service" suffix.**

---

## Component Extraction (Markup + Scoped CSS)

**When a component has significant CSS, extract child components that take their markup AND scoped styles with them.**

This is NOT the same as "extracting CSS to a file" (which is forbidden). This is proper Svelte component decomposition where styles travel with their markup.

### When to Extract Components:

- A distinct UI section has 50+ lines of CSS
- The markup is self-contained (doesn't need parent's private state)
- The section is conceptually a single "thing" (overlay, sidebar, control bar)

### Example - Valid Component Extraction:

```svelte
<!-- BEFORE: AnimationPlayer.svelte (1094 lines) -->
<div class="export-overlay">
  <div class="export-card">
    <span>{progressLabel} {progressPct}%</span>
    <div class="progress-bar"><div style="width:{progressPct}%"></div></div>
    <button onclick={cancelExport}>Cancel</button>
  </div>
</div>

<style>
  .export-overlay { /* 30 lines of CSS */ }
  .export-card { /* 20 lines of CSS */ }
  /* ... */
</style>
```

```svelte
<!-- AFTER: ExportProgressOverlay.svelte (new component) -->
<script lang="ts">
  let { progress, label, onCancel }: Props = $props();
</script>

<div class="export-overlay">
  <div class="export-card">
    <span>{label} {progress}%</span>
    <div class="progress-bar"><div style="width:{progress}%"></div></div>
    <button onclick={onCancel}>Cancel</button>
  </div>
</div>

<style>
  /* All related CSS moves here with the markup */
  .export-overlay { ... }
  .export-card { ... }
</style>
```

### Component Extraction Checklist:

- [ ] Is the markup self-contained?
- [ ] Can props replace any parent state references?
- [ ] Does the CSS only target elements within this section?
- [ ] Is the component reusable or at least conceptually distinct?

### What CAN be extracted as components:

| Section | Component Name | Why |
|---------|---------------|-----|
| Export progress overlay | `ExportProgressOverlay.svelte` | Self-contained UI with its own styles |
| Transport controls row | `HorizontalTransportRow.svelte` | Distinct control section |
| Sidebar settings | `AnimationSidebar.svelte` | Large self-contained section |
| Loading/error states | `AnimationPlayerState.svelte` | Reusable state display |

---

## FORBIDDEN Patterns - DO NOT USE

**If you find yourself proposing any of these, STOP and reconsider:**

| FORBIDDEN | WHY | CORRECT ALTERNATIVE |
|-----------|-----|---------------------|
| `use*.ts` or `use*.svelte.ts` | React hook pattern, not our architecture | DI service with interface |
| `*Utils.ts` or `*Helpers.ts` | Utility files violate DI pattern | DI service |
| `*.css` standalone file | CSS without markup is wrong | Extract component with markup + CSS |
| Loose function files | No DI registration = wrong | DI service |
| Factory functions without DI | Bypasses container | Register factory in DI |

### Examples of WRONG proposals:

```
❌ useAnimationState.svelte.ts     -> ✅ IStateResolver + StateResolver in DI
❌ useSidebarResize.svelte.ts      -> ✅ ILayoutDetector + LayoutDetector in DI
❌ animationUtils.ts               -> ✅ IAnimationCalculator + AnimationCalculator in DI
❌ helpers/formatters.ts           -> ✅ IFormatter + Formatter in DI
❌ AnimationPlayer.css             -> ✅ Extract component with markup + scoped CSS
```

---

## Validation Checklist

**Before proposing any extraction, verify each item:**

- [ ] Does it have an interface in `services/contracts/`?
- [ ] Does it have an implementation in `services/implementations/`?
- [ ] Is it decorated with `@injectable()`?
- [ ] Will it be registered in a DI module?
- [ ] Does the name follow service-naming.md (no "Service" suffix)?
- [ ] Is it NOT a hook, utility, helper, or loose file?

**If any checkbox fails, the extraction is invalid.**

---

## Multi-Agent Claiming (IMPORTANT)

**ALWAYS use `--auto-claim` when running /monolith.** This is the only race-condition-safe way to claim files.

The auto-claim mechanism:
1. Uses file locking to prevent two agents from claiming simultaneously
2. Atomically selects and claims the top available file
3. Blocks other agents until the claim is written

**After completing the refactor**, release the claim:

```bash
node scripts/find-monoliths.cjs --release "lib/path/to/File.svelte"
```

**Other useful commands:**

- `--claims` - See all active claims
- `--clear-expired` - Remove claims older than 2 hours (stale/crashed agents)
- `--claim <path>` - Manually claim a specific file (NOT race-safe, avoid using)

**If auto-claim reports no available files:**

- Run `--claims` to see what's in progress
- Either wait for other agents to finish, or help with a different task

---

## Decomposition Philosophy

The goal is **AI parseability and single responsibility**, not hitting specific line counts.

### The Four Perspectives Test

Before recommending decomposition, evaluate through four distinct lenses.
Each perspective must explicitly consider why it might be wrong.

**1. The Architect's Lens** (Optimizes for: abstraction boundaries)
- Is the responsibility boundary at the right level?
- Would extraction add indirection without improving testability or reusability?
- Is the complexity *inherent to the domain* or *accidental from poor structure*?
- **Devil's Advocate:** "Even if this looks complex, what if extraction just moves the complexity?"

**2. The Pragmatist's Lens** (Optimizes for: maintainability)
- Can I find a bug in this file within 5 minutes of reading?
- Can I add a feature following the existing patterns?
- Is there *actual* duplication, or just *superficial* similarity?
- **Devil's Advocate:** "Even if this file is large, what if it's large because the problem is large?"

**3. The Skeptic's Lens** (Optimizes for: avoiding unnecessary work)
- Would extraction create files that need the same props/context passed through?
- Would I be creating coupling between files that used to be self-contained?
- Am I solving a real problem or just uncomfortable with line count?
- **Devil's Advocate:** "What if my instinct to extract is just pattern-matching on 'big = bad'?"

**4. The Svelte Component Lens** (Optimizes for: scoped composition)

In Svelte, CSS is scoped to components - when you extract a component, its styles travel with it.
High CSS percentage is NOT a reason to leave a file alone; it's a signal to look for extractable UI sections.

- Are there distinct UI sections with 50+ lines of associated CSS?
- Can those sections take their markup AND styles as self-contained units?
- Does each section have its own local state (edit mode, loading, validation)?
- Would extraction create conceptually distinct, potentially reusable components?
- **Devil's Advocate:** "Even if there's a lot of CSS, what if extracting would create tight coupling or prop drilling?"

**CSS-heavy file analysis checklist:**
1. Calculate CSS percentage (lines 500-900 being CSS = 44%)
2. Identify distinct UI sections in the markup
3. Map which CSS selectors belong to which sections
4. Check if sections have independent state
5. Evaluate prop boundaries - can parent just pass value + callbacks?

**Convergence Rule:**
- If 3/4 perspectives say "extract" → proceed with extraction
- If 3/4 perspectives say "leave it" → mark as audited
- If 2-2 split → evaluate which extractions have clearest boundaries, or leave alone
- The Svelte Component Lens can override Skeptic when CSS sections are clearly self-contained

### Signs a file ACTUALLY needs decomposition:

- **Polling/workarounds** - Comments like "polling workaround" indicate architectural debt
- **Multiple unrelated `$effect` blocks** doing different jobs (not just reactive glue)
- **Mixed concerns** that don't belong together (e.g., URL routing in a coordinator)
- **Prop explosion** - Passing 30+ props suggests state ownership is unclear
- **Can't describe in one sentence** - "It handles X and also Y and also Z"

### Signs a file is fine despite high line count:

- **Orchestrators** - Coordinating many services with thin delegation is their job
- **Test utilities** - Benchmarks and test pages don't need production architecture
- **Clear sections** - Well-commented, logically grouped code is readable at any size
- **Logic is elsewhere** - If it just wires services together, size reflects coordination scope
- **Atomic UI** - The CSS serves ONE indivisible UI element (e.g., a single complex button)

**NOTE:** High CSS percentage (50%+) is NOT automatically "fine" - apply the Svelte Component Lens to check for extractable sections. CSS travels with components in Svelte, so CSS-heavy files often have extraction opportunities.

**The workflow:**

1. **Identify responsibilities** - what does this file actually do?
2. **Group by domain** - related responsibilities become one service
3. **Extract contracts** - `services/contracts/I{ServiceName}.ts`
4. **Implement services** - `services/implementations/{ServiceName}.ts`
5. **Wire via inversify** - register in the appropriate DI module
6. **Slim the original** - it becomes an orchestrator that composes services

## What NOT to do:

- Create utility files (use DI services instead)
- Create barrel exports (import directly from source)
- Create hook files (`use*.ts`) - this is React, not our architecture
- Split just to reduce line count
- Create wrappers with no logic
- Extract CSS to standalone `.css` files (extract components with markup + CSS instead)
