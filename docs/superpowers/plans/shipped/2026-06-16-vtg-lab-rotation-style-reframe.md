# VTG Lab Rotation-Style Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the VTG Lab Explorer into three rotation-style matrices (ISO / ANTISPIN / HYBRID), each a 7×7 turn grid of mandalas, with a per-cell variation picker that opens a letter's full card.

**Architecture:** A pure classifier buckets base seeds by prop spin (pro/anti → iso/antispin/hybrid). An adapter resolves, per style, a representative seed's 49 turn mandalas plus the deduped variation list. A new `RotationStyleExplorer` (adapted from the existing gallery) renders three glass panels; clicking a cell opens a `VariationPicker` that resolves the chosen letter at that turn pattern into `CardInspectModal`. The 6 mode chips, `ModeSelector`, `ModeExplorer`, and `VtgModeMatrix` are retired.

**Tech Stack:** Svelte 5 runes, Vitest, the existing choreo-card turn-resolve pipeline.

Spec: `docs/superpowers/specs/2026-06-16-vtg-lab-rotation-style-reframe-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/features/lab/vtg-lab/domain/classify-rotation-style.ts` | Bucket a sequence by prop spin | Create |
| `src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts` | Classifier tests | Create |
| `src/lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices.ts` | Load seeds → 3 style matrices + variations; resolve one variation | Create |
| `src/lib/features/lab/vtg-lab/components/RotationStyleExplorer.svelte` | 3 glass panels of 7×7 mandalas | Create |
| `src/lib/features/lab/vtg-lab/components/VariationPicker.svelte` | Letter picker → CardInspectModal | Create |
| `src/lib/features/lab/vtg-lab/VtgLabModule.svelte` | Explorer tab → RotationStyleExplorer | Modify |
| `src/lib/features/lab/vtg-lab/components/ModeSelector.svelte` | Retire | Delete |
| `src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte` | Retire | Delete |
| `src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte` | Retire | Delete |

`vtg-sequence-data.ts`, `vtg-pattern-data.ts`, `RosettaPanel.svelte` are untouched (Rosetta tab). `tnd-turn-patterns.ts` (`allTurnPatterns`, `groupCardsBySeed`, `SeedMatrix`) is reused.

---

## Task 1: classifyRotationStyle (pure)

**Files:**
- Create: `src/lib/features/lab/vtg-lab/domain/classify-rotation-style.ts`
- Test: `src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifyRotationStyle } from "../classify-rotation-style";

// Minimal sequence shape: steps with blue/red motions carrying a motionType.
function seq(pairs: Array<[string, string]>): any {
  return {
    steps: pairs.map(([blue, red]) => ({
      isBlank: false,
      motions: { blue: { motionType: blue }, red: { motionType: red } },
    })),
  };
}

describe("classifyRotationStyle", () => {
  it("both pro → iso", () => {
    expect(classifyRotationStyle(seq([["static", "static"], ["pro", "pro"]]))).toBe("iso");
  });
  it("both anti → antispin", () => {
    expect(classifyRotationStyle(seq([["anti", "anti"]]))).toBe("antispin");
  });
  it("one pro one anti → hybrid", () => {
    expect(classifyRotationStyle(seq([["pro", "anti"]]))).toBe("hybrid");
  });
  it("uses prefloatMotionType when a hand floats", () => {
    const s = {
      steps: [{ isBlank: false, motions: { blue: { motionType: "float", prefloatMotionType: "anti" }, red: { motionType: "anti" } } }],
    } as any;
    expect(classifyRotationStyle(s)).toBe("antispin");
  });
  it("skips non-rotating (static/dash) steps; falls back to hybrid if none rotate", () => {
    expect(classifyRotationStyle(seq([["static", "static"], ["dash", "dash"]]))).toBe("hybrid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts`
Expected: FAIL — "Failed to resolve import ../classify-rotation-style".

- [ ] **Step 3: Write the implementation**

