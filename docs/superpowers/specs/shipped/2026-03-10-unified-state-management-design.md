# Unified State Management Pattern

**Date:** 2026-03-10
**Status:** Approved
**Feedback:** zVVZfFp5JBwrOb6P9bBm

## Problem

Four feature modules use four different state management patterns. No two manage state the same way. This makes the codebase harder to navigate and means every new module reinvents state management from scratch.

| Module | Pattern |
|--------|---------|
| Browse | State factory + prop drilling + module-level singletons |
| Create | State factory + Svelte context + global ref escape hatch |
| Learn | Inline `$state` + direct DI container access |
| Admin | No shared state, each component self-provisions from DI |

## Decision

Converge on **State Factory + Context**, standardizing what the Create module already does with two fixes: no global ref escape hatches, and DI services passed as arguments (not resolved internally).

## The Pattern

Three layers, each with one job:

| Layer | Lifetime | Job | File pattern |
|-------|----------|-----|-------------|
| DI Service | App | Business logic (load, save, validate, transform) | `services/implementations/X.ts` |
| State Factory | Component | Reactive UI state (`$state`, `$derived`, mutations) | `state/x-module-state.svelte.ts` |
| Context | Component subtree | Distribution to descendants | `context/x-module-context.ts` |

### Flow

```
ModuleRoot.svelte
  → const state = createXModuleState(container.items.loader, ...)
  → setXModuleContext({ state, handlers })

AnyDescendant.svelte
  → const ctx = getXModuleContext()
  → ctx.state.selectedItem     // reactive read via getter
  → ctx.handlers.selectItem(x) // mutation
```

### Rules

1. **State factories receive DI services as arguments.** Never resolve from container internally. This makes them testable and dependencies explicit.
2. **Factories return plain objects with getter accessors.** Not classes. Getters preserve reactivity across the context boundary.
3. **Context is set once in the module root.** Consumed by any descendant via typed accessor.
4. **No module-level singletons.** No `let instance = null` pattern. No global refs. No escape hatches.
5. **Simple modules get small state objects.** Not every module needs 15 fields. A module with two tabs and a selection might have 3 fields.
6. **Complex modules compose sub-factories.** Create's pattern of `createSequenceState()`, `createNavigationController()`, etc. composed into a parent factory is the right model.

## File Structure Convention

```
src/lib/features/your-module/
  YourModule.svelte                          # Module root: creates state, sets context
  state/
    your-module-state.svelte.ts              # State factory
    sub-state.svelte.ts                      # Sub-factory (if complex)
  context/
    your-module-context.ts                   # Context type + set/get helpers
  components/
    ...                                      # Children consume context
```

## State Factory Template

```typescript
// state/browse-module-state.svelte.ts
import type { IBrowseLoader } from "../services/contracts/IBrowseLoader";
import type { IBrowseFilter } from "../services/contracts/IBrowseFilter";

export type BrowseModuleState = ReturnType<typeof createBrowseModuleState>;

export function createBrowseModuleState(
  loader: IBrowseLoader,
  filter: IBrowseFilter
) {
  let isLoading = $state(false);
  let sequences = $state<SequenceData[]>([]);
  let selected = $state<SequenceData | null>(null);

  async function load() {
    isLoading = true;
    sequences = await loader.loadAll();
    isLoading = false;
  }

  function select(seq: SequenceData) {
    selected = seq;
  }

  return {
    get isLoading() { return isLoading; },
    get sequences() { return sequences; },
    get selected() { return selected; },
    load,
    select,
  };
}
```

## Context Template

```typescript
// context/browse-module-context.ts
import { getContext, setContext } from "svelte";
import type { BrowseModuleState } from "../state/browse-module-state.svelte";

const KEY = Symbol("browse-module");

export interface BrowseModuleContext {
  state: BrowseModuleState;
}

export function setBrowseModuleContext(ctx: BrowseModuleContext) {
  setContext(KEY, ctx);
}

export function getBrowseModuleContext(): BrowseModuleContext {
  return getContext<BrowseModuleContext>(KEY);
}
```

## Module Root Template

```svelte
<!-- BrowseModule.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { createBrowseModuleState } from "./state/browse-module-state.svelte";
  import { setBrowseModuleContext } from "./context/browse-module-context";

  const state = createBrowseModuleState(
    container.items.browseLoader,
    container.items.browseFilter
  );

  setBrowseModuleContext({ state });

  onMount(() => {
    state.load();
  });
</script>
```

## Child Component Template

```svelte
<!-- components/SequenceList.svelte -->
<script lang="ts">
  import { getBrowseModuleContext } from "../context/browse-module-context";

  const { state } = getBrowseModuleContext();
</script>

{#if state.isLoading}
  <p>Loading...</p>
{:else}
  {#each state.sequences as seq}
    <button onclick={() => state.select(seq)}>{seq.word}</button>
  {/each}
{/if}
```

## Scaling: Simple vs Complex Modules

### Simple (Learn, Admin)

Small state object, few fields, no sub-factories:

```typescript
export function createLearnModuleState(progressTracker: IConceptProgressTracker) {
  let activeMode = $state<LearnMode>("concepts");
  let selectedConcept = $state<LearnConcept | null>(null);

  return {
    get activeMode() { return activeMode; },
    get selectedConcept() { return selectedConcept; },
    selectConcept(c: LearnConcept) { selectedConcept = c; },
    setMode(m: LearnMode) { activeMode = m; },
  };
}
```

### Complex (Create)

Parent factory composes sub-factories:

```typescript
export function createCreateModuleState(deps: CreateModuleDeps) {
  const sequence = createSequenceState(deps.sequenceLoader);
  const navigation = createNavigationController();
  const persistence = createPersistenceController(deps.persister);

  return {
    sequence,
    navigation,
    persistence,
    // Module-level derived state that spans sub-factories:
    get isDirty() { return sequence.hasUnsavedChanges; },
  };
}
```

## Migration Priority

| Module | Effort | Why |
|--------|--------|-----|
| Learn | Small | Simplest module. Inline `$state` → small factory + context. Good first migration. |
| Admin | Small | Same — self-provisioning components → shared context. |
| Browse | Medium | Already has a factory. Swap prop drilling for context. Remove singleton escape hatches. |
| Create | Medium | Already closest to the pattern. Remove global ref escape hatch. Ensure DI services are passed as args. |

## What This Replaces

- Module-level singletons (`let instance = null; export function getInstance()`)
- Global ref escape hatches (`create-module-state-ref.svelte.ts`)
- Direct `container.items.x` calls scattered across leaf components
- Prop drilling of entire state objects through intermediate components
- Event handler services with `initialize()` callback wiring
