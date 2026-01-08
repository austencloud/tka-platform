---
description: Detect monolithic files with multiple responsibilities and propose DI-based decomposition
allowed-tools: Bash Read Edit Write Glob Grep Task TodoWrite
---

Run monolith detection to identify files with multiple responsibilities.

First, run the detection script:

```bash
node scripts/find-monoliths.cjs
```

Show the results summary to the user, then **automatically read the top AVAILABLE candidate file** (skip any marked 🔒 claimed) and provide a full analysis:

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

When multiple agents are working on monoliths simultaneously, use the claiming system to avoid conflicts:

**Before starting work**, claim the file:

```bash
node scripts/find-monoliths.cjs --claim "lib/path/to/File.svelte"
```

**After completing the refactor**, release the claim:

```bash
node scripts/find-monoliths.cjs --release "lib/path/to/File.svelte"
```

**Other useful commands:**

- `--claims` - See all active claims
- `--clear-expired` - Remove claims older than 2 hours (stale/crashed agents)

**If a file is already claimed:**

- The script will show who claimed it and when
- Move to the next available candidate instead
- Do NOT work on claimed files - another agent is already on it

---

## Decomposition Philosophy

The goal is **AI parseability and single responsibility**, not hitting specific line counts.

**Signs a file needs decomposition:**

- Multiple unrelated `$effect` blocks
- Many private functions doing different things
- Mixed concerns (data fetching + UI logic + state management)
- Hard to describe what the file does in one sentence

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
