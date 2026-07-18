# How TKA Works Assembly Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's six simultaneous "How it works" cards with one responsive, accessible Assembly Table that presents the same six real product states on one persistent stage.

**Architecture:** Keep sequence loading and data derivation inside `HowTkaWorksSection.svelte`, but move deterministic step order and lifecycle decisions into a small landing-local TypeScript model. Use one `PictographContainer` for the first four states, Bits UI `ToggleGroup` for single-selection and roving keyboard focus, the existing `ChoreoCard` for the sequence state, and the existing animation card for playback. The lazy wrapper reserves the same stage-and-rail geometry as the loaded section.

**Tech Stack:** Svelte 5 runes, TypeScript, Bits UI `ToggleGroup`, existing TKA renderers, Vitest, project design tokens, CSS container queries and viewport media queries.

## Global Constraints

- Keep the current public sequence ID, fetch path, hydration, and derived pictograph data unchanged.
- Do not introduce TKA domain facts, new notation data, or hand-built pictograph rendering.
- Use exactly one mounted `PictographContainer` for steps 1 through 4.
- Use installed primitives and dependencies only; add no package.
- Do not wrap the pictograph renderer in a new crossfade.
- Keep one step selected at all times and preserve 44 px minimum control targets.
- Do not use scroll hijacking, sticky pinning, parallax, hover lift, gradient text, glass cards, circular number badges, or looping section autoplay.
- Reduced motion starts on `motion` and disables automatic progression.
- The animation may initialize and play only when playback is selected, the section is visible, and the document is visible.
- Preserve the 920 px landing-page fold threshold.
- Use the project's three-layer CSS variable hierarchy and existing typography.
- Browser verification uses the worktree's own free port after the resource gate; never touch `https://localhost:5173`.

---

## File Structure

- Create `src/routes/landing/components/how-tka-assembly-model.ts`: step identifiers, display metadata, progression, initial state, and playback activation predicate.
- Create `tests/unit/landing/how-tka-assembly-model.test.ts`: deterministic tests for order, reduced-motion initialization, progression termination, and playback gating.
- Create `tests/unit/landing/how-tka-assembly-contract.test.ts`: source-level architecture contract for one pictograph renderer, Bits UI selection, animation activation, and stage-and-rail skeleton parity.
- Modify `src/routes/landing/components/HowTkaAnimationCard.svelte`: accept `active`, track intersection and document visibility, initialize lazily, and pause/resume playback safely.
- Modify `src/routes/landing/components/HowTkaWorksSection.svelte`: replace the six-card grid with the Assembly Table, introduce controlled progression, and render one active stage.
- Modify `src/routes/landing/components/LazyHowTkaWorksSection.svelte`: replace the six-card placeholder with matching heading, stage, and rail geometry.

---

### Task 1: Assembly state model

**Files:**
- Create: `tests/unit/landing/how-tka-assembly-model.test.ts`
- Create: `src/routes/landing/components/how-tka-assembly-model.ts`

**Interfaces:**
- Produces: `AssemblyStep`, `AssemblyStepDefinition`, `ASSEMBLY_STEPS`, `getInitialAssemblyStep(reducedMotion)`, `getNextAssemblyStep(current)`, and `shouldEnableAssemblyPlayback(input)`.
- Consumed by: both landing Svelte components and the contract tests.

- [ ] **Step 1: Write the failing model tests**

