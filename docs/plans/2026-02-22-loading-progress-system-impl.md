# Loading Progress System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Progress Lab for visual comparison of loading indicator variants, then create shared loading primitives and roll them out across the app.

**Architecture:** Six shared loading primitives in `src/lib/shared/components/loading/`. A Progress Lab tab in the Lab module with 5 interactive demo sections. After user picks favorites per context, replace all 12+ copy-pasted spinners with the chosen components.

**Tech Stack:** Svelte 5 (runes), CSS custom properties (`--theme-*`, `--duration-*`), SVG for circular progress, `prefers-reduced-motion` compliance throughout.

**Design doc:** `docs/plans/2026-02-22-loading-progress-system-design.md`

---

## Task 1: Create IndeterminateBar primitive

**Files:**
- Create: `src/lib/shared/components/loading/IndeterminateBar.svelte`

**Step 1: Create the component**

```svelte
<!--
  IndeterminateBar.svelte

  A thin animated bar that slides back and forth, indicating an ongoing
  operation with unknown duration. Inspired by YouTube/GitHub loading bars.

  position="top" renders as a fixed bar at the top of the nearest positioned parent.
  position="inline" renders as an inline block element.
-->
<script lang="ts">
  interface Props {
    /** Bar color. Defaults to theme accent. */
    color?: string;
    /** Bar height in pixels. */
    height?: number;
    /** "top" pins to top of nearest positioned parent. "inline" flows in document. */
    position?: "top" | "inline";
  }

  let { color, height = 3, position = "inline" }: Props = $props();
</script>

<div
  class="indeterminate-bar"
  class:is-top={position === "top"}
  style:height="{height}px"
  style:--bar-color={color}
  role="status"
  aria-label="Loading"
>
  <div class="bar-track">
    <div class="bar-fill"></div>
  </div>
</div>

<style>
  .indeterminate-bar {
    width: 100%;
    overflow: hidden;
    border-radius: 2px;
  }

  .indeterminate-bar.is-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    border-radius: 0;
  }

  .bar-track {
    width: 100%;
    height: 100%;
    background: var(--bar-color, var(--theme-accent, #8b5cf6));
    opacity: 0.15;
    position: relative;
  }

  .bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 40%;
    background: var(--bar-color, var(--theme-accent, #8b5cf6));
    border-radius: inherit;
    animation: indeterminate-slide 1.4s var(--ease-in-out, cubic-bezier(0.4, 0, 0.2, 1)) infinite;
  }

  @keyframes indeterminate-slide {
    0% {
      left: -40%;
    }
    100% {
      left: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-fill {
      animation: none;
      left: 0;
      width: 100%;
      opacity: 0.6;
    }
  }
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/components/loading/IndeterminateBar.svelte`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/shared/components/loading/IndeterminateBar.svelte
git commit -m "feat(loading): add IndeterminateBar primitive"
```

---

## Task 2: Create ProgressBar primitive

**Files:**
- Create: `src/lib/shared/components/loading/ProgressBar.svelte`

**Step 1: Create the component**

```svelte
<!--
  ProgressBar.svelte

  A deterministic progress bar that fills from 0-100%.
  Shows optional percentage label and/or custom label text.
-->
<script lang="ts">
  interface Props {
    /** Progress percentage (0-100). */
    percent: number;
    /** Optional text label displayed beside the bar (e.g. "3 / 8"). */
    label?: string;
    /** Show numeric percentage. */
    showPercent?: boolean;
    /** Bar color. Defaults to theme accent. */
    color?: string;
    /** Bar height in pixels. */
    height?: number;
  }

  let {
    percent,
    label,
    showPercent = false,
    color,
    height = 6,
  }: Props = $props();

  const clampedPercent = $derived(Math.max(0, Math.min(100, percent)));
</script>