`src/lib/features/lab/vtg-lab/domain/classify-rotation-style.ts`:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { MotionColor, MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type RotationStyle = "iso" | "antispin" | "hybrid";

/** Effective prop spin of one hand: float resolves to its prefloat pro/anti. */
function spin(motion: { motionType?: string; prefloatMotionType?: string } | undefined): "pro" | "anti" | null {
  if (!motion) return null;
  const t = motion.motionType === MotionType.FLOAT ? motion.prefloatMotionType : motion.motionType;
  if (t === MotionType.PRO) return "pro";
  if (t === MotionType.ANTI) return "anti";
  return null; // static / dash / unknown — not a rotating shift
}

/**
 * Bucket a sequence by prop rotation style — what actually drives the mandala.
 * Reads the first step whose two hands both rotate (pro/anti). Both pro → iso,
 * both anti → antispin, mixed → hybrid. (VTG mode / hand arc is irrelevant here;
 * see tnd-deriver.ts — A/B/C share hand paths but differ in prop spin.)
 */
export function classifyRotationStyle(seq: SequenceData): RotationStyle {
  for (const step of seq.steps) {
    if ((step as { isBlank?: boolean }).isBlank) continue;
    const motions = step.motions as Partial<Record<string, { motionType?: string; prefloatMotionType?: string }>>;
    const b = spin(motions[MotionColor.BLUE]);
    const r = spin(motions[MotionColor.RED]);
    if (!b || !r) continue;
    if (b === "pro" && r === "pro") return "iso";
    if (b === "anti" && r === "anti") return "antispin";
    return "hybrid";
  }
  return "hybrid";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/vtg-lab/domain/classify-rotation-style.ts src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts
git commit -m "feat(vtg-lab): classify a sequence by prop rotation style" -- src/lib/features/lab/vtg-lab/domain/classify-rotation-style.ts src/lib/features/lab/vtg-lab/domain/__tests__/classify-rotation-style.test.ts
```

---

## Task 2: resolveRotationStyleMatrices adapter

**Files:**
- Create: `src/lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices.ts`

IO-bound (Firestore); verified at runtime in Task 6. Mirrors `resolve-tnd-family-cards.ts` but groups by rotation style and also returns the variation list + an on-demand single-variation resolver.

- [ ] **Step 1: Write the implementation**

`src/lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices.ts`:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { TND_BASE_CATALOG_ID } from "$lib/features/choreo-card/services/deck-composer";
import { loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { deriveTnDFromPictograph } from "$lib/shared/pictograph/shared/domain/utils/tnd-deriver";
import { classifyRotationStyle, type RotationStyle } from "../domain/classify-rotation-style";
import { allTurnPatterns } from "../domain/tnd-turn-patterns";

export interface StyleVariation {
  word: string; // e.g. "DJDJ"
  modeTag: string; // VTG mode, e.g. "SS"
  seedId: string;
}

export interface RotationStyleMatrix {
  style: RotationStyle;
  label: string;
  accent: string;
  /** Representative mandala per turn pattern, for the 7×7 cells. */
  byTurn: Map<string, SequenceData>;
  variations: StyleVariation[];
}

const STYLE_META: Record<RotationStyle, { label: string; accent: string }> = {
  iso: { label: "Isolation", accent: "#22d3ee" },
  antispin: { label: "Antispin", accent: "#f87171" },
  hybrid: { label: "Hybrid", accent: "#b763cd" },
};

const STYLE_ORDER: RotationStyle[] = ["iso", "antispin", "hybrid"];

function word(seedId: string): string {
  return (seedId.split("-").pop() ?? seedId).toUpperCase();
}

// Module-level cache: base seeds load once; the picker reuses them per pick.
let basesPromise: Promise<SequenceData[]> | null = null;
function loadBases(): Promise<SequenceData[]> {
  if (!basesPromise) basesPromise = loadCatalogSequences(TND_BASE_CATALOG_ID);
  return basesPromise;
}

/** Build the three rotation-style matrices from the base catalog. */
export async function resolveRotationStyleMatrices(): Promise<RotationStyleMatrix[]> {
  const bases = await loadBases();
  const edges = await loadDiamondEdges();
  const patterns = allTurnPatterns();

  const byStyle = new Map<RotationStyle, SequenceData[]>();
  for (const s of bases) {
    const style = classifyRotationStyle(s);
    if (!byStyle.has(style)) byStyle.set(style, []);
    byStyle.get(style)!.push(s);
  }

  const out: RotationStyleMatrix[] = [];
  for (const style of STYLE_ORDER) {
    const seeds = byStyle.get(style) ?? [];
    if (seeds.length === 0) continue;
    const rep = seeds[0]!; // any member renders the style's fingerprint

    const byTurn = new Map<string, SequenceData>();
    for (const tp of patterns) {
      byTurn.set(tp, applyVariationDescriptor(rep, { turnPattern: tp, turnLabel: tp } as any, edges).sequence);
    }

    const seen = new Set<string>();
    const variations: StyleVariation[] = [];
    for (const s of seeds) {
      const w = word(s.id);
      if (seen.has(w)) continue;
      seen.add(w);
      const { tndMode } = deriveTnDFromPictograph(s.steps.find((st) => !(st as { isBlank?: boolean }).isBlank) ?? s.steps[0]!);
      variations.push({ word: w, modeTag: tndMode ?? "", seedId: s.id });
    }

    out.push({ style, ...STYLE_META[style], byTurn, variations });
  }
  return out;
}

/** Resolve one variation's sequence at a turn pattern (for the picker → card). */
export async function resolveVariationSequence(seedId: string, turnPattern: string): Promise<SequenceData | null> {
  const bases = await loadBases();
  const base = bases.find((s) => s.id === seedId);
  if (!base) return null;
  const edges = await loadDiamondEdges();
  return applyVariationDescriptor(base, { turnPattern, turnLabel: turnPattern } as any, edges).sequence;
}
```

> Note: `deriveTnDFromPictograph` takes one pictograph/step and returns `{ tndMode }`
> (see `tnd-deriver.ts` — used the same way by `deck-composer.classifyTnDSeedForGrid`).
> `applyVariationDescriptor(base, variation, edges)` returns `{ sequence, turnLoopClosed }`
> (see `deck-variation.ts:276`).

- [ ] **Step 2: Type-check**

Run: `npm run check:fast 2>&1 | grep -i "resolve-rotation-style-matrices" || echo "clean"`
Expected: `clean`. If `deriveTnDFromPictograph`'s argument type complains, pass the step directly (it accepts a `PictographData`/`StepData`); read `tnd-deriver.ts` for the exact parameter type and adjust.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices.ts
git commit -m "feat(vtg-lab): adapter resolving the 3 rotation-style matrices + variations" -- src/lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices.ts
```

---

## Task 3: VariationPicker

**Files:**
- Create: `src/lib/features/lab/vtg-lab/components/VariationPicker.svelte`

A lightweight overlay: given a style's variations + the clicked turn pattern, list the
letters (mode-tagged); on pick, resolve the sequence and open `CardInspectModal`.

- [ ] **Step 1: Create the component**

`src/lib/features/lab/vtg-lab/components/VariationPicker.svelte`:

```svelte
<script lang="ts">
  import CardInspectModal from "$lib/features/choreo-card/components/CardInspectModal.svelte";
  import { resolveVariationSequence, type StyleVariation } from "../services/resolve-rotation-style-matrices";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    variations: StyleVariation[];
    turnPattern: string; // "blue|red"
    accent: string;
    onClose: () => void;
  }
  const { variations, turnPattern, accent, onClose }: Props = $props();

  let inspected = $state<SequenceData | null>(null);
  let busy = $state<string | null>(null);

  async function pick(v: StyleVariation) {
    busy = v.seedId;
    try {
      const seq = await resolveVariationSequence(v.seedId, turnPattern);
      if (seq) inspected = seq;
    } finally {
      busy = null;
    }
  }
</script>

{#if !inspected}
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close variation picker"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div class="sheet" style="--accent: {accent};" role="dialog" aria-label="Pick a variation" onclick={(e) => e.stopPropagation()}>
      <header>
        <span class="turns">Blue {turnPattern.split("|")[0]} · Red {turnPattern.split("|")[1]} turns</span>
        <button class="x" onclick={onClose} aria-label="Close"><i class="fas fa-xmark"></i></button>
      </header>
      <div class="grid">
        {#each variations as v (v.seedId)}
          <button class="chip" class:busy={busy === v.seedId} onclick={() => pick(v)}>
            <span class="word">{v.word}</span>
            {#if v.modeTag}<span class="tag">{v.modeTag}</span>{/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <CardInspectModal sequence={inspected} onClose={onClose} />
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(4, 12, 18, 0.6); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .sheet {
    width: min(440px, 92vw);
    background: rgba(16, 28, 38, 0.96);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, rgba(255, 255, 255, 0.1));
    border-radius: 16px; padding: 1rem 1.1rem 1.25rem;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
  }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
  .turns { font-size: 0.85rem; font-weight: 600; color: #cfe6f2; font-variant-numeric: tabular-nums; }
  .x { border: none; background: transparent; color: rgba(255, 255, 255, 0.5); cursor: pointer; font-size: 1rem; padding: 0.25rem; }
  .x:hover { color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.55rem; }
  .chip {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    padding: 0.6rem 0.4rem; min-height: 44px; cursor: pointer;
    border-radius: 10px; border: 1px solid color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.08));
    background: color-mix(in srgb, var(--accent) 10%, transparent); color: #fff;
    transition: transform 0.1s ease, background 0.12s ease;
  }
  .chip:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .chip.busy { opacity: 0.5; pointer-events: none; }
  .word { font-weight: 700; letter-spacing: 0.05em; }
  .tag { font-size: 0.7rem; opacity: 0.65; }
  @media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check:fast 2>&1 | grep -i "VariationPicker" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/vtg-lab/components/VariationPicker.svelte
git commit -m "feat(vtg-lab): variation picker resolving a letter to its card" -- src/lib/features/lab/vtg-lab/components/VariationPicker.svelte
```

---

## Task 4: RotationStyleExplorer

**Files:**
- Create: `src/lib/features/lab/vtg-lab/components/RotationStyleExplorer.svelte`

Adapted from the retired `VtgModeMatrix` gallery — same glass/axis/diagonal/bloom, but
3 rotation-style panels (own accent per style) and cell click opens the picker.

- [ ] **Step 1: Create the component**

`src/lib/features/lab/vtg-lab/components/RotationStyleExplorer.svelte`:

```svelte
<script lang="ts">
  import TurnMatrixGrid from "$lib/features/choreo-card/components/TurnMatrixGrid.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import VariationPicker from "./VariationPicker.svelte";
  import { resolveRotationStyleMatrices, type RotationStyleMatrix, type StyleVariation } from "../services/resolve-rotation-style-matrices";

  let matrices = $state<RotationStyleMatrix[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Open picker context (null = closed).
  let picker = $state<{ variations: StyleVariation[]; turnPattern: string; accent: string } | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    resolveRotationStyleMatrices()
      .then((res) => (matrices = res))
      .catch((e) => (error = e instanceof Error ? e.message : "Failed to load"))
      .finally(() => (loading = false));
  });

  function turnKey(blue: number, red: number): string {
    const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    return `${f(blue)}|${f(red)}`;
  }
</script>

<div class="explorer">
  <p class="intro">
    The mandala is set by <strong>prop rotation</strong> and turns — not the VTG mode. These three are
    every fingerprint there is; pick a cell to choose which letter wears it.
  </p>

  {#if loading}
    <div class="status" role="status">Loading sequences…</div>
  {:else if error}
    <div class="status err" role="alert"><i class="fas fa-triangle-exclamation"></i> {error}</div>
  {:else}
    <div class="axis-key" aria-hidden="true">
      <span class="ak blue"><i class="fas fa-arrow-down"></i> Blue turns</span>
      <span class="scale">0 · 0.5 · 1 · 1.5 · 2 · 2.5 · 3</span>
      <span class="ak red">Red turns <i class="fas fa-arrow-right"></i></span>
    </div>
    <div class="panels">
      {#each matrices as m (m.style)}
        <section class="panel" style="--accent: {m.accent};">
          <h3><span class="dot"></span>{m.label}</h3>
          <TurnMatrixGrid ariaLabel="{m.label} turn matrix" showAxes={false}>
            {#snippet cell(blue: number, red: number)}
              {@const seq = m.byTurn.get(turnKey(blue, red))}
              {#if seq}
                <button
                  type="button"
                  class="cell"
                  class:diag={blue === red}
                  style="--bloom: {(blue + red) / 6};"
                  aria-label="{m.label} blue {blue} red {red} — pick a letter"
                  onclick={() => (picker = { variations: m.variations, turnPattern: turnKey(blue, red), accent: m.accent })}
                >
                  <SequenceMandala sequence={seq} mode="gallery" show="both" size={120} darkMode />
                </button>
              {:else}
                <div class="empty" aria-label="No sequence for {blue}|{red}"></div>
              {/if}
            {/snippet}
          </TurnMatrixGrid>
        </section>
      {/each}
    </div>
  {/if}
</div>

{#if picker}
  <VariationPicker
    variations={picker.variations}
    turnPattern={picker.turnPattern}
    accent={picker.accent}
    onClose={() => (picker = null)}
  />
{/if}

<style>
  .explorer { display: flex; flex-direction: column; gap: 1rem; }
  .intro { margin: 0; font-size: var(--font-size-min, 14px); color: var(--theme-text-secondary, #9fb2bd); max-width: 60ch; }
  .intro strong { color: var(--theme-text, #fff); }
  .status { padding: 2rem; text-align: center; color: var(--theme-text-secondary, #888); font-size: var(--font-size-min, 14px); }
  .status.err { color: #fbbf24; }

  .axis-key { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; font-size: var(--font-size-compact, 12px); color: var(--theme-text-secondary, #888); }
  .ak { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; }
  .ak.blue { color: #60a5fa; }
  .ak.red { color: #f87171; }
  .scale { font-variant-numeric: tabular-nums; opacity: 0.7; letter-spacing: 0.04em; }

  .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; align-items: start; }
  .panel {
    display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; padding: 0.9rem; border-radius: 16px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid color-mix(in srgb, var(--accent) 32%, rgba(255, 255, 255, 0.08));
    box-shadow: 0 2px 24px color-mix(in srgb, var(--accent) 12%, transparent);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }
  .panel h3 { display: flex; align-items: center; gap: 0.45rem; margin: 0; font-size: var(--font-size-min, 14px); font-weight: 700; letter-spacing: 0.08em; color: var(--theme-text, #fff); }
  .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 70%, transparent); flex-shrink: 0; }

  .cell {
    width: 100%; aspect-ratio: 1; padding: 2px; border: none; background: transparent; cursor: pointer;
    border-radius: clamp(4px, 1cqi, 8px); transition: transform 0.12s ease, background 0.12s ease;
    display: flex; align-items: center; justify-content: center;
  }
  .cell :global(svg) { width: 100%; height: 100%; filter: drop-shadow(0 0 calc(var(--bloom, 0) * 7px) color-mix(in srgb, var(--accent) calc(var(--bloom, 0) * 55%), transparent)); }
  .cell.diag { background: radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }
  .cell:hover { transform: scale(1.1); background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .cell:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 1px; }
  @media (prefers-reduced-motion: reduce) { .cell { transition: none; } }
  .empty { width: 100%; aspect-ratio: 1; border-radius: clamp(4px, 1cqi, 8px); background: rgba(255, 255, 255, 0.012); }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npm run check:fast 2>&1 | grep -i "RotationStyleExplorer" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/vtg-lab/components/RotationStyleExplorer.svelte
git commit -m "feat(vtg-lab): rotation-style explorer with 3 mandala matrices" -- src/lib/features/lab/vtg-lab/components/RotationStyleExplorer.svelte
```

---

## Task 5: Wire VtgLabModule, retire the mode-organized path

**Files:**
- Modify: `src/lib/features/lab/vtg-lab/VtgLabModule.svelte`
- Delete: `ModeSelector.svelte`, `ModeExplorer.svelte`, `VtgModeMatrix.svelte`

- [ ] **Step 1: Swap the Explorer tab**

Read `src/lib/features/lab/vtg-lab/VtgLabModule.svelte`. In the script:
- Replace the `import ModeSelector …` and `import ModeExplorer …` lines with:
  `import RotationStyleExplorer from "./components/RotationStyleExplorer.svelte";`
- Delete the `MODE_STORAGE_KEY`, `getInitialMode`, `selectedMode`, `activeModeGroup` declarations and the `$effect` that persists `selectedMode` (keep the tab-persistence effect and `RosettaPanel`/`activeTab` logic). Remove the now-unused `VTG_MODE_INFO`/`VTG_MODE_GROUPS`/`VTGMode` imports if they were only used by those.

In the template, replace the explorer branch:
```svelte
{#if activeTab === "explorer"}
  <ModeSelector {selectedMode} onSelect={(mode) => (selectedMode = mode)} />
  <ModeExplorer modeGroup={activeModeGroup} />
{:else if activeTab === "rosetta"}
```
with:
```svelte
{#if activeTab === "explorer"}
  <RotationStyleExplorer />
{:else if activeTab === "rosetta"}
```

- [ ] **Step 2: Delete the retired components**

```bash
git rm src/lib/features/lab/vtg-lab/components/ModeSelector.svelte src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte
```

- [ ] **Step 3: Confirm no dangling imports**

Run: `grep -rnE "ModeSelector|ModeExplorer|VtgModeMatrix" src/ || echo "no refs"`
Expected: `no refs`.

- [ ] **Step 4: Type-check**

Run: `npm run check:fast > /tmp/t5.log 2>&1; grep -iE "VtgLabModule|RotationStyleExplorer" /tmp/t5.log || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/vtg-lab/VtgLabModule.svelte
git commit -m "feat(vtg-lab): explorer tab renders rotation-style matrices, retire mode path" -- src/lib/features/lab/vtg-lab/VtgLabModule.svelte src/lib/features/lab/vtg-lab/components/ModeSelector.svelte src/lib/features/lab/vtg-lab/components/ModeExplorer.svelte src/lib/features/lab/vtg-lab/components/VtgModeMatrix.svelte
```

---

## Task 6: Verification

- [ ] **Step 1: Unit tests**

Run: `npx vitest run src/lib/features/lab/vtg-lab/`
Expected: PASS (classify-rotation-style + the existing tnd-turn-patterns suites).

- [ ] **Step 2: Full type check**

Run: `npm run check > /tmp/final.log 2>&1; grep -iE "features.lab.vtg-lab|RotationStyle|VariationPicker|classify-rotation" /tmp/final.log || echo "no errors in new/changed VTG files"`
Expected: no errors attributable to the new/changed files.

- [ ] **Step 3: Runtime verification (manual, dev server :5173)**

Open Lab → VTG → Explorer. Confirm:
- Three panels: Isolation (cyan), Antispin (warm-red), Hybrid (violet) — no SS/TS/… chips.
- Each panel is a 7×7 mandala grid; one shared axis key; diagonal glow; bloom toward 3|3.
- The three panels' mandalas differ from each other (iso vs antispin vs hybrid shapes), confirming rotation style — not mode — drives them.
- Click a cell → picker lists letters (e.g. iso → A, G, DJ, MP, S, T) with mode tags → click one → its full card opens with QR + mandala.

Capture confirmation (screenshot or written) — per verification protocol, no "done" without it.

---

## Self-Review

- **Spec coverage:** insight/model → 3 panels (T4); classifier (T1); adapter + variations + on-demand resolve (T2); picker → card (T3); VtgLabModule swap + retire ModeSelector/ModeExplorer/VtgModeMatrix (T5); accents pro/anti/hybrid not elemental (T2 STYLE_META + T4); mode tag in picker (T2 variations + T3). All covered.
- **Type consistency:** `RotationStyle` (T1) used in T2; `RotationStyleMatrix`/`StyleVariation` defined T2, consumed T3/T4; `resolveVariationSequence(seedId, turnPattern)` defined T2, called T3; `classifyRotationStyle` defined T1, called T2; `turnKey` format matches `allTurnPatterns` keys. Consistent.
- **Placeholder scan:** none. The `as any` on the `CardVariation` literals is a deliberate structural cast (only `turnPattern`/`turnLabel` are needed by `applyVariationDescriptor`'s turn path); flagged in T2 note.
- **Risk:** `deriveTnDFromPictograph` parameter type — T2 Step 2 instructs reading `tnd-deriver.ts` to match it. Representative-seed mandala assumes intra-style invariance; if approximate, cells are thumbnails and cards are exact (design-robust).
```