```ts
import { describe, expect, it } from "vitest";
import {
  ASSEMBLY_STEPS,
  getInitialAssemblyStep,
  getNextAssemblyStep,
  shouldEnableAssemblyPlayback,
} from "../../../src/routes/landing/components/how-tka-assembly-model";

describe("How TKA assembly model", () => {
  it("keeps the approved six-step order and labels", () => {
    expect(ASSEMBLY_STEPS.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: "grid", label: "The grid" },
      { value: "hands", label: "Place the hands" },
      { value: "props", label: "Add the props" },
      { value: "motion", label: "Add motion" },
      { value: "sequence", label: "Build the sequence" },
      { value: "playback", label: "Play it back" },
    ]);
  });

  it("starts reduced-motion visitors on the completed pictograph", () => {
    expect(getInitialAssemblyStep(false)).toBe("grid");
    expect(getInitialAssemblyStep(true)).toBe("motion");
  });

  it("advances once through the sequence and then stops", () => {
    expect(getNextAssemblyStep("grid")).toBe("hands");
    expect(getNextAssemblyStep("motion")).toBe("sequence");
    expect(getNextAssemblyStep("sequence")).toBe("playback");
    expect(getNextAssemblyStep("playback")).toBeNull();
  });

  it("enables playback only when all three visibility conditions are true", () => {
    expect(shouldEnableAssemblyPlayback({ active: true, sectionVisible: true, documentVisible: true })).toBe(true);
    expect(shouldEnableAssemblyPlayback({ active: false, sectionVisible: true, documentVisible: true })).toBe(false);
    expect(shouldEnableAssemblyPlayback({ active: true, sectionVisible: false, documentVisible: true })).toBe(false);
    expect(shouldEnableAssemblyPlayback({ active: true, sectionVisible: true, documentVisible: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the model test and verify RED**

Run:

```powershell
pnpm exec vitest --config tests/config/vitest.config.ts --run tests/unit/landing/how-tka-assembly-model.test.ts
```

Expected: FAIL because `how-tka-assembly-model.ts` does not exist.

- [ ] **Step 3: Implement the model**

```ts
export const ASSEMBLY_STEPS = [
  { value: "grid", number: "01", label: "The grid", stageLabel: "The notation grid", delayMs: 700 },
  { value: "hands", number: "02", label: "Place the hands", stageLabel: "Hands placed on the grid", delayMs: 700 },
  { value: "props", number: "03", label: "Add the props", stageLabel: "Props added to the grid", delayMs: 700 },
  { value: "motion", number: "04", label: "Add motion", stageLabel: "Motion added to the pictograph", delayMs: 1200 },
  { value: "sequence", number: "05", label: "Build the sequence", stageLabel: "The complete sequence card", delayMs: 1400 },
  { value: "playback", number: "06", label: "Play it back", stageLabel: "The animated sequence", delayMs: 0 },
] as const;

export type AssemblyStep = (typeof ASSEMBLY_STEPS)[number]["value"];
export type AssemblyStepDefinition = (typeof ASSEMBLY_STEPS)[number];

export function getInitialAssemblyStep(reducedMotion: boolean): AssemblyStep {
  return reducedMotion ? "motion" : "grid";
}

export function getNextAssemblyStep(current: AssemblyStep): AssemblyStep | null {
  const index = ASSEMBLY_STEPS.findIndex((step) => step.value === current);
  return ASSEMBLY_STEPS[index + 1]?.value ?? null;
}

interface PlaybackActivation {
  active: boolean;
  sectionVisible: boolean;
  documentVisible: boolean;
}

export function shouldEnableAssemblyPlayback({
  active,
  sectionVisible,
  documentVisible,
}: PlaybackActivation): boolean {
  return active && sectionVisible && documentVisible;
}
```

- [ ] **Step 4: Run the model test and verify GREEN**

Run the command from Step 2.

Expected: 4 tests pass with no warnings.

- [ ] **Step 5: Commit the model and test with explicit paths**

```powershell
git add -- src/routes/landing/components/how-tka-assembly-model.ts tests/unit/landing/how-tka-assembly-model.test.ts
git commit -m "feat: model landing assembly progression" -- src/routes/landing/components/how-tka-assembly-model.ts tests/unit/landing/how-tka-assembly-model.test.ts
```

---

### Task 2: Architecture contract and animation lifecycle

**Files:**
- Create: `tests/unit/landing/how-tka-assembly-contract.test.ts`
- Modify: `src/routes/landing/components/HowTkaAnimationCard.svelte`

**Interfaces:**
- Consumes: `shouldEnableAssemblyPlayback({ active, sectionVisible, documentVisible })` from Task 1.
- Produces: `HowTkaAnimationCard` prop `active?: boolean`, defaulting to `false`.

- [ ] **Step 1: Write the failing architecture contract**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("How TKA assembly architecture", () => {
  it("uses one pictograph stage and the installed single-select primitive", () => {
    const source = read("src/routes/landing/components/HowTkaWorksSection.svelte");
    expect(source.match(/<PictographContainer\b/g)).toHaveLength(1);
    expect(source).toContain("<ToggleGroup.Root");
    expect(source).toContain('type="single"');
    expect(source).toContain('aria-live="polite"');
    expect(source).not.toContain('class="step-card"');
  });

  it("activates the animation only for the playback step", () => {
    const source = read("src/routes/landing/components/HowTkaWorksSection.svelte");
    expect(source).toContain('active={activeStep === "playback"}');
  });

  it("gates the animation with active, intersection, and document visibility", () => {
    const source = read("src/routes/landing/components/HowTkaAnimationCard.svelte");
    expect(source).toContain("active?: boolean");
    expect(source).toContain("shouldEnableAssemblyPlayback");
    expect(source).toContain('document.addEventListener("visibilitychange"');
  });

  it("uses a stage-and-rail lazy skeleton instead of six cards", () => {
    const source = read("src/routes/landing/components/LazyHowTkaWorksSection.svelte");
    expect(source).toContain('class="sk-stage"');
    expect(source).toContain('class="sk-rail"');
    expect(source).not.toContain('class="sk-card"');
  });
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
pnpm exec vitest --config tests/config/vitest.config.ts --run tests/unit/landing/how-tka-assembly-contract.test.ts
```

