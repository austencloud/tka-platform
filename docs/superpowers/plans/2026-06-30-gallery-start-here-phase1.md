# Gallery "Start Here" — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the newcomer gallery's "452 cards dumped" front door with a taxonomy-first "Start here" surface — first decision Base(TnD)-vs-LOOP, base-first, then six elemental family tiles → that family's real cards — built entirely from existing engines, previewed in the `/test/gallery-redesign` harness.

**Architecture:** A new `start-here` feature module under `src/lib/features/browse/start-here/`. A runes state factory drives a small step machine (decide → families → cards, plus the LOOP branch). Presentational components render the steps; all sequence data comes from `resolveTnDFamilyCards()` (canonical decks) and renders through the real `ChoreoCardThumbnail`. Step transitions use the shared `Crossfade` primitive. The harness route renders `<StartHere>` and swaps to the real `BrowsePanel` for "Browse all". No fabricated card chrome, no hand-rolled carousel.

**Tech Stack:** Svelte 5 runes, SvelteKit test route, existing TnD/deck engines (`tnd-element.ts`, `resolve-tnd-family-cards.ts`), `ChoreoCardThumbnail`, `HorizontalSwipeContainer`, `Crossfade`, Chrome DevTools MCP for screenshot verification.

**Verification policy (project rules override blanket TDD):** Pure logic (the state machine) gets a vitest unit test — cheap, valuable. Presentational Svelte components are verified by `npm run check` + a DevTools screenshot in the harness (per `verification-protocol.md` + `component-test-discipline.md` — do NOT write browser component tests for new presentational UI). Commit per task with an explicit pathspec (`commit-only-your-own-changes.md`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/features/browse/start-here/state/start-here-state.svelte.ts` | Step machine: current step, chosen track (base/loop), selected family/loopType, back/reset. Pure runes factory. |
| `src/lib/features/browse/start-here/components/OptionCard.svelte` | One large illustrated decision card (icon + title + description + accent). Reused for Base/LOOP and the LOOP-type list. (No existing primitive fits — SegmentedControl/FilterChipBase/PanelButton/PanelGrid all checked, none is a big 2-option illustrated card.) |
| `src/lib/features/browse/start-here/components/DecideStep.svelte` | The first decision: two `OptionCard`s (Base recommended, LOOP). |
| `src/lib/features/browse/start-here/components/ElementFamilyPicker.svelte` | Six element tiles from `TND_ELEMENTS` (icon + name + accent), `onSelect(familyId)`. |
| `src/lib/features/browse/start-here/components/FamilyCardRow.svelte` | `resolveTnDFamilyCards(familyId)` → flatten `.byTurn` → real `ChoreoCardThumbnail`s in a `HorizontalSwipeContainer`. Loading + empty states. |
| `src/lib/features/browse/start-here/components/StartHere.svelte` | Flow shell: reads the state machine, renders the current step inside `Crossfade`, owns the back affordance + "Browse all →" CTA. |
| `src/routes/test/gallery-redesign/+page.svelte` | Harness: render `<StartHere>`; on "Browse all" swap to the real `BrowsePanel` (the two-front-door behavior). |
| `src/lib/shared/browse/components/BrowseToolbar.svelte` | Modify: remove the Props/Hands + Left/Right `ViewModeToggle` UI. |

---

## Task 0: Step-machine state factory

**Files:**
- Create: `src/lib/features/browse/start-here/state/start-here-state.svelte.ts`
- Test: `src/lib/features/browse/start-here/state/start-here-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/browse/start-here/state/start-here-state.test.ts
import { describe, it, expect } from "vitest";
import { createStartHereState } from "./start-here-state.svelte";

describe("start-here-state", () => {
  it("starts on the decide step with no track", () => {
    const s = createStartHereState();
    expect(s.step).toBe("decide");
    expect(s.track).toBe(null);
  });

  it("base track goes decide -> base-families", () => {
    const s = createStartHereState();
    s.chooseBase();
    expect(s.track).toBe("base");
    expect(s.step).toBe("base-families");
  });

  it("selecting a family goes to base-cards and records the family", () => {
    const s = createStartHereState();
    s.chooseBase();
    s.selectFamily("split-same");
    expect(s.step).toBe("base-cards");
    expect(s.familyId).toBe("split-same");
  });

  it("loop track goes decide -> loop-types", () => {
    const s = createStartHereState();
    s.chooseLoop();
    expect(s.track).toBe("loop");
    expect(s.step).toBe("loop-types");
  });

  it("back from base-cards returns to base-families and clears the family", () => {
    const s = createStartHereState();
    s.chooseBase();
    s.selectFamily("fire" /* any id */);
    s.back();
    expect(s.step).toBe("base-families");
    expect(s.familyId).toBe(null);
  });

  it("back from base-families returns to decide and clears the track", () => {
    const s = createStartHereState();
    s.chooseBase();
    s.back();
    expect(s.step).toBe("decide");
    expect(s.track).toBe(null);
  });

  it("browseAll sets the browse-all step", () => {
    const s = createStartHereState();
    s.browseAll();
    expect(s.step).toBe("browse-all");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/browse/start-here/state/start-here-state.test.ts`
Expected: FAIL — `createStartHereState` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/browse/start-here/state/start-here-state.svelte.ts
export type StartHereStep =
  | "decide"
  | "base-families"
  | "base-cards"
  | "loop-types"
  | "loop-cards"
  | "browse-all";

export type StartHereTrack = "base" | "loop";

export function createStartHereState() {
  let step = $state<StartHereStep>("decide");
  let track = $state<StartHereTrack | null>(null);
  let familyId = $state<string | null>(null);
  let loopType = $state<string | null>(null);

  function chooseBase() {
    track = "base";
    step = "base-families";
  }
  function chooseLoop() {
    track = "loop";
    step = "loop-types";
  }
  function selectFamily(id: string) {
    familyId = id;
    step = "base-cards";
  }
  function selectLoopType(type: string) {
    loopType = type;
    step = "loop-cards";
  }
  function browseAll() {
    step = "browse-all";
  }
  function back() {
    switch (step) {
      case "base-cards":
        familyId = null;
        step = "base-families";
        break;
      case "loop-cards":
        loopType = null;
        step = "loop-types";
        break;
      case "base-families":
      case "loop-types":
      case "browse-all":
        track = null;
        step = "decide";
        break;
      case "decide":
        break;
    }
  }

  return {
    get step() { return step; },
    get track() { return track; },
    get familyId() { return familyId; },
    get loopType() { return loopType; },
    chooseBase,
    chooseLoop,
    selectFamily,
    selectLoopType,
    browseAll,
    back,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/browse/start-here/state/start-here-state.test.ts`
Expected: PASS (7 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/start-here/state/start-here-state.svelte.ts src/lib/features/browse/start-here/state/start-here-state.test.ts
git commit -m "feat(start-here): step-machine state factory" -- src/lib/features/browse/start-here/state/start-here-state.svelte.ts src/lib/features/browse/start-here/state/start-here-state.test.ts
```

---

## Task 1: `OptionCard` primitive

A large, clearly-clickable decision card. Button element (not a link), 44px+ target, hover state, no layout shift (fixed/equal sizing handled by the parent grid). Justification for new component: the reuse sweep found no big illustrated 2-option primitive (`primitive-discovery` satisfied).

**Files:**
- Create: `src/lib/features/browse/start-here/components/OptionCard.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/features/browse/start-here/components/OptionCard.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description: string;
    accentColor?: string;
    iconPath?: string;
    recommended?: boolean;
    onclick: () => void;
    /** Optional custom visual (overrides iconPath image) */
    icon?: Snippet;
  }

  let {
    title,
    description,
    accentColor = "var(--color-accent, #6aa0ff)",
    iconPath,
    recommended = false,
    onclick,
    icon,
  }: Props = $props();
</script>

<button class="option-card" style="--accent: {accentColor}" {onclick} type="button">
  {#if recommended}
    <span class="badge">Start here</span>
  {/if}
  <span class="art">
    {#if icon}
      {@render icon()}
    {:else if iconPath}
      <img src={iconPath} alt="" width="72" height="72" loading="eager" />
    {/if}
  </span>
  <span class="title">{title}</span>
  <span class="desc">{description}</span>
</button>

<style>
  .option-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 220px;
    padding: 1.75rem 1.25rem;
    border-radius: var(--radius-lg, 18px);
    border: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, var(--theme-surface, #11151f));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    text-align: center;
    transition: border-color 160ms ease, transform 160ms ease,
      background-color 160ms ease;
  }
  .option-card:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--theme-surface, #11151f));
    transform: translateY(-2px);
  }
  .option-card:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .art {
    display: grid;
    place-items: center;
    height: 80px;
  }
  .art img { object-fit: contain; }
  .title { font-size: 1.35rem; font-weight: 700; }
  .desc {
    font-size: 0.95rem;
    line-height: 1.4;
    color: var(--theme-text-muted, #9aa6b8);
    max-width: 28ch;
  }
  .badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: var(--accent);
    color: #0b0e16;
  }
  @media (prefers-reduced-motion: reduce) {
    .option-card { transition: none; }
    .option-card:hover { transform: none; }
  }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no errors in `OptionCard.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/start-here/components/OptionCard.svelte
git commit -m "feat(start-here): OptionCard decision primitive" -- src/lib/features/browse/start-here/components/OptionCard.svelte
```

---

## Task 2: Decide step + flow shell + harness wiring (first screenshot)

Wire the first decision end-to-end so it renders in the harness.

**Files:**
- Create: `src/lib/features/browse/start-here/components/DecideStep.svelte`
- Create: `src/lib/features/browse/start-here/components/StartHere.svelte`
- Modify: `src/routes/test/gallery-redesign/+page.svelte`

- [ ] **Step 1: Write `DecideStep.svelte`**

```svelte
<!-- src/lib/features/browse/start-here/components/DecideStep.svelte -->
<script lang="ts">
  import OptionCard from "./OptionCard.svelte";

  interface Props {
    onBase: () => void;
    onLoop: () => void;
  }
  let { onBase, onLoop }: Props = $props();
</script>

<div class="decide">
  <header class="intro">
    <h1>Where do you want to start?</h1>
    <p>Begin with the base movements, then see how they loop.</p>
  </header>
  <div class="cards">
    <OptionCard
      title="Base movements"
      description="The foundation — six families of timing and direction."
      accentColor="#3568a0"
      recommended
      onclick={onBase}
    />
    <OptionCard
      title="LOOPs"
      description="How the base movements repeat and transform."
      accentColor="#6a4199"
      onclick={onLoop}
    />
  </div>
</div>

<style>
  .decide {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem;
  }
  .intro { text-align: center; }
  .intro h1 { font-size: 1.9rem; font-weight: 800; margin: 0 0 0.5rem; }
  .intro p { color: var(--theme-text-muted, #9aa6b8); margin: 0; }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  @media (max-width: 560px) {
    .cards { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Write `StartHere.svelte` (shell — decide step only for now)**

```svelte
<!-- src/lib/features/browse/start-here/components/StartHere.svelte -->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/foundation/motion/durations";
  import { createStartHereState } from "../state/start-here-state.svelte";
  import DecideStep from "./DecideStep.svelte";

  const s = createStartHereState();

  interface Props {
    onBrowseAll?: () => void;
  }
  let { onBrowseAll }: Props = $props();
</script>

<div class="start-here">
  <div class="bar">
    {#if s.step !== "decide"}
      <button class="back" type="button" onclick={() => s.back()}>← Back</button>
    {/if}
    <button class="browse-all" type="button" onclick={() => onBrowseAll?.()}>
      Browse all →
    </button>
  </div>

  <Crossfade key={s.step} duration={DURATION.normal}>
    {#if s.step === "decide"}
      <DecideStep onBase={() => s.chooseBase()} onLoop={() => s.chooseLoop()} />
    {:else}
      <div class="placeholder">Step: {s.step}{s.familyId ? ` · ${s.familyId}` : ""}</div>
    {/if}
  </Crossfade>
</div>

<style>
  .start-here {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    min-height: 56px;
  }
  .back,
  .browse-all {
    background: transparent;
    border: 1px solid var(--theme-border, #2a3140);
    color: var(--theme-text, #e8edf6);
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .back:hover,
  .browse-all:hover { border-color: var(--theme-accent, #6aa0ff); }
  .back { margin-right: auto; }
  .placeholder { padding: 3rem; text-align: center; color: var(--theme-text-muted, #9aa6b8); }
</style>
```

> NOTE for the engineer: confirm `DURATION` import path with `Grep -n "export const DURATION" src/lib/shared`. If the durations module lives elsewhere, fix the import; `Crossfade` itself is at `src/lib/shared/components/Crossfade.svelte` (confirmed). If no `DURATION` token module exists, pass `duration={240}` is NOT allowed — find the token (the crossfade rule requires a `DURATION.*` token).

- [ ] **Step 3: Wire the harness**

Replace `src/routes/test/gallery-redesign/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import StartHere from "$lib/features/browse/start-here/components/StartHere.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let mode = $state<"start-here" | "browse-all">("start-here");

  const engine = createBrowseEngine({
    persistKey: null,
    initialSource: "community",
    sections: true,
    allowSourceToggle: true,
    sources: ["community", "my-library"],
  });

  onMount(() => {
    engine.initialize();
    return () => engine.destroy();
  });

  function handleSelect(_sequence: SequenceData) {}
</script>

<svelte:head><title>Gallery — Start here · test</title></svelte:head>

<div class="wrap">
  {#if mode === "start-here"}
    <StartHere onBrowseAll={() => (mode = "browse-all")} />
  {:else}
    <button class="back-to-start" type="button" onclick={() => (mode = "start-here")}>
      ← Start here
    </button>
    <BrowsePanel {engine} layout="fullpage" onSelect={handleSelect} />
  {/if}
</div>

<style>
  .wrap {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--theme-bg, #0b0e16);
    overflow: hidden;
  }
  .wrap :global(.browse-panel) { flex: 1; min-height: 0; }
  .back-to-start {
    align-self: flex-start;
    margin: 0.5rem;
    background: transparent;
    border: 1px solid var(--theme-border, #2a3140);
    color: var(--theme-text, #e8edf6);
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 4: Typecheck + screenshot verify**

Run: `npm run check:fast` (expect clean).
Then reload `https://localhost:5173/test/gallery-redesign` in the debug Chrome and screenshot. Expected: the "Where do you want to start?" decision with two `OptionCard`s ("Base movements" with a *Start here* badge, "LOOPs"), plus a "Browse all →" pill. Click "Base movements" → placeholder shows `Step: base-families`. Click "Browse all →" → real `BrowsePanel` renders.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/start-here/components/DecideStep.svelte src/lib/features/browse/start-here/components/StartHere.svelte src/routes/test/gallery-redesign/+page.svelte
git commit -m "feat(start-here): Base-vs-LOOP decide step + harness shell" -- src/lib/features/browse/start-here/components/DecideStep.svelte src/lib/features/browse/start-here/components/StartHere.svelte src/routes/test/gallery-redesign/+page.svelte
```

---

## Task 3: Element family picker (Base step)

**Files:**
- Create: `src/lib/features/browse/start-here/components/ElementFamilyPicker.svelte`
- Modify: `src/lib/features/browse/start-here/components/StartHere.svelte`

- [ ] **Step 1: Write `ElementFamilyPicker.svelte`**

```svelte
<!-- src/lib/features/browse/start-here/components/ElementFamilyPicker.svelte -->
<script lang="ts">
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";

  interface Props {
    onSelect: (familyId: string) => void;
  }
  let { onSelect }: Props = $props();
</script>

<div class="picker">
  <header class="intro">
    <h2>Pick a base family</h2>
    <p>Each element is a way the two hands move in time and direction.</p>
  </header>
  <div class="grid">
    {#each TND_ELEMENTS as fam (fam.familyId)}
      <button
        class="tile"
        type="button"
        style="--accent: {fam.accentColor}"
        onclick={() => onSelect(fam.familyId)}
      >
        <img src={fam.iconPath} alt="" width="64" height="64" loading="eager" />
        <span class="name">{fam.name}</span>
        <span class="element">{fam.element}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .picker {
    max-width: 860px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .intro { text-align: center; }
  .intro h2 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.4rem; }
  .intro p { color: var(--theme-text-muted, #9aa6b8); margin: 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.25rem 0.75rem;
    min-height: 150px;
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, var(--theme-surface, #11151f));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition: border-color 150ms ease, transform 150ms ease;
  }
  .tile:hover { border-color: var(--accent); transform: translateY(-2px); }
  .tile:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .name { font-weight: 700; }
  .element { font-size: 0.8rem; text-transform: capitalize; color: var(--theme-text-muted, #9aa6b8); }
  @media (max-width: 560px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tile { transition: none; }
    .tile:hover { transform: none; }
  }
</style>
```

- [ ] **Step 2: Render it in `StartHere.svelte`** — replace the `{:else}` placeholder branch's `base-families` case. Update the Crossfade body to:

```svelte
  <Crossfade key={s.step} duration={DURATION.normal}>
    {#if s.step === "decide"}
      <DecideStep onBase={() => s.chooseBase()} onLoop={() => s.chooseLoop()} />
    {:else if s.step === "base-families"}
      <ElementFamilyPicker onSelect={(id) => s.selectFamily(id)} />
    {:else}
      <div class="placeholder">Step: {s.step}{s.familyId ? ` · ${s.familyId}` : ""}</div>
    {/if}
  </Crossfade>
```

And add the import at the top of `StartHere.svelte`:

```ts
  import ElementFamilyPicker from "./ElementFamilyPicker.svelte";
```

- [ ] **Step 3: Typecheck + screenshot verify**

Run: `npm run check:fast` (clean).
Reload harness → click "Base movements" → expect six elemental tiles (Water/Earth/Sun/Fire/Air/Moon) with their icons + accent colors in a 3-col grid. Click a tile → placeholder shows `Step: base-cards · <familyId>`. Back button returns to the families. Screenshot the six-tile grid.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/start-here/components/ElementFamilyPicker.svelte src/lib/features/browse/start-here/components/StartHere.svelte
git commit -m "feat(start-here): six-element family picker" -- src/lib/features/browse/start-here/components/ElementFamilyPicker.svelte src/lib/features/browse/start-here/components/StartHere.svelte
```

---

## Task 4: Family cards (the payoff — real pictographs per element)

**Files:**
- Create: `src/lib/features/browse/start-here/components/FamilyCardRow.svelte`
- Modify: `src/lib/features/browse/start-here/components/StartHere.svelte`

- [ ] **Step 1: Write `FamilyCardRow.svelte`**

`resolveTnDFamilyCards(familyId)` returns `SeedMatrix[]`, each with `.byTurn: Map<string, SequenceData>`. For the row, take the base (zero-turn) variation per seed: prefer the `"0|0"` key, else the first map value. Render via the real card in the shared carousel.

```svelte
<!-- src/lib/features/browse/start-here/components/FamilyCardRow.svelte -->
<script lang="ts">
  import HorizontalSwipeContainer from "$lib/shared/foundation/ui/HorizontalSwipeContainer.svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import { resolveTnDFamilyCards } from "$lib/features/lab/vtg-lab/services/resolve-tnd-family-cards";
  import { getTnDElement } from "$lib/features/choreo-card/domain/tnd-element";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    familyId: string;
  }
  let { familyId }: Props = $props();

  const element = $derived(getTnDElement(familyId));

  let cards = $state<SequenceData[]>([]);
  let loading = $state(true);

  $effect(() => {
    const id = familyId;
    loading = true;
    cards = [];
    let cancelled = false;
    resolveTnDFamilyCards(id)
      .then((seedMatrices) => {
        if (cancelled) return;
        cards = seedMatrices
          .map((m) => m.byTurn.get("0|0") ?? m.byTurn.values().next().value)
          .filter((s): s is SequenceData => Boolean(s));
        loading = false;
      })
      .catch(() => {
        if (cancelled) return;
        cards = [];
        loading = false;
      });
    return () => { cancelled = true; };
  });
</script>

<section class="family">
  <header class="head" style="--accent: {element?.accentColor ?? '#6aa0ff'}">
    <h2>{element?.name ?? familyId}</h2>
    <span class="sub">{element?.element ?? ""} · base movements</span>
  </header>

  {#if loading}
    <div class="state">Loading {element?.name ?? familyId}…</div>
  {:else if cards.length === 0}
    <div class="state">No base cards for this family yet.</div>
  {:else}
    <HorizontalSwipeContainer height="320px" showArrows showIndicators={false}>
      {#each cards as card (card.id)}
        <div class="embla__slide slide">
          <ChoreoCardThumbnail sequence={card} eager addWord />
        </div>
      {/each}
    </HorizontalSwipeContainer>
  {/if}
</section>

<style>
  .family { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 1.25rem; }
  .head { text-align: center; }
  .head h2 { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--accent); }
  .sub { color: var(--theme-text-muted, #9aa6b8); text-transform: capitalize; }
  .state { padding: 2.5rem; text-align: center; color: var(--theme-text-muted, #9aa6b8); }
  .slide { flex: 0 0 240px; padding: 0 0.5rem; }
</style>
```

> NOTE: Verify the `SeedMatrix.byTurn` key for the zero-turn base. The Explore reference says keys look like `"0|0".."3|3"`. If `"0|0"` is absent, the `?? values().next().value` fallback covers it. Confirm by logging `[...seedMatrices[0].byTurn.keys()]` once during screenshot verify; if the zero-turn key differs, set it explicitly.

- [ ] **Step 2: Render it in `StartHere.svelte`** — add the `base-cards` branch and import:

```ts
  import FamilyCardRow from "./FamilyCardRow.svelte";
```

```svelte
    {:else if s.step === "base-cards" && s.familyId}
      <FamilyCardRow familyId={s.familyId} />
```

(Place it before the final `{:else}` placeholder.)

- [ ] **Step 3: Typecheck + screenshot verify**

Run: `npm run check:fast` (clean).
Reload harness → Base movements → click "Water" (Split-Same) → expect real pictograph `ChoreoCardThumbnail`s in a swipeable row under a "Split-Same" heading. Try two more elements. Screenshot the rendered cards. Confirm the cards are the REAL thumbnails (no fake name/level/favorites chrome).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/start-here/components/FamilyCardRow.svelte src/lib/features/browse/start-here/components/StartHere.svelte
git commit -m "feat(start-here): family cards from canonical TnD decks" -- src/lib/features/browse/start-here/components/FamilyCardRow.svelte src/lib/features/browse/start-here/components/StartHere.svelte
```

---

## Task 5: LOOP branch (types → cards)

The LOOP track. Reuse `OptionCard` for the type list. Cards come from the engine filtered by `loopType` (the community `loopType` lens works today). For Phase 1, source LOOP-type examples from the same `BrowseEngine` the harness already builds, filtered client-side by `loopType`.

**Files:**
- Create: `src/lib/features/browse/start-here/components/LoopTypePicker.svelte`
- Create: `src/lib/features/browse/start-here/components/LoopCardRow.svelte`
- Modify: `src/lib/features/browse/start-here/components/StartHere.svelte`

- [ ] **Step 1: Write `LoopTypePicker.svelte`** (the five teachable transformation types)

```svelte
<!-- src/lib/features/browse/start-here/components/LoopTypePicker.svelte -->
<script lang="ts">
  import OptionCard from "./OptionCard.svelte";

  interface LoopOption { type: string; title: string; description: string; accent: string; }
  const OPTIONS: LoopOption[] = [
    { type: "rotated", title: "Rotated", description: "Positions keep turning the same way.", accent: "#ffde17" },
    { type: "mirrored", title: "Mirrored", description: "Left and right swap across the vertical.", accent: "#3568a0" },
    { type: "swapped", title: "Swapped", description: "Blue and red hands trade roles.", accent: "#f2673a" },
    { type: "inverted", title: "Inverted", description: "Pro and anti motions flip.", accent: "#75A874" },
    { type: "flipped", title: "Flipped", description: "Top and bottom swap across the horizontal.", accent: "#6a4199" },
  ];

  interface Props { onSelect: (type: string) => void; }
  let { onSelect }: Props = $props();
</script>

<div class="picker">
  <header class="intro">
    <h2>Pick a LOOP type</h2>
    <p>Each is a way a base movement repeats and transforms.</p>
  </header>
  <div class="grid">
    {#each OPTIONS as o (o.type)}
      <OptionCard title={o.title} description={o.description} accentColor={o.accent} onclick={() => onSelect(o.type)} />
    {/each}
  </div>
</div>

<style>
  .picker { max-width: 920px; margin: 0 auto; padding: 1.5rem 1.25rem; display: flex; flex-direction: column; gap: 1.5rem; }
  .intro { text-align: center; }
  .intro h2 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.4rem; }
  .intro p { color: var(--theme-text-muted, #9aa6b8); margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  @media (max-width: 560px) { .grid { grid-template-columns: 1fr 1fr; } }
</style>
```

- [ ] **Step 2: Write `LoopCardRow.svelte`** (filter the engine's sequences by `loopType`)

```svelte
<!-- src/lib/features/browse/start-here/components/LoopCardRow.svelte -->
<script lang="ts">
  import HorizontalSwipeContainer from "$lib/shared/foundation/ui/HorizontalSwipeContainer.svelte";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    loopType: string;
    /** All loaded community sequences (from the harness engine). */
    pool: readonly SequenceData[];
  }
  let { loopType, pool }: Props = $props();

  const cards = $derived(
    pool.filter((s) => (s.loopType ?? "").toLowerCase() === loopType.toLowerCase()).slice(0, 24)
  );
</script>

<section class="loop">
  <header class="head"><h2>{loopType}</h2></header>
  {#if cards.length === 0}
    <div class="state">No {loopType} examples loaded.</div>
  {:else}
    <HorizontalSwipeContainer height="320px" showArrows showIndicators={false}>
      {#each cards as card (card.id)}
        <div class="embla__slide slide">
          <ChoreoCardThumbnail sequence={card} eager addWord />
        </div>
      {/each}
    </HorizontalSwipeContainer>
  {/if}
</section>

<style>
  .loop { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 1.25rem; }
  .head { text-align: center; }
  .head h2 { margin: 0; font-size: 1.5rem; font-weight: 800; text-transform: capitalize; }
  .state { padding: 2.5rem; text-align: center; color: var(--theme-text-muted, #9aa6b8); }
  .slide { flex: 0 0 240px; padding: 0 0.5rem; }
</style>
```

- [ ] **Step 3: Thread the engine pool into `StartHere.svelte`.** Add a `pool` prop and the two LOOP branches:

```ts
  import LoopTypePicker from "./LoopTypePicker.svelte";
  import LoopCardRow from "./LoopCardRow.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
```

Add to `Props`: `pool?: readonly SequenceData[];` and default `let { onBrowseAll, pool = [] }: Props = $props();`

Add branches inside the Crossfade:

```svelte
    {:else if s.step === "loop-types"}
      <LoopTypePicker onSelect={(t) => s.selectLoopType(t)} />
    {:else if s.step === "loop-cards" && s.loopType}
      <LoopCardRow loopType={s.loopType} {pool} />
```

In the harness `+page.svelte`, pass the engine's sequences: `<StartHere onBrowseAll={...} pool={engine.sequences} />`.

- [ ] **Step 4: Typecheck + screenshot verify**

Run: `npm run check:fast` (clean).
Reload harness → "LOOPs" → five type cards → click "Rotated" → expect real cards whose `loopType` is rotated. (If a type shows "No examples loaded", that's expected when the community pool lacks that type — note it, don't force it.) Screenshot the LOOP types screen and one populated row.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/start-here/components/LoopTypePicker.svelte src/lib/features/browse/start-here/components/LoopCardRow.svelte src/lib/features/browse/start-here/components/StartHere.svelte src/routes/test/gallery-redesign/+page.svelte
git commit -m "feat(start-here): LOOP type branch" -- src/lib/features/browse/start-here/components/LoopTypePicker.svelte src/lib/features/browse/start-here/components/LoopCardRow.svelte src/lib/features/browse/start-here/components/StartHere.svelte src/routes/test/gallery-redesign/+page.svelte
```

---

## Task 6: Cut Props/Hands + Left/Right from BrowseToolbar

**Files:**
- Modify: `src/lib/shared/browse/components/BrowseToolbar.svelte` (and read `ViewModeToggle` usage first)

- [ ] **Step 1: Locate the toggle**

Run: `Grep -n "ViewMode|Props|Hands|viewMode" src/lib/shared/browse/components/BrowseToolbar.svelte` and read the surrounding block. Identify the `ViewModeToggle` (Props/Hands) and the Left/Right control markup.

- [ ] **Step 2: Remove only the toggle UI**

Delete the `ViewModeToggle` element and the Left/Right control from the toolbar template, plus the now-unused import. Do NOT remove the engine's `viewMode` capability — only the toolbar UI. If other toolbar code references the removed import, remove just those references. Keep everything else (source toggle handled separately, sort, Level, Favorites, Length, LOOP, search) intact.

- [ ] **Step 3: Full typecheck (cross-file — this touches a shared component)**

Run: `npm run check > /tmp/check.log 2>&1` then `grep -niE "error" /tmp/check.log`
Expected: no new errors. Fix any reference left dangling by the removal, re-run once.

- [ ] **Step 4: Screenshot verify**

Reload harness → "Browse all →" → confirm the toolbar no longer shows Props/Hands or Left/Right; all other controls remain. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/browse/components/BrowseToolbar.svelte
git commit -m "feat(browse): remove Props/Hands + Left/Right from toolbar" -- src/lib/shared/browse/components/BrowseToolbar.svelte
```

---

## Task 7: Point the real Gallery at "Start here" (nav wiring)

Production nav change — make the Gallery destination open `StartHere`, with "Browse all" reachable. Build the real gallery route/host that mirrors the harness.

**Files:**
- Read first: `src/lib/features/browse/shared/components/GalleryTab.svelte`, `src/lib/shared/navigation/config/tab-definitions.ts`, the gallery route under `src/routes/`.
- Modify: the gallery host so it renders `StartHere` by default and `GalleryTab`/`BrowsePanel` for "Browse all".

- [ ] **Step 1: Read the current gallery entry** — find where `GalleryTab` is mounted in the real app (route or module host). Determine the smallest seam to render `StartHere` first and reveal `GalleryTab` on "Browse all".

- [ ] **Step 2: Wrap the gallery entry**

Create `src/lib/features/browse/start-here/components/GalleryEntry.svelte` that mirrors the harness logic but uses the real engine config (from `BrowseModule`: `persistKey: "tka-browse-gallery"`, `initialSource: "community"`, `sections: true`, `allowSourceToggle: true`, `sources: ["community","my-library"]`) and renders `GalleryTab` (the real one, with mobile sheets) for "Browse all":

```svelte
<!-- src/lib/features/browse/start-here/components/GalleryEntry.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import StartHere from "./StartHere.svelte";
  import GalleryTab from "$lib/features/browse/shared/components/GalleryTab.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";

  let mode = $state<"start-here" | "browse-all">("start-here");
  const engine = createBrowseEngine({
    persistKey: "tka-browse-gallery",
    initialSource: "community",
    sections: true,
    allowSourceToggle: true,
    sources: ["community", "my-library"],
  });
  onMount(() => { engine.initialize(); return () => engine.destroy(); });
</script>

{#if mode === "start-here"}
  <StartHere onBrowseAll={() => (mode = "browse-all")} pool={engine.sequences} />
{:else}
  <GalleryTab {engine} />
{/if}
```

> NOTE: confirm `GalleryTab`'s actual prop contract by reading it (it may construct its own engine). If `GalleryTab` owns its engine, drop the `engine` prop here and let it self-manage; pass `pool` to `StartHere` from a lightweight second engine or defer the LOOP pool to Phase 2. Resolve this by reading `GalleryTab.svelte` before wiring — do not guess.

- [ ] **Step 3: Mount `GalleryEntry` where `GalleryTab` was** in the real gallery route/host (the seam found in Step 1).

- [ ] **Step 4: Full typecheck**

Run: `npm run check > /tmp/check.log 2>&1` then `grep -niE "error" /tmp/check.log` — clean.

- [ ] **Step 5: Screenshot verify the real route**

Navigate the debug Chrome to the real gallery destination (not the harness) and confirm `StartHere` opens by default, "Browse all →" reveals the real gallery, and the auth-coupled `GalleryTab` still works. Screenshot.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/browse/start-here/components/GalleryEntry.svelte <the-host-file-modified>
git commit -m "feat(browse): gallery opens Start here, Browse all behind CTA" -- src/lib/features/browse/start-here/components/GalleryEntry.svelte <the-host-file-modified>
```

---

## Self-Review (against the spec)

**Spec coverage:**
- Two front doors → Tasks 2 (decide), 6–7 (Browse all + nav). ✓
- First decision Base-vs-LOOP, base-first → Task 2 (recommended badge on Base). ✓
- Six elemental family tiles → Task 3. ✓
- Family cards from canonical decks → Task 4 (`resolveTnDFamilyCards`). ✓
- LOOP types via classification/`loopType` → Task 5 (uses the community `loopType` lens directly; `LOOPDetector` reserved for Phase 2 backfill). ✓
- Cut Props/Hands + Left/Right → Task 6. ✓
- Nav: Gallery→Start here, Browse all opt-in → Task 7. ✓ (My Library as its own top-level destination is a separate nav task — **deferred to a Phase 1 follow-up**, flagged below.)
- Reuse table honored: `TND_ELEMENTS`, `resolveTnDFamilyCards`, `ChoreoCardThumbnail`, `HorizontalSwipeContainer`, `Crossfade`. ✓

**Known gaps / deferrals (intentional):**
- **My Library as its own top-level nav destination** — not in these 7 tasks; it's a `tab-definitions`/`guest-access` change independent of Start-here. Add as Task 8 in a follow-up once Start-here is verified, OR fold into Task 7's nav pass. Flagged so it isn't silently dropped.
- **Engagement-signal secondary sort** within a family (easy/popular/fresh) — Phase 1 shows the family's base cards unsorted; the secondary sort is a small follow-up, not blocking.
- **Phase 2** (backfill `tndFamily` onto community sequences; LOOP cards from a dedicated source) and **Phase 3** (animated cards) are separate plans.

**Placeholder scan:** none — every component has full code. The two `NOTE` blocks (DURATION import path, `byTurn` key, GalleryTab engine ownership) are explicit "read-this-file-to-confirm" instructions, not deferred work.

**Type consistency:** `familyId: string`, `loopType: string`, `SequenceData` used consistently across state + components; `resolveTnDFamilyCards` returns `SeedMatrix[]` with `.byTurn: Map<string, SequenceData>` (Task 4 matches the Explore reference).
