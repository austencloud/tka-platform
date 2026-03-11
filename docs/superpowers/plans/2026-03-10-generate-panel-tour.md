# Generate Panel Tour Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "tap any card" help mode in the generate panel with a guided step-by-step tour that walks through each card sequentially (like the step editor tour).

**Architecture:** New tour state factory + tour overlay component, modeled after the step editor tour. The existing help mode state machine in GeneratePanel.svelte gets replaced with the tour. The "?" button (desktop + mobile) starts the tour directly. `generator-help-content.ts` is reused for content.

**Tech Stack:** Svelte 5 runes, localStorage persistence, CSS highlight/dim system

---

## Chunk 1: State + Component + Integration

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/onboarding/state/generate-tour-state.svelte.ts` | Tour state machine (stops, advance, skip, complete, restart) |
| Create | `src/lib/shared/onboarding/components/generate-tour/GeneratePanelTour.svelte` | Floating tour card overlay with step dots + navigation |
| Modify | `src/lib/features/create/generate/components/GeneratePanel.svelte` | Replace help mode with tour state; wire "?" button to start tour |
| Modify | `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte` | Replace help mode click-any-card with tour highlight-one-card |
| Delete | `src/lib/features/create/generate/components/help/GeneratorHelpOverlay.svelte` | Old backdrop + banner |
| Delete | `src/lib/features/create/generate/components/help/GeneratorHelpModal.svelte` | Old per-card modal |
| Keep | `src/lib/features/create/generate/domain/generator-help-content.ts` | Reused for tour content |
| Keep | `src/lib/features/create/shared/workspace-panel/shared/components/buttons/GeneratorHelpButton.svelte` | Mobile trigger (unchanged) |

---

### Task 1: Create generate tour state

**Files:**
- Create: `src/lib/shared/onboarding/state/generate-tour-state.svelte.ts`

- [ ] **Step 1: Create the tour state factory**

Follows the exact same pattern as `step-editor-tour-state.svelte.ts`. 7 stops matching the tour cards (skipping Customize and LOOP).

```typescript
/**
 * Generate Panel Tour State
 *
 * Tracks the guided tour through generator settings cards.
 * Triggered when user taps the "?" help button.
 */

const TOUR_COMPLETED_KEY = "tka-generate-tour-completed";

export type GenerateTourStop =
  | "level"
  | "length"
  | "word-input"
  | "grid-mode"
  | "turn-intensity"
  | "slice-size"
  | "generate-button";

const STOPS: GenerateTourStop[] = [
  "level",
  "length",
  "word-input",
  "grid-mode",
  "turn-intensity",
  "slice-size",
  "generate-button",
];

interface GenerateTourData {
  hasCompleted: boolean;
  isActive: boolean;
  currentStopIndex: number;
}

function createGenerateTourState() {
  const isBrowser = typeof window !== "undefined";

  const completed = isBrowser
    ? localStorage.getItem(TOUR_COMPLETED_KEY) === "true"
    : false;

  const data = $state<GenerateTourData>({
    hasCompleted: completed,
    isActive: false,
    currentStopIndex: 0,
  });

  return {
    get hasCompleted() {
      return data.hasCompleted;
    },
    get isActive() {
      return data.isActive;
    },
    get currentStopIndex() {
      return data.currentStopIndex;
    },
    get currentStop(): GenerateTourStop {
      return STOPS[data.currentStopIndex] ?? "generate-button";
    },
    get totalStops() {
      return STOPS.length;
    },
    get isLastStop() {
      return data.currentStopIndex >= STOPS.length - 1;
    },

    /** Start the tour (from help button tap). */
    start() {
      data.isActive = true;
      data.currentStopIndex = 0;
    },

    advance() {
      if (data.currentStopIndex < STOPS.length - 1) {
        data.currentStopIndex++;
      } else {
        this.complete();
      }
    },

    complete() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    },

    skip() {
      if (!isBrowser) return;
      data.isActive = false;
      data.hasCompleted = true;
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    },

    /** Replay the tour (from help button after first completion) */
    restart() {
      data.isActive = true;
      data.currentStopIndex = 0;
    },

    /** Reset for testing/development */
    reset() {
      if (!isBrowser) return;
      data.hasCompleted = false;
      data.isActive = false;
      data.currentStopIndex = 0;
      localStorage.removeItem(TOUR_COMPLETED_KEY);
    },
  };
}