Expected: all four tests fail against the six-card implementation.

- [ ] **Step 3: Add controlled animation lifecycle**

Change the props and visibility state in `HowTkaAnimationCard.svelte`:

```ts
import { shouldEnableAssemblyPlayback } from "./how-tka-assembly-model";

interface Props {
  sequence: SequenceData;
  propType?: PropType;
  active?: boolean;
}

let { sequence, propType = PropType.STAFF, active = false }: Props = $props();
let sectionVisible = $state(false);
let documentVisible = $state(true);
let initializing = false;

const playbackEnabled = $derived(
  shouldEnableAssemblyPlayback({ active, sectionVisible, documentVisible })
);
```

Replace the one-shot observer with a persistent observer that updates `sectionVisible`. Add and clean up a `visibilitychange` listener:

```ts
onMount(() => {
  if (!containerRef) return;

  const updateDocumentVisibility = () => {
    documentVisible = !document.hidden;
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      sectionVisible = entry?.isIntersecting ?? false;
    },
    { rootMargin: "200px", threshold: 0.1 }
  );

  updateDocumentVisibility();
  document.addEventListener("visibilitychange", updateDocumentVisibility);
  observer.observe(containerRef);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", updateDocumentVisibility);
  };
});
```

Use one effect to initialize only after `playbackEnabled` becomes true, pause when it becomes false, and resume when it becomes true again:

```ts
$effect(() => {
  if (!playbackEnabled) {
    if (animationState.isPlaying) playbackController?.togglePlayback();
    return;
  }

  if (!hasStartedLoading && !initializing) {
    hasStartedLoading = true;
    void initializeAnimation();
    return;
  }

  if (animationReady && !animationState.isPlaying) {
    playbackController?.togglePlayback();
  }
});
```

Inside `initializeAnimation`, set and clear `initializing` with `try/finally`. After `tick()`, start playback only if `playbackEnabled` is still true. Keep the current ephemeral state, prop application, animation settings, dynamic import, and disposal behavior.

- [ ] **Step 4: Run the focused model test**

Run:

```powershell
pnpm exec vitest --config tests/config/vitest.config.ts --run tests/unit/landing/how-tka-assembly-model.test.ts
```

Expected: 4 tests pass. The full contract remains red because the section and skeleton are not rebuilt yet.

- [ ] **Step 5: Commit the lifecycle change and contract test**

```powershell
git add -- src/routes/landing/components/HowTkaAnimationCard.svelte tests/unit/landing/how-tka-assembly-contract.test.ts
git commit -m "feat: gate landing animation playback" -- src/routes/landing/components/HowTkaAnimationCard.svelte tests/unit/landing/how-tka-assembly-contract.test.ts
```

---

### Task 3: Assembly Table section

**Files:**
- Modify: `src/routes/landing/components/HowTkaWorksSection.svelte`
- Test: `tests/unit/landing/how-tka-assembly-contract.test.ts`

**Interfaces:**
- Consumes: `ASSEMBLY_STEPS`, `AssemblyStep`, `getInitialAssemblyStep`, and `getNextAssemblyStep`.
- Consumes: `HowTkaAnimationCard active?: boolean` from Task 2.
- Produces: one responsive Assembly Table with a stable stage and one controlled step rail.

- [ ] **Step 1: Preserve sequence loading and replace presentation state**

Keep the existing Firebase imports, public sequence ID, hydration, `forceProps`, and `setupFromSequence`. Add:

```ts
import { ToggleGroup } from "bits-ui";
import {
  ASSEMBLY_STEPS,
  getInitialAssemblyStep,
  getNextAssemblyStep,
  type AssemblyStep,
} from "./how-tka-assembly-model";

let activeStep = $state<AssemblyStep>("grid");
let userEngaged = $state(false);
let sectionVisible = $state(false);
let sectionEl: HTMLElement | undefined = $state();
let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
let railOrientation = $state<"horizontal" | "vertical">("vertical");
let reducedMotion = $state(false);

const activeDefinition = $derived(
  ASSEMBLY_STEPS.find((step) => step.value === activeStep) ?? ASSEMBLY_STEPS[0]
);

const activePictographData = $derived.by(() => {
  if (activeStep === "grid") return emptyGridData;
  if (activeStep === "hands") return gridOnlyData;
  if (activeStep === "props") return propsData;
  return motionData;
});
```

Add exact engagement and selection handlers:

```ts
function clearAutoAdvance() {
  if (autoAdvanceTimer) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
}

function engage() {
  userEngaged = true;
  clearAutoAdvance();
}

function selectStep(value: string) {
  const stepExists = ASSEMBLY_STEPS.some((step) => step.value === value);
  if (!value || !stepExists) return;
  engage();
  activeStep = value as AssemblyStep;
}
```

On mount, read the reduced-motion and compact-layout media queries, set the initial step and rail orientation, observe section intersection, and register cleanup:

```ts
onMount(() => {
  if (!sectionEl) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactQuery = window.matchMedia("(max-width: 640px)");
  const syncMedia = () => {
    reducedMotion = motionQuery.matches;
    railOrientation = compactQuery.matches ? "horizontal" : "vertical";
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      sectionVisible = entry?.isIntersecting ?? false;
    },
    { rootMargin: "100px", threshold: 0.2 }
  );

  syncMedia();
  activeStep = getInitialAssemblyStep(reducedMotion);
  motionQuery.addEventListener("change", syncMedia);
  compactQuery.addEventListener("change", syncMedia);
  observer.observe(sectionEl);

  return () => {
    clearAutoAdvance();
    observer.disconnect();
    motionQuery.removeEventListener("change", syncMedia);
    compactQuery.removeEventListener("change", syncMedia);
  };
});
```

Start one timer at a time only when loaded, visible, not reduced-motion, and not engaged. `getNextAssemblyStep("playback")` stops the progression:

```ts
$effect(() => {
  clearAutoAdvance();
  if (!loaded || !sequence || !sectionVisible || reducedMotion || userEngaged) return;

  const next = getNextAssemblyStep(activeStep);
  if (!next) return;

  autoAdvanceTimer = setTimeout(() => {
    activeStep = next;
    autoAdvanceTimer = null;
  }, activeDefinition.delayMs);

  return clearAutoAdvance;
});
```

Selection, focus entering the control, or pointer interaction with the stage calls `engage()` to clear the timer permanently for the mount.

- [ ] **Step 2: Replace the six-card markup with one stage and rail**

Use this structure:

```svelte
<section class="how-tka-works" bind:this={sectionEl}>
  <div class="section-intro">
    <p class="section-kicker">How TKA works</p>
    <h2>How it works</h2>
    <p class="section-subtitle">
      Start with the grid. Add hands, props, and motion. String the steps together, then press play.
    </p>
  </div>

  {#if loaded && sequence}
    <div class="assembly-table">
      <p class="sr-only" aria-live="polite">
        {userEngaged ? activeDefinition.stageLabel : ""}
      </p>
      <div
        class="assembly-stage"
        data-step={activeStep}
        aria-label={activeDefinition.stageLabel}
        onpointerdown={engage}
      >
        {#if activeStep === "sequence"}
          <div class="sequence-stage">
            <ChoreoCard
              {sequence}
              darkMode={false}
              columnCount={2}
              bluePropType={propType}
              redPropType={propType}
              startPositionLayoutOverride="column"
              showMandala={true}
              showCreatorName={false}
              showNotes={false}
              showBirthday={false}
            />
          </div>
        {:else if activeStep === "playback"}
          <div class="animation-stage">
            <HowTkaAnimationCard
              {sequence}
              {propType}
              active={activeStep === "playback"}
            />
          </div>
        {:else if activePictographData}
          <div class="pictograph-stage">
            <PictographContainer
              pictographData={activePictographData}
              gridMode={GridMode.DIAMOND}
              bluePropTypeOverride={activeStep === "hands" ? PropType.HAND : propType}
              redPropTypeOverride={activeStep === "hands" ? PropType.HAND : propType}
              showGrid={true}
              showTKA={activeStep !== "grid"}
              showReversals={false}
              showPositions={activeStep === "motion"}
              showHandPoints={activeStep !== "grid"}
              showBlueMotion={activeStep === "motion"}
              showRedMotion={activeStep === "motion"}
              darkMode={false}
              disableTransitions={false}
            />
          </div>
        {/if}
      </div>

      <ToggleGroup.Root
        type="single"
        value={activeStep}
        onValueChange={selectStep}
        orientation={railOrientation}
        rovingFocus={true}
        class="step-rail"
        aria-label="Notation assembly stages"
        onfocusin={engage}
      >
        {#each ASSEMBLY_STEPS as step}
          <ToggleGroup.Item value={step.value} class="step-control">
            <span class="step-number">{step.number}</span>
            <span class="step-label">{step.label}</span>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
  {:else if loaded}
    <div class="assembly-table assembly-error">
      <div class="assembly-stage error-stage" role="status">
        <p>Couldn't load the notation example.</p>
      </div>
      <ToggleGroup.Root
        type="single"
        value={activeStep}
        onValueChange={selectStep}
        orientation={railOrientation}
        rovingFocus={true}
        class="step-rail"
        aria-label="Notation assembly stages"
      >
        {#each ASSEMBLY_STEPS as step}
          <ToggleGroup.Item value={step.value} class="step-control">
            <span class="step-number">{step.number}</span>
            <span class="step-label">{step.label}</span>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
  {:else}
    <div class="assembly-table section-loading" aria-hidden="true">
      <div class="assembly-stage loading-stage"></div>
      <div class="step-rail loading-rail"></div>
    </div>
  {/if}
</section>
```

Use exactly the `PictographContainer` and `ChoreoCard` props shown above. The components already expose the required light-stage theme input. Do not invent renderer behavior.

- [ ] **Step 3: Implement the editorial visual system and responsive geometry**

Define section-owned semantic variables on `.how-tka-works`, including `--assembly-paper`, `--assembly-ink`, `--assembly-void`, `--assembly-navy`, `--assembly-blue`, and `--assembly-red`. Map them to global theme or prop tokens with the approved fallback values.

Implement:

- left-aligned intro aligned to the Assembly Table;
- a pale, stable stage with restrained border and shadow;
- a dark rail with one structural rule and numbered markers;
- selected state using contrast, marker fill, and text weight rather than color alone;
- no hover translation or glass-card surface;
- `min-height: 44px` on every control;
- desktop two-column stage and rail;
- 920 to 1,199 px compact two-column fold composition;
- phone stacked stage and 2-by-3 control grid;
- 2,200 px and wider composition clamped near 70 to 74 vw with a 1,100 to 1,250 px stage at 4K;
- stable stage aspect ratio and minimum block size across all six states; and
- reduced-motion removal of nonessential transitions.

- [ ] **Step 4: Run the contract test and inspect failures**

Run:

```powershell
pnpm exec vitest --config tests/config/vitest.config.ts --run tests/unit/landing/how-tka-assembly-contract.test.ts
```

Expected: the first three tests pass. The lazy skeleton test remains red until Task 4.

- [ ] **Step 5: Commit the section with explicit paths**

```powershell
git add -- src/routes/landing/components/HowTkaWorksSection.svelte
git commit -m "feat: build landing assembly table" -- src/routes/landing/components/HowTkaWorksSection.svelte
```

---

### Task 4: Lazy skeleton parity

**Files:**
- Modify: `src/routes/landing/components/LazyHowTkaWorksSection.svelte`
- Test: `tests/unit/landing/how-tka-assembly-contract.test.ts`

**Interfaces:**
- Consumes: the loaded section's outer spacing, stage ratio, rail width, and responsive breakpoints.
- Produces: a matching pre-import placeholder and unchanged retry behavior.

- [ ] **Step 1: Replace the card skeleton markup**

```svelte
<div class="how-section-skeleton skeleton-pulse" aria-hidden="true">
  <div class="sk-intro">
    <div class="sk-kicker"></div>
    <div class="sk-heading"></div>
    <div class="sk-copy"></div>
  </div>
  <div class="sk-assembly">
    <div class="sk-stage"></div>
    <div class="sk-rail">
      {#each { length: 6 } as _}
        <div class="sk-step"></div>
      {/each}
    </div>
  </div>
</div>
```