<div class="progress-bar-wrapper" role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? `${Math.round(clampedPercent)}% complete`}>
  <div class="progress-track" style:height="{height}px">
    <div class="progress-fill" style:width="{clampedPercent}%" style:--fill-color={color}>
      {#if clampedPercent > 0 && clampedPercent < 100}
        <div class="progress-shimmer"></div>
      {/if}
    </div>
  </div>
  {#if showPercent || label}
    <div class="progress-label">
      {#if label}
        <span class="label-text">{label}</span>
      {/if}
      {#if showPercent}
        <span class="label-percent">{Math.round(clampedPercent)}%</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .progress-bar-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-track {
    width: 100%;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--fill-color, var(--theme-accent, #8b5cf6));
    border-radius: 999px;
    transition: width var(--duration-fast, 150ms) var(--ease-out, ease-out);
    position: relative;
    overflow: hidden;
    min-width: 2px;
  }

  .progress-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.25) 50%,
      transparent 100%
    );
    animation: bar-shimmer 1.5s infinite;
  }

  @keyframes bar-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-variant-numeric: tabular-nums;
  }

  .label-percent {
    font-weight: 600;
    color: var(--fill-color, var(--theme-accent, #8b5cf6));
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-shimmer {
      animation: none;
      opacity: 0;
    }

    .progress-fill {
      transition: none;
    }
  }
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/components/loading/ProgressBar.svelte`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/shared/components/loading/ProgressBar.svelte
git commit -m "feat(loading): add ProgressBar primitive"
```

---

## Task 3: Create ProgressRing primitive

**Files:**
- Create: `src/lib/shared/components/loading/ProgressRing.svelte`

**Step 1: Create the component**

```svelte
<!--
  ProgressRing.svelte

  Circular SVG progress indicator. Works for both determinate (0-100%)
  and indeterminate (set percent to -1) modes.
-->
<script lang="ts">
  interface Props {
    /** Progress percentage (0-100). Pass -1 for indeterminate spinning. */
    percent: number;
    /** Diameter in pixels. */
    size?: number;
    /** Ring stroke width in pixels. */
    strokeWidth?: number;
    /** Ring color. Defaults to theme accent. */
    color?: string;
    /** Optional center label (e.g. "75%"). */
    label?: string;
  }

  let {
    percent,
    size = 48,
    strokeWidth = 4,
    color,
    label,
  }: Props = $props();

  const radius = $derived((size - strokeWidth) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const clampedPercent = $derived(percent < 0 ? 25 : Math.max(0, Math.min(100, percent)));
  const dashOffset = $derived(circumference - (clampedPercent / 100) * circumference);
  const isIndeterminate = $derived(percent < 0);
</script>

<div
  class="progress-ring"
  class:is-indeterminate={isIndeterminate}
  style:width="{size}px"
  style:height="{size}px"
  role="progressbar"
  aria-valuenow={isIndeterminate ? undefined : clampedPercent}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={label ?? (isIndeterminate ? "Loading" : `${Math.round(clampedPercent)}% complete`)}
>
  <svg viewBox="0 0 {size} {size}" class="ring-svg">
    <!-- Track -->
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="rgba(255, 255, 255, 0.08)"
      stroke-width={strokeWidth}
    />
    <!-- Fill -->
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke={color ?? "var(--theme-accent, #8b5cf6)"}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={dashOffset}
      class="ring-fill"
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  {#if label}
    <span class="ring-label" style:font-size="{Math.max(10, size * 0.22)}px">{label}</span>
  {/if}
</div>

<style>
  .progress-ring {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ring-svg {
    width: 100%;
    height: 100%;
  }

  .ring-fill {
    transition: stroke-dashoffset var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .is-indeterminate .ring-svg {
    animation: ring-spin 1.2s linear infinite;
  }

  @keyframes ring-spin {
    to { transform: rotate(360deg); }
  }

  .ring-label {
    position: absolute;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text, #fff);
  }

  @media (prefers-reduced-motion: reduce) {
    .is-indeterminate .ring-svg {
      animation: none;
    }

    .ring-fill {
      transition: none;
    }

    .is-indeterminate .ring-fill {
      stroke-dashoffset: 0 !important;
      opacity: 0.6;
    }
  }
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/components/loading/ProgressRing.svelte`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/shared/components/loading/ProgressRing.svelte
git commit -m "feat(loading): add ProgressRing primitive"
```

---

## Task 4: Create ShimmerBlock primitive

**Files:**
- Create: `src/lib/shared/components/loading/ShimmerBlock.svelte`

**Step 1: Create the component**

Uses the inbox skeleton shimmer pattern (the gold standard in this codebase). Three-stop gradient with `var(--theme-card-bg)` and `var(--theme-card-hover-bg)`.

```svelte
<!--
  ShimmerBlock.svelte

  A placeholder rectangle with shimmer animation.
  Compose multiple ShimmerBlocks to build skeleton screens.
-->
<script lang="ts">
  interface Props {
    /** Width. CSS value (e.g. "100%", "200px"). */
    width?: string;
    /** Height. CSS value (e.g. "16px", "2rem"). */
    height?: string;
    /** Border radius. CSS value. */
    borderRadius?: string;
    /** Animation delay in ms for staggered groups. */
    delay?: number;
    /** Whether this is a circle (sets border-radius: 50%). */
    circle?: boolean;
  }

  let {
    width = "100%",
    height = "16px",
    borderRadius = "4px",
    delay = 0,
    circle = false,
  }: Props = $props();
</script>

<div
  class="shimmer-block"
  style:width={circle ? height : width}
  style:height
  style:border-radius={circle ? "50%" : borderRadius}
  style:animation-delay="{delay}ms"
  aria-hidden="true"
></div>

<style>
  .shimmer-block {
    background: linear-gradient(
      90deg,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 25%,
      var(--theme-card-hover-bg, var(--theme-stroke, rgba(255, 255, 255, 0.1))) 50%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 75%
    );
    background-size: 200% 100%;
    animation: shimmer-sweep 1.5s infinite;
    flex-shrink: 0;
  }

  @keyframes shimmer-sweep {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer-block {
      animation: none;
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
      border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/components/loading/ShimmerBlock.svelte`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/shared/components/loading/ShimmerBlock.svelte
git commit -m "feat(loading): add ShimmerBlock primitive"
```

---

## Task 5: Create StepProgress primitive

**Files:**
- Create: `src/lib/shared/components/loading/StepProgress.svelte`

**Step 1: Create the component**

Modeled after `SaveProgressOverlay`'s step indicators, but as a standalone reusable component.

```svelte
<!--
  StepProgress.svelte

  Multi-step progress indicator showing pending/active/completed states.
  Each step renders as a dot/ring with an optional label.
-->
<script lang="ts">
  interface StepDef {
    label: string;
    icon?: string;
  }

  interface Props {
    /** Step definitions. */
    steps: StepDef[];
    /** Current active step (1-based). 0 = none started. steps.length + 1 = all complete. */
    currentStep: number;
    /** Layout direction. */
    orientation?: "horizontal" | "vertical";
    /** Accent color for active step. */
    color?: string;
  }

  let {
    steps,
    currentStep,
    orientation = "vertical",
    color,
  }: Props = $props();
</script>

<div
  class="step-progress"
  class:is-horizontal={orientation === "horizontal"}
  role="status"
  aria-label="Step {Math.min(currentStep, steps.length)} of {steps.length}"
>
  {#each steps as step, i}
    {@const status = currentStep > i + 1 ? "completed" : currentStep === i + 1 ? "active" : "pending"}
    <div class="step" class:completed={status === "completed"} class:active={status === "active"} class:pending={status === "pending"}>
      <div class="step-dot" style:--step-color={color}>
        {#if status === "completed"}
          <i class="fas fa-check" aria-hidden="true"></i>
        {:else if status === "active"}
          <div class="step-pulse"></div>
        {:else}
          <span class="step-number">{i + 1}</span>
        {/if}
      </div>
      <span class="step-label">{step.label}</span>
    </div>
    {#if i < steps.length - 1}
      <div class="step-connector" class:filled={currentStep > i + 1}></div>
    {/if}
  {/each}
</div>

<style>
  .step-progress {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
  }

  .step-progress.is-horizontal {
    flex-direction: row;
    align-items: center;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 6px;
    transition: background var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .step-progress.is-horizontal .step {
    flex-direction: column;
    gap: 6px;
    padding: 6px;
  }

  .step.completed { background: rgba(34, 197, 94, 0.08); }
  .step.active { background: rgba(139, 92, 246, 0.1); }
  .step.pending { opacity: 0.4; }

  .step-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .step.completed .step-dot {
    background: var(--semantic-success, #22c55e);
    color: white;
  }

  .step.active .step-dot {
    background: var(--step-color, var(--theme-accent, #8b5cf6));
    color: white;
  }

  .step.pending .step-dot {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .step-pulse {
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    animation: dot-pulse 1s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.5; }
  }

  .step-number {
    font-size: var(--font-size-compact, 12px);
  }

  .step-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .step.completed .step-label { color: var(--semantic-success, #22c55e); }
  .step.active .step-label { color: var(--theme-text, #fff); font-weight: 500; }

  .step-connector {
    width: 2px;
    height: 12px;
    margin-left: 21px;
    background: rgba(255, 255, 255, 0.1);
    transition: background var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .step-connector.filled {
    background: var(--semantic-success, #22c55e);
  }

  .step-progress.is-horizontal .step-connector {
    width: 24px;
    height: 2px;
    margin-left: 0;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-pulse { animation: none; }
    .step-dot, .step-connector, .step { transition: none; }
  }
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/components/loading/StepProgress.svelte`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/shared/components/loading/StepProgress.svelte
git commit -m "feat(loading): add StepProgress primitive"
```

---

## Task 6: Create LoadingGate primitive

**Files:**
- Create: `src/lib/shared/components/loading/LoadingGate.svelte`

**Step 1: Create the component**

Full-page loading wrapper with three visual variants. Replaces the 5 route-level copy-pasted spinners.

```svelte
<!--
  LoadingGate.svelte

  Full-page loading screen shown while a route or major resource loads.
  Three variants for visual comparison in the Progress Lab.
-->
<script lang="ts">
  import IndeterminateBar from "./IndeterminateBar.svelte";
  import ProgressRing from "./ProgressRing.svelte";
  import ShimmerBlock from "./ShimmerBlock.svelte";

  interface Props {
    /** Visual variant. */
    variant?: "bar" | "card" | "skeleton";
    /** Status message (e.g. "Loading sequence..."). */
    message?: string;
    /** Accent color override. */
    color?: string;
  }

  let {
    variant = "bar",
    message = "Loading...",
    color,
  }: Props = $props();
</script>

<div class="loading-gate">
  {#if variant === "bar"}
    <IndeterminateBar position="top" height={3} {color} />
    <div class="gate-center">
      <span class="gate-message">{message}</span>
    </div>

  {:else if variant === "card"}
    <div class="gate-center">
      <div class="gate-card">
        <ProgressRing percent={-1} size={56} strokeWidth={4} {color} />
        <span class="gate-message">{message}</span>
      </div>
    </div>

  {:else if variant === "skeleton"}
    <div class="gate-skeleton">
      <div class="skeleton-header">
        <ShimmerBlock height="32px" width="60%" borderRadius="6px" />
        <ShimmerBlock height="16px" width="40%" borderRadius="4px" delay={100} />
      </div>
      <div class="skeleton-body">
        <ShimmerBlock height="200px" borderRadius="8px" delay={200} />
        <div class="skeleton-row">
          <ShimmerBlock height="80px" width="48%" borderRadius="8px" delay={300} />
          <ShimmerBlock height="80px" width="48%" borderRadius="8px" delay={350} />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .loading-gate {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 50;
  }

  .gate-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gate-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
  }

  .gate-message {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .gate-skeleton {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 32px;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  .skeleton-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .skeleton-row {
    display: flex;
    gap: 16px;
  }
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/components/loading/LoadingGate.svelte`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/shared/components/loading/LoadingGate.svelte
git commit -m "feat(loading): add LoadingGate primitive"
```

---

## Task 7: Create the Progress Lab module

**Files:**
- Create: `src/lib/features/progress-lab/ProgressLabModule.svelte`
- Modify: `src/lib/features/lab/LabModule.svelte` (add tab loader, line 45)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (add tab def, line ~755)

### Step 1: Create ProgressLabModule

This is the main lab component. It has 5 demo sections, each with variant toggles and a play button to trigger simulated loading. The file will be substantial (~400-500 lines) because each section has its own simulation state and renders all variant options.

```svelte
<!--
  ProgressLabModule.svelte

  Interactive lab for comparing loading indicator styles across 5 contexts.
  Each section simulates a loading operation and lets you toggle between variants.
-->
<script lang="ts">
  import IndeterminateBar from "$lib/shared/components/loading/IndeterminateBar.svelte";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import ShimmerBlock from "$lib/shared/components/loading/ShimmerBlock.svelte";
  import StepProgress from "$lib/shared/components/loading/StepProgress.svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  // -- Global controls --
  let speed = $state(1);
  let reducedMotion = $state(false);

  // -- Section 1: Full-page gate --
  type GateVariant = "bar" | "card" | "skeleton";
  let gateVariant = $state<GateVariant>("bar");
  let gateActive = $state(false);

  function playGate() {
    gateActive = true;
    setTimeout(() => { gateActive = false; }, 3000 / speed);
  }

  // -- Section 2: Panel loading --
  type PanelVariant = "skeleton" | "bar" | "dots";
  let panelVariant = $state<PanelVariant>("skeleton");
  let panelActive = $state(false);

  function playPanel() {
    panelActive = true;
    setTimeout(() => { panelActive = false; }, 3000 / speed);
  }

  // -- Section 3: Deterministic progress --
  type DeterminateVariant = "bar" | "ring" | "steps";
  let determinateVariant = $state<DeterminateVariant>("bar");
  let determinatePercent = $state(0);
  let determinateActive = $state(false);
  let determinateInterval: ReturnType<typeof setInterval> | null = null;
  let determinateStep = $state(0);

  const demoSteps = [
    { label: "Rendering thumbnail" },
    { label: "Uploading image" },
    { label: "Tagging sequence" },
    { label: "Saving metadata" },
  ];

  function playDeterminate() {
    determinateActive = true;
    determinatePercent = 0;
    determinateStep = 1;
    if (determinateInterval) clearInterval(determinateInterval);
    determinateInterval = setInterval(() => {
      determinatePercent += 2;
      determinateStep = Math.min(Math.ceil(determinatePercent / 25) , demoSteps.length);
      if (determinatePercent >= 100) {
        determinateActive = false;
        determinateStep = demoSteps.length + 1;
        if (determinateInterval) clearInterval(determinateInterval);
      }
    }, 60 / speed);
  }

  // -- Section 4: Grid cells --
  type GridVariant = "shimmer" | "fade" | "ring";
  let gridVariant = $state<GridVariant>("shimmer");
  let gridCells = $state<boolean[]>(Array(8).fill(false));
  let gridActive = $state(false);

  function playGrid() {
    gridActive = true;
    gridCells = Array(8).fill(false);
    let idx = 0;
    const timer = setInterval(() => {
      if (idx >= 8) {
        clearInterval(timer);
        gridActive = false;
        return;
      }
      gridCells[idx] = true;
      gridCells = [...gridCells]; // trigger reactivity
      idx++;
    }, 400 / speed);
  }

  // -- Section 5: Button actions --
  type ButtonVariant = "spinner" | "morph" | "fill";
  let buttonVariant = $state<ButtonVariant>("spinner");
  let buttonActive = $state(false);
  let buttonPercent = $state(0);
  let buttonInterval: ReturnType<typeof setInterval> | null = null;

  function playButton() {
    buttonActive = true;
    buttonPercent = 0;
    if (buttonInterval) clearInterval(buttonInterval);
    buttonInterval = setInterval(() => {
      buttonPercent += 4;
      if (buttonPercent >= 100) {
        buttonActive = false;
        if (buttonInterval) clearInterval(buttonInterval);
      }
    }, 80 / speed);
  }
</script>

<div class="progress-lab" class:reduced-motion={reducedMotion}>
  <!-- Global controls bar -->
  <div class="lab-controls">
    <div class="control-group">
      <span class="control-label">Speed</span>
      <div class="speed-buttons">
        <button class:active={speed === 0.5} onclick={() => speed = 0.5}>0.5x</button>
        <button class:active={speed === 1} onclick={() => speed = 1}>1x</button>
        <button class:active={speed === 2} onclick={() => speed = 2}>2x</button>
      </div>
    </div>
    <div class="control-group">
      <label class="control-label">
        <input type="checkbox" bind:checked={reducedMotion} />
        Reduced motion
      </label>
    </div>
  </div>

  <!-- Section 1: Full-page Gate -->
  <section class="demo-section">
    <div class="section-header">
      <h3>Full-Page Gate</h3>
      <p>Route loading screens (/p/[code], /sequence/[id], domain detection)</p>
    </div>
    <div class="variant-selector">
      <button class:active={gateVariant === "bar"} onclick={() => gateVariant = "bar"}>A: Top Bar</button>
      <button class:active={gateVariant === "card"} onclick={() => gateVariant = "card"}>B: Card + Ring</button>
      <button class:active={gateVariant === "skeleton"} onclick={() => gateVariant = "skeleton"}>C: Skeleton</button>
      <button class="play-btn" onclick={playGate} disabled={gateActive}>
        <i class="fas fa-play" aria-hidden="true"></i> Play
      </button>
    </div>
    <div class="demo-viewport full-page-viewport">
      {#if gateActive}
        <LoadingGate variant={gateVariant} message="Loading sequence..." />
      {:else}
        <div class="demo-placeholder">
          <span>Content loaded</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Section 2: Panel Loading -->
  <section class="demo-section">
    <div class="section-header">
      <h3>Panel Loading</h3>
      <p>Browse, collections, challenges panel content</p>
    </div>
    <div class="variant-selector">
      <button class:active={panelVariant === "skeleton"} onclick={() => panelVariant = "skeleton"}>A: Skeleton</button>
      <button class:active={panelVariant === "bar"} onclick={() => panelVariant = "bar"}>B: Bar + Text</button>
      <button class:active={panelVariant === "dots"} onclick={() => panelVariant = "dots"}>C: Pulse Dots</button>
      <button class="play-btn" onclick={playPanel} disabled={panelActive}>
        <i class="fas fa-play" aria-hidden="true"></i> Play
      </button>
    </div>
    <div class="demo-viewport panel-viewport">
      {#if panelActive}
        <div class="panel-demo">
          {#if panelVariant === "skeleton"}
            <div class="panel-skeleton-grid">
              {#each Array(4) as _, i}
                <div class="panel-skeleton-item">
                  <ShimmerBlock circle height="40px" delay={i * 80} />
                  <div class="panel-skeleton-text">
                    <ShimmerBlock height="14px" width="70%" delay={i * 80 + 40} />
                    <ShimmerBlock height="10px" width="45%" delay={i * 80 + 80} />
                  </div>
                </div>
              {/each}
            </div>
          {:else if panelVariant === "bar"}
            <div class="panel-bar-demo">
              <IndeterminateBar height={3} />
              <span class="panel-status-text">Loading creators...</span>
            </div>
          {:else if panelVariant === "dots"}
            <div class="panel-dots-demo">
              <div class="pulse-dots">
                <span class="dot" style:animation-delay="0ms"></span>
                <span class="dot" style:animation-delay="150ms"></span>
                <span class="dot" style:animation-delay="300ms"></span>
              </div>
              <span class="panel-status-text">Loading creators...</span>
            </div>
          {/if}
        </div>
      {:else}
        <div class="demo-placeholder">
          <span>Panel content loaded</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Section 3: Deterministic Progress -->
  <section class="demo-section">
    <div class="section-header">
      <h3>Deterministic Progress</h3>
      <p>Multi-step save, batch operations, thumbnail rendering</p>
    </div>
    <div class="variant-selector">
      <button class:active={determinateVariant === "bar"} onclick={() => determinateVariant = "bar"}>A: Bar + Count</button>
      <button class:active={determinateVariant === "ring"} onclick={() => determinateVariant = "ring"}>B: Ring + %</button>
      <button class:active={determinateVariant === "steps"} onclick={() => determinateVariant = "steps"}>C: Steps + Bar</button>
      <button class="play-btn" onclick={playDeterminate} disabled={determinateActive}>
        <i class="fas fa-play" aria-hidden="true"></i> Play
      </button>
    </div>
    <div class="demo-viewport determinate-viewport">
      <div class="determinate-demo">
        {#if determinateVariant === "bar"}
          <ProgressBar percent={determinatePercent} showPercent label="{Math.ceil(determinatePercent / 25)} / 4 steps" height={8} />
        {:else if determinateVariant === "ring"}
          <ProgressRing percent={determinatePercent} size={80} strokeWidth={6} label="{Math.round(determinatePercent)}%" />
        {:else if determinateVariant === "steps"}
          <div class="steps-with-bar">
            <StepProgress steps={demoSteps} currentStep={determinateStep} orientation="vertical" />
            <ProgressBar percent={determinatePercent} height={4} />
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- Section 4: Grid Cells -->
  <section class="demo-section">
    <div class="section-header">
      <h3>Grid Cell Loading</h3>
      <p>LayeredSequencePreview — pictograph cells loading one by one</p>
    </div>
    <div class="variant-selector">
      <button class:active={gridVariant === "shimmer"} onclick={() => gridVariant = "shimmer"}>A: Shimmer</button>
      <button class:active={gridVariant === "fade"} onclick={() => gridVariant = "fade"}>B: Stagger Fade</button>
      <button class:active={gridVariant === "ring"} onclick={() => gridVariant = "ring"}>C: Micro Ring</button>
      <button class="play-btn" onclick={playGrid} disabled={gridActive}>
        <i class="fas fa-play" aria-hidden="true"></i> Play
      </button>
    </div>
    <div class="demo-viewport grid-viewport">
      <div class="grid-demo">
        {#each gridCells as loaded, i}
          <div class="grid-cell" class:loaded>
            {#if loaded}
              <div class="cell-content">{i + 1}</div>
            {:else if gridVariant === "shimmer"}
              <ShimmerBlock width="100%" height="100%" borderRadius="4px" delay={i * 50} />
            {:else if gridVariant === "fade"}
              <div class="cell-empty"></div>
            {:else if gridVariant === "ring"}
              <ProgressRing percent={-1} size={20} strokeWidth={2} />
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Section 5: Button Actions -->
  <section class="demo-section">
    <div class="section-header">
      <h3>Button Actions</h3>
      <p>Spell generation, export, async operations</p>
    </div>
    <div class="variant-selector">
      <button class:active={buttonVariant === "spinner"} onclick={() => buttonVariant = "spinner"}>A: Spinner</button>
      <button class:active={buttonVariant === "morph"} onclick={() => buttonVariant = "morph"}>B: Morph Bar</button>
      <button class:active={buttonVariant === "fill"} onclick={() => buttonVariant = "fill"}>C: Fill Sweep</button>
      <button class="play-btn" onclick={playButton} disabled={buttonActive}>
        <i class="fas fa-play" aria-hidden="true"></i> Play
      </button>
    </div>
    <div class="demo-viewport button-viewport">
      <div class="button-demo">
        {#if buttonVariant === "spinner"}
          <button class="demo-action-btn" disabled={buttonActive}>
            {#if buttonActive}
              <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Generating...
            {:else}
              <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Generate
            {/if}
          </button>
        {:else if buttonVariant === "morph"}
          <div class="morph-button-wrapper">
            {#if buttonActive}
              <div class="morph-bar">
                <ProgressBar percent={buttonPercent} height={40} showPercent />
              </div>
            {:else}
              <button class="demo-action-btn" onclick={playButton}>
                <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Generate
              </button>
            {/if}
          </div>
        {:else if buttonVariant === "fill"}
          <button class="demo-action-btn fill-btn" disabled={buttonActive}>
            {#if buttonActive}
              <div class="fill-sweep" style:width="{buttonPercent}%"></div>
              <span class="fill-label">Generating...</span>
            {:else}
              <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Generate
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </section>
</div>

<style>
  .progress-lab {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 24px;
    overflow-y: auto;
    height: 100%;
  }

  /* Simulate reduced motion for demo purposes */
  .progress-lab.reduced-motion :global(*) {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }

  /* Global controls */
  .lab-controls {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .control-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .speed-buttons {
    display: flex;
    gap: 4px;
  }

  .speed-buttons button {
    padding: 4px 10px;
    font-size: var(--font-size-compact, 12px);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
  }

  .speed-buttons button.active {
    background: var(--theme-accent, #8b5cf6);
    color: white;
    border-color: transparent;
  }

  /* Demo sections */
  .demo-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header h3 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .section-header p {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Variant selector */
  .variant-selector {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .variant-selector button {
    padding: 6px 14px;
    font-size: var(--font-size-compact, 12px);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .variant-selector button.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
  }

  .variant-selector button:hover:not(.active):not(:disabled) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .play-btn {
    margin-left: auto;
    background: var(--theme-accent, #8b5cf6) !important;
    color: white !important;
    border-color: transparent !important;
    font-weight: 500;
  }

  .play-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Demo viewport */
  .demo-viewport {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .full-page-viewport {
    height: 240px;
    position: relative;
  }

  .panel-viewport {
    height: 200px;
  }

  .determinate-viewport {
    padding: 24px;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid-viewport {
    padding: 16px;
  }

  .button-viewport {
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .demo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-sm, 14px);
  }

  /* Panel demo */
  .panel-demo {
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  .panel-skeleton-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .panel-skeleton-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .panel-skeleton-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .panel-bar-demo,
  .panel-dots-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
  }

  .panel-status-text {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Pulse dots */
  .pulse-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    animation: dot-bounce 1.2s ease-in-out infinite;
  }

  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Determinate demo */
  .determinate-demo {
    width: 100%;
    max-width: 320px;
  }

  .steps-with-bar {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Grid demo */
  .grid-demo {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .grid-cell {
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .grid-cell.loaded {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
    animation: cell-pop 0.3s var(--ease-spring, ease);
  }

  @keyframes cell-pop {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .cell-content {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-accent, #8b5cf6);
  }

  .cell-empty {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.02);
  }

  /* Button demos */
  .button-demo {
    display: flex;
    justify-content: center;
  }

  .demo-action-btn {
    padding: 12px 24px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
    min-width: 160px;
    justify-content: center;
  }

  .demo-action-btn:disabled {
    opacity: 0.8;
    cursor: not-allowed;
  }

  .morph-button-wrapper {
    min-width: 160px;
  }

  .morph-bar {
    border-radius: 10px;
    overflow: hidden;
  }

  .fill-btn {
    position: relative;
  }

  .fill-sweep {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(255, 255, 255, 0.2);
    transition: width 80ms linear;
  }

  .fill-label {
    position: relative;
    z-index: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-cell.loaded { animation: none; }
    .dot { animation: none; opacity: 1; transform: scale(1); }
  }
</style>
```

### Step 2: Register in LabModule

In `src/lib/features/lab/LabModule.svelte`, add at line 46 (after the `effects` entry):

```typescript
    progress: () => import("$lib/features/progress-lab/ProgressLabModule.svelte"),
```

### Step 3: Add tab definition

In `src/lib/shared/navigation/config/tab-definitions.ts`, add before the closing `];` of `LAB_TABS` (before the museum entry at ~line 756):

```typescript
  {
    id: "progress",
    label: "Progress",
    icon: '<i class="fas fa-bars-progress" aria-hidden="true"></i>',
    description: "Compare loading indicator styles",
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
  },
```

### Step 4: Verify build

Run: `npm run build`
Expected: 0 errors, 0 warnings

### Step 5: Commit

```bash
git add src/lib/features/progress-lab/ProgressLabModule.svelte src/lib/features/lab/LabModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(progress-lab): add Progress Lab with 5 demo sections"
```

---

## Task 8: Checkpoint — User picks favorites

**This is a manual step. No code changes.**

After Task 7, tell the user:

> "The Progress Lab is ready. Navigate to Lab > Progress in the app. Play through each section, toggle the variants, and tell me which you prefer for each context:
>
> 1. Full-page gate: A (top bar), B (card + ring), or C (skeleton)?
> 2. Panel loading: A (skeleton), B (bar + text), or C (pulse dots)?
> 3. Deterministic progress: A (bar + count), B (ring + %), or C (steps + bar)?
> 4. Grid cells: A (shimmer), B (stagger fade), or C (micro ring)?
> 5. Button actions: A (spinner), B (morph bar), or C (fill sweep)?
>
> I'll then roll out your choices across the app."

**Block here. Do not proceed to Task 9 until user has made selections.**

---

## Task 9: Roll out full-page gates (Wave 1)

**Files to modify:** (exact changes depend on user's choice from Task 8)
- `src/routes/+page.svelte`
- `src/routes/[...path]/+page.svelte`
- `src/routes/p/[code]/+page.svelte`
- `src/routes/sequence/[id]/+page.svelte`
- `src/routes/auth/login/+page.svelte`

**Step 1:** In each file, replace the hardcoded spinner HTML + `@keyframes spin` CSS with:

```svelte
<script>
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";
</script>

<!-- Replace the existing loading div with: -->
<LoadingGate variant="{USER_CHOICE}" message="Loading sequence..." />
```

**Step 2:** Delete the `@keyframes spin` and `.loading-spinner` / `.spinner` CSS blocks from each file.

**Step 3:** Verify build: `npm run build`

**Step 4:** Commit

```bash
git add src/routes/+page.svelte src/routes/\\[...path\\]/+page.svelte src/routes/p/\\[code\\]/+page.svelte src/routes/sequence/\\[id\\]/+page.svelte src/routes/auth/login/+page.svelte
git commit -m "feat(loading): replace route-level spinners with LoadingGate"
```

---

## Task 10: Roll out panel loading (Wave 2)

**Files:**
- Modify: `src/lib/shared/components/panel/PanelState.svelte`
- Possibly modify: `src/lib/shared/components/panel/PanelSpinner.svelte`

**Step 1:** Update `PanelState.svelte` to use the chosen panel variant instead of `PanelSpinner`.

If user chose "skeleton" (variant A):
```svelte
{#if type === "loading"}
  <div class="panel-loading-skeleton">
    <ShimmerBlock circle height="40px" />
    <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
      <ShimmerBlock height="14px" width="65%" />
      <ShimmerBlock height="10px" width="40%" delay={80} />
    </div>
  </div>
```

If user chose "bar" (variant B):
```svelte
{#if type === "loading"}
  <div class="panel-loading-bar">
    <IndeterminateBar height={3} />
    <span class="loading-text">Loading...</span>
  </div>
```

If user chose "dots" (variant C):
Import and render the pulse dots pattern.

**Step 2:** All 7+ panel consumers automatically pick up the change via PanelState.

**Step 3:** Verify build: `npm run build`

**Step 4:** Commit

```bash
git add src/lib/shared/components/panel/PanelState.svelte
git commit -m "feat(loading): upgrade PanelState loading indicator"
```

---

## Task 11: Roll out grid cell loading (Wave 3)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/LayeredSequencePreview.svelte`

**Step 1:** Add the chosen grid cell loading indicator where `isLoaded` is false.

**Step 2:** Verify build: `npm run build`

**Step 3:** Commit

```bash
git add src/lib/shared/sequence-viewer/components/LayeredSequencePreview.svelte
git commit -m "feat(loading): add per-cell loading indicator to LayeredSequencePreview"
```

---

## Task 12: Roll out button actions (Wave 4)

**Files:**
- Modify: `src/lib/features/create/spell/components/SpellPanel.svelte`
- Modify: `src/lib/features/create/spell/components/SpellInputToolbar.svelte`
- Modify: `src/lib/features/compose/phases/export/ExportPhase.svelte`
- Modify: `src/lib/features/admin/components/TrainChallengeManager.svelte`

**Step 1:** Replace `fa-spinner fa-spin` / `fa-circle-notch fa-spin` inline patterns with the chosen button loading variant.

**Step 2:** Verify build: `npm run build`

**Step 3:** Commit

```bash
git add src/lib/features/create/spell/components/SpellPanel.svelte src/lib/features/create/spell/components/SpellInputToolbar.svelte src/lib/features/compose/phases/export/ExportPhase.svelte src/lib/features/admin/components/TrainChallengeManager.svelte
git commit -m "feat(loading): upgrade button action loading indicators"
```

---

## Task 13: Cleanup — delete duplicated spinners (Wave 5)

**Step 1:** Search all files for `@keyframes spin` and remove any remaining copy-pasted instances that are no longer used.

Run: `grep -rn "@keyframes spin" src/ --include="*.svelte" --include="*.css"`

**Step 2:** For each hit, verify the spinner is replaced by a shared component. If so, delete the `@keyframes spin` block and any `.spinner` / `.loading-spinner` CSS that references it.

**Step 3:** Verify build: `npm run build`

**Step 4:** Commit

```bash
git commit -am "chore(loading): remove duplicated @keyframes spin definitions"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | IndeterminateBar primitive | 1 new |
| 2 | ProgressBar primitive | 1 new |
| 3 | ProgressRing primitive | 1 new |
| 4 | ShimmerBlock primitive | 1 new |
| 5 | StepProgress primitive | 1 new |
| 6 | LoadingGate primitive | 1 new |
| 7 | Progress Lab module + wiring | 1 new, 2 modified |
| 8 | **CHECKPOINT: User picks favorites** | — |
| 9 | Wave 1: Full-page gates | 5 modified |
| 10 | Wave 2: Panel loading | 1-2 modified |
| 11 | Wave 3: Grid cells | 1 modified |
| 12 | Wave 4: Button actions | 4 modified |
| 13 | Wave 5: Cleanup | Multiple modified |