export const generateTourState = createGenerateTourState();
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to generate-tour-state

---

### Task 2: Create GeneratePanelTour component

**Files:**
- Create: `src/lib/shared/onboarding/components/generate-tour/GeneratePanelTour.svelte`

- [ ] **Step 1: Create the tour overlay component**

This is a floating card rendered as a fixed overlay (not inside the panel like the step editor tour). It shows over the backdrop, positioned to not cover the highlighted card. Reuses content from `generator-help-content.ts`.

```svelte
<!--
  GeneratePanelTour - Guided tour overlay for the generate panel.

  Renders as a fixed overlay with a dark backdrop. Highlights one card
  at a time in the generate panel by communicating the active stop
  via tour state. Shows a floating explanation card with step dots.
-->
<script lang="ts">
  import {
    generateTourState,
    type GenerateTourStop,
  } from "../../state/generate-tour-state.svelte";
  import {
    generatorHelpContent,
    type GeneratorHelpItem,
  } from "$lib/features/create/generate/domain/generator-help-content";
  import type { GeneratorHelpId } from "$lib/features/create/generate/domain/generator-help-content";

  // Map tour stops to help content IDs
  const stopToHelpId: Record<GenerateTourStop, GeneratorHelpId> = {
    "level": "level",
    "length": "length",
    "word-input": "generation-mode",
    "grid-mode": "grid-mode",
    "turn-intensity": "turn-intensity",
    "slice-size": "slice-size",
    "generate-button": "generate",
  };

  const currentHelpContent: GeneratorHelpItem | undefined = $derived(
    generatorHelpContent.find(
      (c) => c.id === stopToHelpId[generateTourState.currentStop]
    )
  );

  function handleNext() {
    generateTourState.advance();
  }

  function handleSkip() {
    generateTourState.skip();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleSkip();
    }
  }
</script>

{#if generateTourState.isActive}
  <svelte:window onkeydowncapture={handleKeydown} />

  <!-- Backdrop - click to skip -->
  <button
    class="tour-backdrop"
    onclick={handleSkip}
    aria-label="Skip tour"
    tabindex="-1"
  ></button>

  <!-- Floating tour card -->
  <div
    class="tour-card"
    role="dialog"
    aria-label="Generator settings tour"
  >
    {#if currentHelpContent}
      <div class="tour-icon" style:--icon-color={currentHelpContent.color}>
        <i class="fas {currentHelpContent.icon}" aria-hidden="true"></i>
      </div>

      <h3 class="tour-title">{currentHelpContent.name}</h3>
      <p class="tour-desc">{currentHelpContent.fullDesc}</p>

      {#if currentHelpContent.tip}
        <p class="tour-tip">
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
          {currentHelpContent.tip}
        </p>
      {/if}
    {/if}

    <!-- Step dots -->
    <div class="tour-dots" aria-label="Step {generateTourState.currentStopIndex + 1} of {generateTourState.totalStops}">
      {#each Array(generateTourState.totalStops) as _, i}
        <div
          class="dot"
          class:active={i === generateTourState.currentStopIndex}
          class:completed={i < generateTourState.currentStopIndex}
        ></div>
      {/each}
    </div>

    <!-- Actions -->
    <div class="tour-actions">
      <button class="skip-btn" onclick={handleSkip}>Skip</button>
      <button class="next-btn" onclick={handleNext}>
        {generateTourState.isLastStop ? "Got it" : "Next"}
        {#if !generateTourState.isLastStop}
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        {/if}
      </button>
    </div>
  </div>
{/if}

<style>
  .tour-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 200;
    border: none;
    cursor: pointer;
    padding: 0;
    animation: fadeIn var(--duration-normal, 200ms) ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .tour-card {
    position: fixed;
    bottom: max(env(safe-area-inset-bottom, 0px), 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 250;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 360px;
    width: calc(100% - 32px);
    padding: 20px 24px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .tour-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--icon-color, #3b82f6) 25%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color, #3b82f6) 40%, transparent);
    color: var(--icon-color, #3b82f6);
    font-size: 1.1rem;
  }

  .tour-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
  }

  .tour-desc {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.5;
  }

  .tour-tip {
    margin: 0;
    font-size: 0.8rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    text-align: left;
    padding: 8px 10px;
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.15);
    border-radius: 8px;
  }

  .tour-tip i {
    color: #4ade80;
    flex-shrink: 0;
    margin-top: 1px;
    font-size: 0.75rem;
  }

  .tour-dots {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
  }

  .dot.active {
    background: var(--semantic-info, #3b82f6);
    transform: scale(1.2);
  }

  .dot.completed {
    background: rgba(255, 255, 255, 0.4);
  }

  .tour-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    width: 100%;
    justify-content: center;
  }

  .skip-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .skip-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.25);
    color: white;
  }

  .next-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-info, #3b82f6) 55%, transparent);
    border-radius: 8px;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .next-btn:hover {
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 50%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--semantic-info, #3b82f6) 25%, transparent);
  }

  .next-btn:active {
    transform: scale(0.97);
  }

  .next-btn i {
    font-size: 0.75rem;
  }

  /* Desktop: position card in center instead of bottom */
  @media (min-width: 1024px) {
    .tour-card {
      bottom: auto;
      top: 50%;
      transform: translateX(-50%) translateY(-50%);
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(calc(-50% + 20px));
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(-50%);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tour-backdrop {
      animation: none;
    }
    .tour-card {
      animation: none;
    }
    .dot {
      transition: none;
    }
    .skip-btn,
    .next-btn {
      transition: none;
    }
    .next-btn:active {
      transform: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to GeneratePanelTour

---

### Task 3: Wire tour into GeneratePanel (replace help mode)

**Files:**
- Modify: `src/lib/features/create/generate/components/GeneratePanel.svelte`

- [ ] **Step 1: Replace help mode imports and state**

Remove these imports:
- `GeneratorHelpOverlay`
- `GeneratorHelpModal`
- `type GeneratorHelpId` (from the import used by help state — keep it for voice ref)

Add import:
- `import { generateTourState } from "$lib/shared/onboarding/state/generate-tour-state.svelte";`
- `import GeneratePanelTour from "$lib/shared/onboarding/components/generate-tour/GeneratePanelTour.svelte";`

Remove these state variables:
- `helpMode` ($state)
- `isExiting` ($state)
- `selectedControl` ($state)

Remove these functions:
- `enterHelpMode()`
- `selectControlHelp()`
- `closeHelpModal()`
- `exitHelpMode()`
- `handlePanelClick()`
- `handlePanelKeydown()`

Remove the `$effect` that toggles `generator-help-mode-active` body class.

Remove the `$effect` that listens to `panelState?.shouldEnterGeneratorHelpMode`.

Replace the desktop "?" button `onclick` to call `generateTourState.start()` (or `generateTourState.restart()` if already completed).

Replace the mobile trigger effect to call `generateTourState.start()`.

Update the voice ref's `openHelpForControl` to be a no-op or start the tour.

- [ ] **Step 2: Update template**

Replace:
```svelte
<!-- Help mode overlays -->
{#if helpMode !== "inactive" || isExiting}
  <GeneratorHelpOverlay onClose={exitHelpMode} {isExiting} />
{/if}
{#if helpMode === "viewing" && selectedControl}
  <GeneratorHelpModal controlId={selectedControl} onClose={closeHelpModal} />
{/if}
```

With:
```svelte
<!-- Tour overlay -->
<GeneratePanelTour />
```

Remove `class:help-active`, `onclick={handlePanelClick}`, `onkeydown={handlePanelKeydown}` from the panel div.

Update `CardBasedSettingsContainer` props: replace `helpMode`, `helpModeExiting`, `onHelpSelect` with `tourActiveStop` prop.

- [ ] **Step 3: Simplify the "?" button handler**

```typescript
function handleHelpClick(event?: MouseEvent) {
  event?.stopPropagation();
  hapticService?.trigger("selection");
  generateTourState.start();
}
```

Wire mobile trigger:
```typescript
$effect(() => {
  if (panelState?.shouldEnterGeneratorHelpMode) {
    generateTourState.start();
    panelState.clearGeneratorHelpModeTrigger();
  }
});
```

---

### Task 4: Update CardBasedSettingsContainer for tour highlighting

**Files:**
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`

- [ ] **Step 1: Replace help mode props with tour stop prop**

Remove props:
- `helpMode`
- `helpModeExiting`
- `onHelpSelect`

Add prop:
- `tourActiveStop?: string | null` — the card ID currently highlighted by the tour, or null

Remove:
- `cardIdToHelpId` mapping
- `handleCardClick()` function
- `hasHelp()` function

- [ ] **Step 2: Update template**

Replace `class:help-mode={helpMode}` with `class:tour-active={!!tourActiveStop}`.
Remove `class:help-mode-exiting={helpModeExiting}`.

For each `.card-wrapper`, replace:
```svelte
class:help-clickable={helpMode && hasHelp(card.id)}
onclick={(e) => handleCardClick(card.id, e)}
role={helpMode && hasHelp(card.id) ? "button" : undefined}
```

With:
```svelte
class:tour-highlight={tourActiveStop === card.id}
class:tour-dim={!!tourActiveStop && tourActiveStop !== card.id}
```

- [ ] **Step 3: Update CSS**

Replace the help mode CSS with tour-specific styles:

```css
/* Tour highlighting */
.card-wrapper.tour-dim {
  opacity: 0.2;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.card-wrapper.tour-highlight {
  position: relative;
  z-index: 210; /* Above backdrop */
  pointer-events: none; /* Don't let user interact during tour */
}

/* Glow border on highlighted card */
.card-wrapper.tour-highlight::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 14px;
  border: 2px solid rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
  pointer-events: none;
  animation: tour-card-glow 1.5s ease-in-out infinite;
}

@keyframes tour-card-glow {
  0%, 100% {
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
  }
  50% {
    border-color: rgba(59, 130, 246, 0.8);
    box-shadow: 0 0 16px rgba(59, 130, 246, 0.4);
  }
}

/* Ensure container allows highlighted card to be above backdrop */
.card-settings-container.tour-active {
  position: relative;
  z-index: 210;
}

@media (prefers-reduced-motion: reduce) {
  .card-wrapper.tour-dim {
    transition: none;
  }
  .card-wrapper.tour-highlight::after {
    animation: none;
    border-color: rgba(59, 130, 246, 0.6);
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
  }
}
```

Remove: old `.help-mode`, `.help-clickable`, `.help-mode-exiting`, and `help-card-pulse` keyframes.

---

### Task 5: Delete old help components

**Files:**
- Delete: `src/lib/features/create/generate/components/help/GeneratorHelpOverlay.svelte`
- Delete: `src/lib/features/create/generate/components/help/GeneratorHelpModal.svelte`

- [ ] **Step 1: Delete old files**

```bash
rm src/lib/features/create/generate/components/help/GeneratorHelpOverlay.svelte
rm src/lib/features/create/generate/components/help/GeneratorHelpModal.svelte
```

- [ ] **Step 2: Check if help/ directory is now empty; if so, remove it**

```bash
ls src/lib/features/create/generate/components/help/
# If empty:
rmdir src/lib/features/create/generate/components/help/
```

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds with no missing import errors

---

### Task 6: Remove body class z-index hack

**Files:**
- Modify: `src/lib/features/create/generate/components/GeneratePanel.svelte`

- [ ] **Step 1: Remove the body class CSS rule**

The old help mode used `body.generator-help-mode-active` to boost the panel's z-index above a fixed backdrop. The tour component renders its own fixed backdrop + card at z-index 200/250, and the highlighted card gets z-index 210 via the `.tour-highlight` class. No body class needed.

Remove this CSS from GeneratePanel.svelte:
```css
:global(body.generator-help-mode-active) .generate-panel {
  z-index: 210;
}
```

Remove the `class:help-active` from the panel div if not already done in Task 3.

---

### Task 7: Build verification

- [ ] **Step 1: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/onboarding/state/generate-tour-state.svelte.ts \
  src/lib/shared/onboarding/components/generate-tour/GeneratePanelTour.svelte \
  src/lib/features/create/generate/components/GeneratePanel.svelte \
  src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte
git add -u src/lib/features/create/generate/components/help/
git commit -m "feat(generate): replace help mode with guided tour

Replace the 'tap any card' help mode with a sequential tour that walks
through each generator card step by step. Modeled after the step editor
tour: floating card, step dots, highlight/dim, Skip/Next buttons.

Tour covers: Level, Length, Word Input, Grid Mode, Turn Intensity,
Slice Size, and Generate Button. Customize and LOOP are skipped
(they have their own panels).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