Keep the always-present `#how-it-works` anchor, lazy import, retry button, and root-margin behavior unchanged.

- [ ] **Step 2: Mirror the loaded section's geometry**

Use the same section padding, max-width tiers, two-column ratio, gap, stage aspect ratio, 920 px fold behavior, phone stack, and 2-by-3 rail. Skeleton color may remain subdued, but its boxes must occupy the final component rectangles. Disable pulse under reduced motion.

- [ ] **Step 3: Run both focused tests and verify GREEN**

Run:

```powershell
pnpm exec vitest --config tests/config/vitest.config.ts --run tests/unit/landing/how-tka-assembly-model.test.ts tests/unit/landing/how-tka-assembly-contract.test.ts
```

Expected: 8 tests pass with no warnings.

- [ ] **Step 4: Commit the skeleton and contract test**

```powershell
git add -- src/routes/landing/components/LazyHowTkaWorksSection.svelte tests/unit/landing/how-tka-assembly-contract.test.ts
git commit -m "feat: match landing assembly skeleton" -- src/routes/landing/components/LazyHowTkaWorksSection.svelte tests/unit/landing/how-tka-assembly-contract.test.ts
```

---

### Task 5: Type and browser verification

**Files:**
- Modify only files already in scope if verification exposes a defect.
- Do not create golden screenshots unless the existing screenshot workflow requires an approved baseline update.

**Interfaces:**
- Consumes: all Task 1 through Task 4 deliverables.
- Produces: recorded test, type, runtime, accessibility, and geometry evidence.

- [ ] **Step 1: Run the resource gate**

Use PowerShell to confirm at least 4,096 MB available memory, no other `svelte-check`, and fewer than two agent Vite servers. Do not kill another session's processes.

- [ ] **Step 2: Run the focused test suite**

```powershell
pnpm exec vitest --config tests/config/vitest.config.ts --run tests/unit/landing/how-tka-assembly-model.test.ts tests/unit/landing/how-tka-assembly-contract.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 3: Run the project fast check once**

```powershell
pnpm run check:fast
```

Expected: exit 0 with no new Svelte or TypeScript errors.

- [ ] **Step 4: Start one worktree Vite server if the server and memory gates pass**

Run a hidden process on a free port other than 5173 and capture its process ID and logs. Verify the page responds over the protocol printed by Vite. The process must be stopped after verification.

- [ ] **Step 5: Verify the browser matrix**

With the user's existing browser permission, inspect 390 by 844, 929 by 1,011, 1,440 by 900, 1,920 by 1,080, and 3,840 by 2,160.

Record evidence for:

- one stage and one six-step rail;
- no horizontal overflow;
- stable stage and section rectangles while selecting all six steps;
- arrow-key navigation and visible focus;
- autoplay cancellation after engagement;
- reduced-motion initial state and no automatic progression;
- animation loading only on playback and pausing after leaving playback;
- no new console errors;
- lazy skeleton and loaded-section rectangle parity; and
- 4K section, stage, and rail dimensions showing recomposition beyond the old 1,960 px row.

- [ ] **Step 6: Re-run focused tests after any verification fix**

Every defect fix starts with a failing focused test when the behavior is not purely visual. Run the relevant focused tests after each fix.

- [ ] **Step 7: Stop the worktree server and prove it is gone**

Stop only the process started in Step 4. Query the captured PID and port to prove the server is no longer running.

- [ ] **Step 8: Commit verified implementation changes with explicit paths**

```powershell
git status --short
git commit -m "fix: polish landing assembly table" -- src/routes/landing/components/how-tka-assembly-model.ts src/routes/landing/components/HowTkaAnimationCard.svelte src/routes/landing/components/HowTkaWorksSection.svelte src/routes/landing/components/LazyHowTkaWorksSection.svelte tests/unit/landing/how-tka-assembly-model.test.ts tests/unit/landing/how-tka-assembly-contract.test.ts
```

If verification required no fixes, do not create an empty commit.

---

## Completion Proof

Before calling the feature complete, report:

- focused Vitest command and passing test count;
- fast-check command and exit result;
- browser viewport list;
- 4K runtime rectangles;
- console error count;
- reduced-motion result;
- animation inactive-step result;
- lazy skeleton parity result;
- stopped worktree-server PID and port; and
- final branch status and commit list.
