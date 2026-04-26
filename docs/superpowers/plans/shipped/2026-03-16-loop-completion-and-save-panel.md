# LOOP Completion Button & Save Panel Redesign - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a LOOP completion ring button to the workspace header for one-tap sequence auto-completion, relocate the save button to the bottom bar, and clean up the save panel (desktop: no preview, mobile: preview with column toggle).

**Architecture:** Three independent pieces: (1) LOOP ring button + popover + confirmation wired to the existing `ExtensionFlowCoordinator`, (2) save button relocation from header to `ButtonPanel.svelte`, (3) save panel responsive cleanup. All use existing DI services — no new service classes needed.

**Tech Stack:** Svelte 5 runes, TypeScript, ITI DI, existing `ExtensionFlowCoordinator` / `LOOPDetector` / `LOOPTypeResolver` services.

**Spec:** `docs/superpowers/specs/2026-03-16-loop-completion-and-save-panel-design.md`

---

## Chunk 1: Settings & Confirmation Infrastructure

### Task 1: Add `skipLoopConfirmation` to AppSettings

**Files:**
- Modify: `src/lib/shared/settings/domain/AppSettings.ts:98`

- [ ] **Step 1: Add the setting**

In `AppSettings.ts`, after line 98 (`skipClearConfirmation`), add:

```typescript
skipLoopConfirmation?: boolean; // Skip confirmation when applying LOOP auto-completion (undo is available)
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS (optional field, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/settings/domain/AppSettings.ts
git commit -m "feat(settings): add skipLoopConfirmation setting"
```

---

### Task 2: Add LOOP confirmation toggle to PreferencesTab

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/PreferencesTab.svelte:36-88`

- [ ] **Step 1: Add derived state and handler**

After the existing `showClearConfirmation` derived (line 38) and `handleToggleClearConfirmation` (lines 40-46), add:

```typescript
const showLoopConfirmation = $derived(
  !currentSettings?.skipLoopConfirmation
);

function handleToggleLoopConfirmation() {
  hapticService?.trigger("selection");
  onSettingUpdate?.({
    key: "skipLoopConfirmation",
    value: showLoopConfirmation, // Toggle: if currently showing, now skip
  });
}
```

- [ ] **Step 2: Add the toggle UI**

After the clear confirmation toggle button (line 88), before the `<!-- Future preferences -->` comment (line 90), add:

```svelte
<!-- LOOP Auto-Complete Confirmation -->
<button
  type="button"
  class="toggle-row"
  onclick={handleToggleLoopConfirmation}
  aria-pressed={showLoopConfirmation}
>
  <div class="toggle-info">
    <span class="toggle-label">{t("settings_ask_before_loop")}</span>
  </div>
  <div class="toggle-switch" class:active={showLoopConfirmation}>
    <div class="toggle-knob"></div>
  </div>
</button>
```

- [ ] **Step 3: Add the i18n key**

In `messages/en.json`, after the `settings_ask_before_clearing` key (line 573), add:

```json
"settings_ask_before_loop": "Ask before applying LOOP"
```

Also add the same key to other translation files (`messages/es.json`, `messages/fr.json`, etc.) with English as placeholder — translations can be updated later.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/settings/components/tabs/PreferencesTab.svelte
git commit -m "feat(settings): add LOOP confirmation toggle to preferences"
```

---

## Chunk 2: LOOP Ring Button Component

### Task 3: Create LOOPRingButton.svelte

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/shared/components/buttons/LOOPRingButton.svelte`

This is a 48px circular button containing a ring with 6 colored arc segments. Each segment represents a LOOP component with three visual states: full color, faint (25% opacity), or gray (10% opacity).

- [ ] **Step 1: Create the component**

```svelte
<!--
  LOOPRingButton.svelte

  Compact circular button showing 6 LOOP component segments as colored arcs.
  Full color = active in detected LOOP, faint = available for completion, gray = not possible.
  Tapping opens the LOOP completion popover.
-->
<script lang="ts">
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { LOOP_COMPONENT_MAP } from "$lib/features/create/generate/shared/domain/constants/loop-constants";

  interface Props {
    /** Components that are active (sequence already satisfies) */
    activeComponents: Set<LOOPComponent>;
    /** Components available for auto-completion */
    availableComponents: Set<LOOPComponent>;
    /** Whether the button is disabled (too few beats) */
    disabled?: boolean;
    onclick?: () => void;
  }

  let {
    activeComponents,
    availableComponents,
    disabled = false,
    onclick,
  }: Props = $props();

  // All 6 components in canonical display order
  const ALL_COMPONENTS: LOOPComponent[] = [
    LOOPComponent.ROTATED,
    LOOPComponent.MIRRORED,
    LOOPComponent.FLIPPED,
    LOOPComponent.SWAPPED,
    LOOPComponent.INVERTED,
    LOOPComponent.REWOUND,
  ];

  // SVG arc geometry: 6 segments in a ring
  const RING_RADIUS = 16;
  const RING_CENTER = 20;
  const RING_STROKE = 4;
  const SEGMENT_COUNT = 6;
  const GAP_ANGLE = 4; // degrees between segments
  const SEGMENT_ANGLE = (360 - GAP_ANGLE * SEGMENT_COUNT) / SEGMENT_COUNT;

  function arcPath(index: number): string {
    const startAngle = index * (SEGMENT_ANGLE + GAP_ANGLE) - 90;
    const endAngle = startAngle + SEGMENT_ANGLE;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = RING_CENTER + RING_RADIUS * Math.cos(startRad);
    const y1 = RING_CENTER + RING_RADIUS * Math.sin(startRad);
    const x2 = RING_CENTER + RING_RADIUS * Math.cos(endRad);
    const y2 = RING_CENTER + RING_RADIUS * Math.sin(endRad);
    const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  function segmentColor(component: LOOPComponent): string {
    return LOOP_COMPONENT_MAP.get(component)?.color ?? "#666";
  }

  function segmentOpacity(component: LOOPComponent): number {
    if (activeComponents.has(component)) return 1;
    if (availableComponents.has(component)) return 0.35;
    return 0.1;
  }

  const hasAnyActivity = $derived(
    activeComponents.size > 0 || availableComponents.size > 0
  );

  const tooltip = $derived.by(() => {
    if (disabled) return "Add more beats to see LOOP options";
    if (activeComponents.size > 0) return "LOOP detected — tap for details";
    if (availableComponents.size > 0) return "LOOP completions available";
    return "No LOOP options for this sequence";
  });
</script>

<button
  class="loop-ring-button"
  class:has-activity={hasAnyActivity}
  {disabled}
  onclick={() => onclick?.()}
  title={tooltip}
  aria-label={tooltip}
>
  <svg
    viewBox="0 0 40 40"
    width="24"
    height="24"
    aria-hidden="true"
  >
    {#each ALL_COMPONENTS as component, i}
      <path
        d={arcPath(i)}
        fill="none"
        stroke={segmentColor(component)}
        stroke-width={RING_STROKE}
        stroke-linecap="round"
        opacity={segmentOpacity(component)}
      />
    {/each}
  </svg>
</button>

<style>
  .loop-ring-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .loop-ring-button.has-activity {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .loop-ring-button:hover:not(:disabled) {
    transform: scale(1.05);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #6366f1);
  }

  .loop-ring-button:active:not(:disabled) {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .loop-ring-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .loop-ring-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .loop-ring-button {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/shared/components/buttons/LOOPRingButton.svelte
git commit -m "feat(loop): create LOOPRingButton component with SVG ring segments"
```

---

## Chunk 3: LOOP Completion Popover

### Task 4: Create LOOPCompletionPopover.svelte

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/shared/components/LOOPCompletionPopover.svelte`

Popover showing 6 labeled LOOP component buttons. Uses the same three visual states as the ring. Clickable faint buttons emit an event with the selected component.

- [ ] **Step 1: Create the component**

```svelte
<!--
  LOOPCompletionPopover.svelte

  Popover content for the LOOP ring button. Shows 6 LOOP components
  as labeled icon buttons with color states matching the ring segments.

  Full color = already active (status only).
  Faint = available for auto-completion (clickable).
  Gray = not possible (disabled).
-->
<script lang="ts">
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { LOOP_COMPONENT_MAP } from "$lib/features/create/generate/shared/domain/constants/loop-constants";
  import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
  import type { LOOPOption } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
  import { container } from "$lib/shared/di";

  interface Props {
    /** Components active in detected LOOP */
    activeComponents: Set<LOOPComponent>;
    /** Available LOOPOptions for completion */
    availableLOOPOptions: LOOPOption[];
    /** Formatted display name of current LOOP type (if active) */
    currentLoopLabel: string | null;
    /** Whether the sequence is circular (even if no named pattern) */
    isCircular: boolean;
    /** Whether the sequence has enough beats for analysis */
    hasSufficientBeats: boolean;
    /** Called when user selects a component for auto-completion */
    onComponentSelect?: (component: LOOPComponent, loopType: import("$lib/features/create/generate/circular/domain/models/circular-models").LOOPType) => void;
  }

  let {
    activeComponents,
    availableLOOPOptions,
    currentLoopLabel,
    isCircular,
    hasSufficientBeats,
    onComponentSelect,
  }: Props = $props();

  const resolver = container.items.loopTypeResolver as ILOOPTypeResolver;

  // All 6 components in canonical display order
  const ALL_COMPONENTS: LOOPComponent[] = [
    LOOPComponent.ROTATED,
    LOOPComponent.MIRRORED,
    LOOPComponent.FLIPPED,
    LOOPComponent.SWAPPED,
    LOOPComponent.INVERTED,
    LOOPComponent.REWOUND,
  ];

  // Decompose available LOOPOptions into per-component availability
  const availableComponents = $derived.by(() => {
    const set = new Set<LOOPComponent>();
    for (const option of availableLOOPOptions) {
      const components = resolver.parseComponents(option.loopType);
      for (const c of components) set.add(c);
    }
    return set;
  });

  function getComponentState(component: LOOPComponent): "active" | "available" | "unavailable" {
    if (activeComponents.has(component)) return "active";
    if (availableComponents.has(component)) return "available";
    return "unavailable";
  }

  /**
   * Find the best matching LOOPType for a tapped component.
   * Prefers the option with fewest total components (simplest extension).
   */
  function findBestLoopType(component: LOOPComponent): LOOPOption | null {
    const matching = availableLOOPOptions.filter((opt) => {
      const components = resolver.parseComponents(opt.loopType);
      return components.has(component);
    });
    if (matching.length === 0) return null;
    // Sort by component count ascending (simplest first)
    matching.sort((a, b) => {
      const aSize = resolver.parseComponents(a.loopType).size;
      const bSize = resolver.parseComponents(b.loopType).size;
      return aSize - bSize;
    });
    return matching[0];
  }

  function handleClick(component: LOOPComponent) {
    const option = findBestLoopType(component);
    if (!option) return;
    onComponentSelect?.(component, option.loopType);
  }
</script>

<div class="popover-content" role="region" aria-label="LOOP completion options">
  {#if !hasSufficientBeats}
    <p class="empty-message">Add more beats to see LOOP options.</p>
  {:else}
    {#if currentLoopLabel}
      <div class="loop-status">
        <i class="fas fa-infinity" aria-hidden="true"></i>
        <span>{currentLoopLabel}</span>
      </div>
    {:else if isCircular}
      <div class="loop-status circular-only">
        <i class="fas fa-circle-notch" aria-hidden="true"></i>
        <span>Circular sequence (no LOOP pattern detected)</span>
      </div>
    {/if}

    <div class="component-grid">
      {#each ALL_COMPONENTS as component}
        {@const info = LOOP_COMPONENT_MAP.get(component)}
        {@const state = getComponentState(component)}
        {#if info}
          <button
            type="button"
            class="component-button"
            class:active={state === "active"}
            class:available={state === "available"}
            class:unavailable={state === "unavailable"}
            disabled={state !== "available"}
            onclick={() => handleClick(component)}
            title={state === "active"
              ? `${info.label} — active`
              : state === "available"
                ? `Apply ${info.label} LOOP`
                : `${info.label} — not available`}
            style:--component-color={info.color}
          >
            <i class="fas fa-{info.icon}" aria-hidden="true"></i>
            <span class="component-label">{info.label}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .popover-content {
    padding: 12px;
    min-width: 200px;
  }

  .empty-message {
    margin: 0;
    padding: 8px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
    text-align: center;
  }

  .loop-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: 12px;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent);
  }

  .component-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .component-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .component-button i {
    font-size: 14px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  .component-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    white-space: nowrap;
  }

  /* Active: full color, non-interactive */
  .component-button.active {
    background: color-mix(in srgb, var(--component-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--component-color) 40%, transparent);
    cursor: default;
  }
  .component-button.active i {
    color: var(--component-color);
  }
  .component-button.active .component-label {
    color: var(--component-color);
  }

  /* Available: faint color, clickable */
  .component-button.available {
    border-color: color-mix(in srgb, var(--component-color) 25%, transparent);
  }
  .component-button.available i {
    color: var(--component-color);
    opacity: 0.5;
  }
  .component-button.available .component-label {
    color: var(--theme-text-dim);
  }
  .component-button.available:hover {
    background: color-mix(in srgb, var(--component-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--component-color) 40%, transparent);
  }
  .component-button.available:hover i {
    opacity: 1;
  }
  .component-button.available:active {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  /* Unavailable: gray, disabled */
  .component-button.unavailable {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .component-button.unavailable i {
    color: var(--theme-text-dim);
  }
  .component-button.unavailable .component-label {
    color: var(--theme-text-dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .component-button {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/shared/components/LOOPCompletionPopover.svelte
git commit -m "feat(loop): create LOOPCompletionPopover with labeled component buttons"
```

---

## Chunk 4: Wire LOOP Ring into Workspace Header

### Task 5: Replace SaveToLibraryButton with LOOPRingButton in SequenceDisplay

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte:11,57-59,134-139`

- [ ] **Step 1: Replace import and add LOOP imports**

In `SequenceDisplay.svelte`, replace the SaveToLibraryButton import (line 11):

```typescript
// Remove:
import SaveToLibraryButton from "../../shared/components/buttons/SaveToLibraryButton.svelte";

// Add:
import LOOPRingButton from "../../shared/components/buttons/LOOPRingButton.svelte";
import LOOPCompletionPopover from "../../shared/components/LOOPCompletionPopover.svelte";
import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { ILOOPTypeResolver } from "$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver";
import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
```

- [ ] **Step 2: Add LOOP state and analysis logic**

After the existing context/state declarations (around line 54), add:

```typescript
// LOOP analysis state
const loopDetector = container.items.loopDetector;
const extensionFlowCoordinator = container.items.extensionFlowCoordinator;
const loopTypeResolver = container.items.loopTypeResolver as ILOOPTypeResolver;

let showLoopPopover = $state(false);
let extensionAnalysis = $state<import("$lib/features/create/shared/services/contracts/ISequenceExtender").ExtensionAnalysis | null>(null);
let analysisRequestId = 0; // Stale-request guard for async analysis

// Reactive LOOP detection — runs as sequence changes
const loopDetectionResult = $derived.by(() => {
  if (!currentSequence || !loopDetector) return null;
  if ((currentSequence.steps?.length ?? 0) < 2) return null;
  return loopDetector.detectLOOPType(currentSequence);
});

const isCircular = $derived(loopDetectionResult?.isCircular ?? false);

const activeComponents = $derived.by(() => {
  if (!loopDetectionResult?.loopType) return new Set<LOOPComponent>();
  return loopTypeResolver.parseComponents(loopDetectionResult.loopType);
});

const currentLoopLabel = $derived.by(() => {
  if (!loopDetectionResult?.loopType) return null;
  return loopTypeResolver.formatForDisplay(loopDetectionResult.loopType);
});

// Available components derived from extension analysis
const availableComponents = $derived.by(() => {
  const set = new Set<LOOPComponent>();
  if (!extensionAnalysis) return set;
  for (const option of extensionAnalysis.availableLOOPOptions) {
    const components = loopTypeResolver.parseComponents(option.loopType);
    for (const c of components) set.add(c);
  }
  return set;
});

const hasSufficientBeats = $derived((currentSequence?.steps?.length ?? 0) >= 2);

// Run extension analysis when sequence changes (with stale-request guard)
$effect(() => {
  if (!currentSequence || !extensionFlowCoordinator || !hasSufficientBeats) {
    extensionAnalysis = null;
    return;
  }
  // Only analyze if not already a complete LOOP
  if (loopDetectionResult?.loopType) {
    extensionAnalysis = null;
    return;
  }
  const requestId = ++analysisRequestId;
  extensionFlowCoordinator.startFlow(currentSequence).then((result) => {
    // Guard: ignore if a newer request has been fired since
    if (requestId !== analysisRequestId) return;
    if (result.canExtend) {
      extensionAnalysis = result.analysis;
    } else {
      extensionAnalysis = null;
    }
  });
});
```

- [ ] **Step 3: Replace save button handler with LOOP popover handler**

Remove the `handleSaveButtonClick` function (lines 57-59). Add:

```typescript
function handleLoopRingClick() {
  showLoopPopover = !showLoopPopover;
}

function handleComponentSelect(component: LOOPComponent, loopType: LOOPType) {
  showLoopPopover = false;
  // Delegate to CreateModule via panelState or event
  panelState.requestLoopCompletion(loopType);
}
```

- [ ] **Step 4: Replace SaveToLibraryButton markup with LOOPRingButton + popover**

Replace the `top-right-zone` content (lines 134-139):

```svelte
<div class="top-right-zone">
  <div class="loop-ring-wrapper">
    <LOOPRingButton
      {activeComponents}
      {availableComponents}
      disabled={!hasSufficientBeats}
      onclick={handleLoopRingClick}
    />
    {#if showLoopPopover}
      <div class="loop-popover">
        <LOOPCompletionPopover
          {activeComponents}
          availableLOOPOptions={extensionAnalysis?.availableLOOPOptions ?? []}
          {currentLoopLabel}
          {isCircular}
          {hasSufficientBeats}
          onComponentSelect={handleComponentSelect}
        />
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 5: Add popover styles**

Add to the `<style>` block:

```css
.loop-ring-wrapper {
  position: relative;
}

.loop-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 100;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 6: Add click-outside to close popover**

Add to the script section:

```typescript
// Close popover on click outside
$effect(() => {
  if (!showLoopPopover) return;
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".loop-ring-wrapper")) {
      showLoopPopover = false;
    }
  }
  document.addEventListener("click", handleClickOutside, true);
  return () => document.removeEventListener("click", handleClickOutside, true);
});
```

- [ ] **Step 7: Run typecheck**

Run: `npm run check`
Expected: May have errors about `panelState.requestLoopCompletion` — this will be wired in Task 7. Note the error and proceed.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte
git commit -m "feat(loop): replace save button with LOOP ring button in workspace header"
```

---

## Chunk 5: Save Button Relocation to Bottom Bar

### Task 6: Move SaveToLibraryButton to ButtonPanel

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte:26-30,135-151`

- [ ] **Step 1: Add import and handler**

In `ButtonPanel.svelte`, add the import (after line 30):

```typescript
import SaveToLibraryButton from "./buttons/SaveToLibraryButton.svelte";
```

Add `onSaveToLibrary` to the props (inside the destructuring around line 52):

```typescript
onSaveToLibrary?: () => void;
```

Add derived state for save button visibility (after line 63):

```typescript
const canSaveToLibrary = $derived(CreateModuleState.canShowActionButtons());
const currentSequence = $derived.by(() => {
  const tabState = CreateModuleState.getActiveTabSequenceState();
  return tabState?.currentSequence ?? null;
});
```

- [ ] **Step 2: Add SaveToLibraryButton to right zone**

In the right-zone (before the ClearSequencePanelButton, around line 146), add:

```svelte
{#if canSaveToLibrary && onSaveToLibrary}
  <div transition:presenceTransition>
    <SaveToLibraryButton
      sequence={currentSequence}
      onclick={onSaveToLibrary}
    />
  </div>
{/if}
```

- [ ] **Step 3: Wire the handler in CreateModule**

In `CreateModule.svelte`, find where `ButtonPanel` is rendered and add the `onSaveToLibrary` prop:

```svelte
<ButtonPanel
  ...existing props...
  onSaveToLibrary={() => panelState.openSaveToLibraryPanel()}
/>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte
git add src/lib/features/create/shared/components/CreateModule.svelte
git commit -m "feat(save): relocate save-to-library button to bottom action bar"
```

---

## Chunk 6: LOOP Completion Wiring

### Task 7: Wire LOOP completion flow in CreateModule

**Files:**
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`

This wires the confirmation dialog and extension logic, reusing the existing `ExtensionFlowCoordinator` pattern from `SequenceActionsPanel.svelte`.

- [ ] **Step 1: Add LOOP completion state**

Near the existing clear-sequence state declarations (around line 117), add:

```typescript
// LOOP completion state
let showLoopConfirm = $state(false);
let pendingLoopType = $state<import("$lib/features/create/generate/circular/domain/models/circular-models").LOOPType | null>(null);
let isApplyingLoop = $state(false);
let pendingLoopBeatCount = $state(0);
let pendingLoopComponentName = $state("");
```

- [ ] **Step 2: Add requestLoopCompletion to panelState**

**File:** `src/lib/features/create/shared/state/panel-coordination-state.svelte.ts`

In the `PanelCoordinationState` interface (around line 114), add after the existing LOOP panel methods (around line 225):

```typescript
/** Request LOOP auto-completion from the ring button */
requestLoopCompletion(loopType: LOOPType): void;
```

Add the `LOOPType` import at the top of the file:

```typescript
import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
```

In the `createPanelCoordinationState()` factory function (around line 310), add a callback holder and the method implementation:

```typescript
let loopCompletionCallback: ((loopType: LOOPType) => void) | null = null;

// Add to the returned object:
requestLoopCompletion(loopType: LOOPType) {
  loopCompletionCallback?.(loopType);
},
setLoopCompletionCallback(cb: (loopType: LOOPType) => void) {
  loopCompletionCallback = cb;
},
```

Then in `CreateModule.svelte`, wire the callback after panelState is available:

```typescript
// Wire LOOP completion callback
panelState.setLoopCompletionCallback(handleLoopCompletionRequest);
```

- [ ] **Step 3: Add LOOP completion handlers**

After the existing `handleClearSequence` / `confirmClearSequence` handlers (around line 491), add:

```typescript
async function handleLoopCompletionRequest(loopType: LOOPType) {
  const extensionFlowCoordinator = container.items.extensionFlowCoordinator;
  const loopTypeResolver = container.items.loopTypeResolver as ILOOPTypeResolver;

  if (!extensionFlowCoordinator) return;

  const activeSeqState = CreateModuleState.getActiveTabSequenceState();
  const sequence = activeSeqState?.currentSequence;
  if (!sequence) return;

  // Determine component name for confirmation dialog
  pendingLoopComponentName = loopTypeResolver.formatForDisplay(loopType);

  // Estimate beat count (need to analyze)
  const result = await extensionFlowCoordinator.startFlow(sequence);
  if (!result.canExtend || !result.analysis) {
    toast.warning("Cannot complete this LOOP");
    return;
  }

  // Calculate expected new beats based on slice size
  const currentLen = sequence.steps?.length ?? 0;
  const extensionType = result.analysis.extensionType;
  if (extensionType === "half_rotation") {
    pendingLoopBeatCount = currentLen; // doubles
  } else if (extensionType === "quarter_rotation") {
    pendingLoopBeatCount = currentLen * 3; // quadruples
  } else {
    pendingLoopBeatCount = currentLen; // default estimate
  }

  pendingLoopType = loopType;

  // Check if user wants to skip confirmation
  if (settingsService?.currentSettings?.skipLoopConfirmation) {
    confirmLoopCompletion();
    return;
  }

  showLoopConfirm = true;
}

async function confirmLoopCompletion() {
  if (!pendingLoopType || isApplyingLoop) return;

  const extensionFlowCoordinator = container.items.extensionFlowCoordinator;
  if (!extensionFlowCoordinator) return;

  const activeSeqState = CreateModuleState.getActiveTabSequenceState();
  const sequence = activeSeqState?.currentSequence;
  if (!sequence) return;

  isApplyingLoop = true;
  showLoopConfirm = false;

  // Push undo snapshot before extension
  CreateModuleState.pushUndoSnapshot(UndoOperationType.EXTEND_SEQUENCE);

  const result = await extensionFlowCoordinator.applyLoop(sequence, pendingLoopType);

  if (result.success && result.sequence) {
    activeSeqState.setCurrentSequence(result.sequence);
    hapticService?.trigger("success");
    toast.success(result.message);
  } else {
    toast.warning(result.message);
    hapticService?.trigger("error");
  }

  isApplyingLoop = false;
  pendingLoopType = null;
}

function cancelLoopCompletion() {
  showLoopConfirm = false;
  pendingLoopType = null;
}

function handleSkipLoopConfirmationChange(checked: boolean) {
  if (checked && settingsService) {
    settingsService.updateSetting("skipLoopConfirmation", true);
  }
}
```

Note: Add necessary imports at the top — `ILOOPTypeResolver` from `$lib/features/create/generate/shared/services/contracts/ILOOPTypeResolver`, `UndoOperationType` (already imported at line 15), `toast` (already imported). Also import `LOOPType` from `$lib/features/create/generate/circular/domain/models/circular-models`.

- [ ] **Step 4: Add ConfirmDialog for LOOP completion**

Near the existing clear-sequence ConfirmDialog (around line 654), add:

```svelte
<!-- LOOP Completion Confirmation -->
<ConfirmDialog
  bind:isOpen={showLoopConfirm}
  title="Apply {pendingLoopComponentName} LOOP?"
  message="This will add {pendingLoopBeatCount} beats to your sequence."
  confirmText="Apply"
  cancelText="Cancel"
  variant="default"
  showDontAskAgain={true}
  onConfirm={confirmLoopCompletion}
  onCancel={cancelLoopCompletion}
  onDontAskAgainChange={handleSkipLoopConfirmationChange}
/>
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS (or minor issues to fix)

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/components/CreateModule.svelte
git commit -m "feat(loop): wire LOOP completion flow with confirmation dialog"
```

---

## Chunk 7: Save Panel Cleanup

### Task 8: Make SaveToLibraryPanel responsive (desktop vs mobile)

**Files:**
- Modify: `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte`

- [ ] **Step 1: Add responsive detection and column state**

After the existing imports (around line 36), add:

```typescript
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
```

After the existing state declarations (around line 112), add:

```typescript
// Responsive layout detection
let panelWidth = $state(0);
const isMobileLayout = $derived(panelWidth < 640);

// Column toggle (mobile only)
let columnCount = $state<number | null>(null);
const allColumnOptions = [
  { label: "Auto", value: null },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
] as const;

const beatCount = $derived(sequence?.steps?.length ?? 0);
const columnOptions = $derived(
  allColumnOptions.filter((opt) => opt.value === null || opt.value <= beatCount)
);

// Prop type indicator
const settings = $derived(getSettings());
const bluePropType = $derived(settings.bluePropType ?? PropType.STAFF);
const redPropType = $derived(settings.redPropType ?? PropType.STAFF);
const isSamePropType = $derived(bluePropType === redPropType);
const propTypeLabel = $derived(
  isSamePropType
    ? formatPropType(bluePropType)
    : `${formatPropType(bluePropType)} / ${formatPropType(redPropType)}`
);

function formatPropType(pt: PropType): string {
  const map: Record<string, string> = {
    [PropType.STAFF]: "Staff",
    [PropType.FAN]: "Fan",
    [PropType.CLUB]: "Club",
    [PropType.BUUGENG]: "Buugeng",
    [PropType.MINIHOOP]: "Mini Hoop",
    [PropType.TRIAD]: "Triad",
    [PropType.DOUBLESTAR]: "Double Star",
    [PropType.BIGDOUBLESTAR]: "Big Double Star",
    [PropType.QUIAD]: "Quiad",
  };
  return map[pt] ?? pt;
}
```

- [ ] **Step 2: Add ResizeObserver for panel width**

Add a bind to the panel-inner div and use `$effect` for measurement:

```typescript
let panelInnerEl: HTMLDivElement | null = null;

$effect(() => {
  if (!panelInnerEl) return;
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      panelWidth = entry.contentRect.width;
    }
  });
  observer.observe(panelInnerEl);
  return () => observer.disconnect();
});
```

Update the panel-inner div: `<div class="panel-inner" bind:this={panelInnerEl}>`

- [ ] **Step 3: Make ChoreoCard preview conditional (mobile only)**

Replace the existing choreo-group section (lines 446-460):

```svelte
{#if sequence}
  {#if isMobileLayout}
    <!-- Mobile: show preview since workspace is hidden -->
    <div class="choreo-group">
      <div class="choreo-preview">
        <ChoreoCard
          sequence={{ ...sequence, word: tkaName }}
          {darkMode}
          userName={creatorName}
          showCreatorName={true}
          showBirthday={true}
          showNotes={false}
          showDifficultyLevel={true}
          showLoopGlyph={true}
          {columnCount}
        />
      </div>

      <!-- Column toggle -->
      <div class="column-toggle">
        <span class="toggle-section-label">Columns</span>
        <div class="chip-group">
          {#each columnOptions as option}
            <button
              type="button"
              class="column-chip"
              class:active={columnCount === option.value}
              onclick={() => (columnCount = option.value)}
              aria-pressed={columnCount === option.value}
            >{option.label}</button>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- Desktop: compact word display (workspace visible behind panel) -->
    <div class="word-display">
      <span class="word-text">{tkaName}</span>
    </div>
  {/if}

  <!-- Prop type indicator -->
  <div class="prop-type-indicator">
    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
    <span>{propTypeLabel}</span>
  </div>
{/if}
```

- [ ] **Step 4: Add styles for new elements**

Add to the `<style>` block:

```css
/* Column toggle (mobile) */
.column-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.toggle-section-label {
  min-width: 60px;
  font-size: var(--font-size-compact, 12px);
  font-weight: 500;
  color: var(--theme-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.chip-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.column-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  min-width: 36px;
  padding: 4px 12px;
  background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
  border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  border-radius: 10px;
  color: var(--theme-text-dim);
  font-size: var(--font-size-compact, 12px);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.column-chip.active {
  background: color-mix(in srgb, var(--theme-accent) 35%, var(--theme-card-bg));
  border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  color: white;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent) 25%, transparent);
}

.column-chip:hover:not(.active) {
  background: var(--theme-card-hover-bg);
  border-color: var(--theme-stroke-strong);
  color: var(--theme-text);
}

/* Desktop: compact word display */
.word-display {
  text-align: center;
  padding: 16px;
}

.word-text {
  font-family: Georgia, serif;
  font-size: var(--font-size-2xl, 1.5rem);
  font-weight: 600;
  color: var(--theme-text);
  letter-spacing: 0.05em;
}

/* Prop type indicator */
.prop-type-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: var(--font-size-sm, 14px);
  color: var(--theme-text-dim);
}

.prop-type-indicator i {
  color: var(--theme-accent);
  font-size: 12px;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/components/SaveToLibraryPanel.svelte
git commit -m "feat(save): make save panel responsive — desktop compact, mobile preview with column toggle"
```

---

## Chunk 8: Integration & Verification

### Task 9: Verify DI container has required services

**Files:**
- Check: `src/lib/shared/di/index.ts` or relevant container files

- [ ] **Step 1: Verify loopDetector and extensionFlowCoordinator are in DI**

Search for `loopDetector` and `extensionFlowCoordinator` in the DI container files. Both should already be registered since they're used by `SequenceActionsPanel.svelte`. If not, add registrations.

Run: `npm run check`

- [ ] **Step 2: Verify panelState has requestLoopCompletion**

Check where `panelState` is defined. It needs the `requestLoopCompletion` method added. This is likely in a state factory file under the create module. Add the method signature and implementation (it should call a callback that CreateModule provides).

- [ ] **Step 3: Full build verification**

Run: `npm run build`
Expected: PASS with no errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve integration issues for LOOP completion and save panel"
```

---

### Task 10: Manual verification checklist

- [ ] **Step 1: Verify LOOP ring button appears in workspace header (top right)**
- [ ] **Step 2: Verify ring segments update as beats are added**
- [ ] **Step 3: Verify popover opens on ring click and closes on outside click**
- [ ] **Step 4: Verify tapping a faint component shows confirmation dialog**
- [ ] **Step 5: Verify "don't ask again" persists to settings**
- [ ] **Step 6: Verify LOOP completion adds beats and ring updates to full color**
- [ ] **Step 7: Verify undo reverses the LOOP completion**
- [ ] **Step 8: Verify save button appears in bottom bar**
- [ ] **Step 9: Verify save button opens the save panel**
- [ ] **Step 10: Verify desktop save panel has no ChoreoCard preview**
- [ ] **Step 11: Verify mobile save panel shows ChoreoCard with column toggle**
- [ ] **Step 12: Verify prop type indicator shows current prop type**
