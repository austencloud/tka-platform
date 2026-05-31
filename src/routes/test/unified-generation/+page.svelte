<!--
  Interactive prototype — Unified Generation Vocabulary
  Design review gate for docs/superpowers/specs/active/2026-05-31-unified-generation-vocabulary-design.md

  Demonstrates (with REAL primitives, not fakes):
   - One vocabulary, three contexts (Generate / Deck / Sequence-actions) via the mode switch.
   - Loop Type as a first-class axis (the new capability — deck no longer rotated-only).
   - Progressive disclosure on the Turns axis: coarse intensity -> presets -> per-step editor,
     with explicit (non-auto) lossy collapse back to a macro.
   - Explicit seed + Reroll; faithful recipe JSON with seed/generatorVersion/schemaVersion.
   - Closed-form population ceiling guard ("asked for 52, only N exist").

  This is a DESIGN prototype: the draw is a deterministic mock driven by the real sfc32 seed
  algorithm from the spec. No engine/Firestore wiring (that is Phase 2).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";

  // ---- seeding (the spec's chosen algorithm, shown live) ----------------------
  function cyrb128(str: string): [number, number, number, number] {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a: number, b: number, c: number, d: number): () => number {
    return () => {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  /** Mint a fresh seed from real entropy (this is the legit place randomness enters). */
  function mintSeed(): string {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return buf[0].toString(16).padStart(8, "0") + buf[1].toString(16).padStart(8, "0");
  }

  // ---- vocabulary -------------------------------------------------------------
  type Mode = "generate" | "deck" | "actions";
  type Tri = "smooth" | "mixed" | "choppy";
  type Dash = "low" | "mixed" | "high";
  type Turn = "none" | "light" | "medium" | "heavy";

  const LOOP_TYPES = [
    { value: "rotated", label: "Rotated" },
    { value: "mirrored", label: "Mirrored" },
    { value: "swapped", label: "Swapped" },
    { value: "inverted", label: "Inverted" },
    { value: "flipped", label: "Flipped" },
  ] as const;
  type LoopType = (typeof LOOP_TYPES)[number]["value"];

  // mock population per (stepCount) for rotated; other types scale (plausible, for the guard demo)
  const BASE_POP: Record<number, number> = { 16: 12612, 12: 1252, 8: 108, 6: 40, 4: 10 };
  const LOOP_FACTOR: Record<LoopType, number> = {
    rotated: 1, mirrored: 0.55, swapped: 0.5, inverted: 0.6, flipped: 0.45,
  };

  // turn presets = named points in the space; pattern chips = eligible per-step patterns
  const TURN_PRESETS = [
    { id: "clean", label: "Clean", turn: "none" as Turn },
    { id: "sprinkle", label: "Sprinkle", turn: "light" as Turn },
    { id: "spicy", label: "Spicy", turn: "heavy" as Turn },
  ];
  const TURN_PATTERNS = ["Hold 1", "Pulse 1", "Trade 1", "½/1 Trade", "Wave 2·1"];

  // ---- state (the one normalized model) --------------------------------------
  let mode = $state<Mode>("deck");

  let loopType = $state<LoopType>("rotated");
  let props = $state<Tri>("smooth");
  let hands = $state<Tri>("mixed");
  let dashes = $state<Dash>("mixed");
  let turns = $state<Turn>("light");
  let grid = $state<"diamond" | "box">("diamond");
  let orientation = $state<"radial" | "nonradial" | "split">("radial");
  let stepCount = $state(8);
  let deckSize = $state(52);
  let seed = $state(mintSeed());

  // turns progressive disclosure
  let perStepOpen = $state(false);
  let enabledPatterns = $state<Set<string>>(new Set(["Hold 1", "Pulse 1"]));
  // per-step overrides: when set, the coarse Turns control reads "Custom" until baked
  let perStepEdits = $state<Map<number, number>>(new Map());
  const TURN_STEP_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3];

  function togglePattern(p: string) {
    const next = new Set(enabledPatterns);
    next.has(p) ? next.delete(p) : next.add(p);
    enabledPatterns = next;
  }
  function setStepTurn(step: number, v: number) {
    const next = new Map(perStepEdits);
    next.set(step, v);
    perStepEdits = next;
  }
  function bakeToMacro(target: Turn) {
    // explicit, reversible collapse — never automatic (the Vital "Apply Matrix" lesson)
    perStepEdits = new Map();
    turns = target;
  }

  // ---- derived / projections --------------------------------------------------
  const stepsDisagree = $derived(perStepEdits.size > 0);

  // coarse Turns label is COMPUTED, never stored
  const turnLabel = $derived(stepsDisagree ? "Custom" : turns);

  // which preset (if any) the current vector sits on
  const activePreset = $derived(
    stepsDisagree ? null : (TURN_PRESETS.find((p) => p.turn === turns)?.id ?? null),
  );

  const population = $derived(
    Math.round((BASE_POP[stepCount] ?? 0) * LOOP_FACTOR[loopType]),
  );
  const capped = $derived(mode === "deck" && deckSize > population);
  const drawCount = $derived(Math.min(deckSize, population));

  // the recipe = durable truth (dials + seed + versions)
  const recipe = $derived({
    schemaVersion: 1,
    generatorVersion: "loop-gen@0.1.0",
    seed,
    params: {
      mode,
      loopType,
      propContinuity: props,
      handPath: hands,
      dashes,
      turns: stepsDisagree ? { mode: "perStep", edits: Object.fromEntries(perStepEdits) } : turns,
      turnPatterns: [...enabledPatterns],
      grid,
      orientation,
      ...(mode === "deck" ? { stepCount, deckSize } : { stepCount }),
    },
  });

  // mock deterministic draw so Reroll visibly does something (seeded by the real algorithm)
  const drawPreview = $derived.by(() => {
    const [a, b, c, d] = cyrb128(JSON.stringify(recipe));
    const rand = sfc32(a, b, c, d);
    const n = mode === "deck" ? Math.min(drawCount, 24) : 1;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = Math.floor(rand() * population).toString(36).toUpperCase().padStart(4, "0");
      out.push(`${loopType.slice(0, 3)}-${stepCount}-${id}`);
    }
    return out;
  });

  let copied = $state(false);
  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch (e) {
      console.error("copy failed", e);
    }
  }

  function reroll() {
    seed = mintSeed();
  }

  onMount(() => {
    // let the app theme cascade; provide fallbacks via :global below
  });
</script>

<svelte:head><title>Unified Generation — Prototype</title></svelte:head>

<div class="harness">
  <header class="bar">
    <div class="group">
      <span class="bar-label">Context</span>
      <div class="mode-seg">
        <SegmentedControl
          options={[
            { value: "generate", label: "Generate (1)" },
            { value: "deck", label: "Deck (N)" },
            { value: "actions", label: "Sequence Actions" },
          ]}
          value={mode}
          onchange={(v) => (mode = v)}
          color="accent"
        />
      </div>
    </div>
    <p class="ctx-note">
      {#if mode === "generate"}Same dials → builds <strong>one</strong> sequence.
      {:else if mode === "deck"}Same dials + <strong>deck size</strong> + reroll → draws <strong>N</strong>.
      {:else}Same dials as <strong>post-transforms</strong> on the existing sequence.{/if}
    </p>
  </header>

  <div class="layout">
    <!-- the unified axis panel ------------------------------------------------>
    <section class="panel">
      <h2 class="panel-title"><i class="fas fa-sliders-h"></i> Style</h2>

      {#if mode !== "actions"}
        <div class="axis">
          <span class="axis-label">Loop Type</span>
          <SegmentedControl options={LOOP_TYPES.map((l) => ({ ...l }))} value={loopType} onchange={(v) => (loopType = v)} color="accent" size="sm" />
        </div>
        <p class="axis-hint">{loopType === "rotated" ? "Today's only deck type." : "New — unreachable in the deck releaser today."}</p>
      {/if}

      <div class="axis">
        <span class="axis-label">Props</span>
        <SegmentedControl options={[{ value: "smooth", label: "Smooth" }, { value: "mixed", label: "Mixed" }, { value: "choppy", label: "Choppy" }]} value={props} onchange={(v) => (props = v)} color="accent" />
      </div>
      <div class="axis">
        <span class="axis-label">Hands</span>
        <SegmentedControl options={[{ value: "smooth", label: "Smooth" }, { value: "mixed", label: "Mixed" }, { value: "choppy", label: "Choppy" }]} value={hands} onchange={(v) => (hands = v)} color="accent" />
      </div>
      <div class="axis">
        <span class="axis-label">Dashes</span>
        <SegmentedControl options={[{ value: "low", label: "Low" }, { value: "mixed", label: "Mixed" }, { value: "high", label: "High" }]} value={dashes} onchange={(v) => (dashes = v)} color="accent" />
      </div>

      <!-- Turns axis: the progressive-disclosure showcase --------------------->
      <div class="axis turns-axis">
        <span class="axis-label">
          Turns
          <span class="tier-tag">tier 1</span>
        </span>
        <SegmentedControl
          options={[{ value: "none", label: "None" }, { value: "light", label: "Light" }, { value: "medium", label: "Medium" }, { value: "heavy", label: "Heavy" }]}
          value={(stepsDisagree ? "none" : turns)}
          onchange={(v) => bakeToMacro(v)}
          color="accent"
        />
      </div>

      <div class="sub">
        <span class="sub-label">Presets <span class="tier-tag">tier 2</span></span>
        <div class="chips">
          {#each TURN_PRESETS as p}
            <FilterChipBase label={p.label} mode="toggle" active={activePreset === p.id} onclick={() => bakeToMacro(p.turn)} />
          {/each}
          <span class="chip-div"></span>
          {#each TURN_PATTERNS as pat}
            <FilterChipBase label={pat} mode="toggle" active={enabledPatterns.has(pat)} onclick={() => togglePattern(pat)} />
          {/each}
        </div>
      </div>

      <div class="sub">
        <button class="drill" class:open={perStepOpen} onclick={() => (perStepOpen = !perStepOpen)}>
          <i class="fas fa-chevron-{perStepOpen ? 'down' : 'right'}"></i>
          Per-step editor <span class="tier-tag">tier 3</span>
        </button>
        {#if perStepOpen}
          <div class="perstep">
            <p class="perstep-note">Set individual steps. The moment they disagree, tier 1 reads <strong>“Custom”</strong> — collapsing back is explicit, never automatic.</p>
            <div class="step-grid">
              {#each Array.from({ length: stepCount }) as _, i}
                <div class="step-col">
                  <span class="step-idx">{i + 1}</span>
                  <select class="step-sel" value={perStepEdits.get(i) ?? 1} onchange={(e) => setStepTurn(i, Number((e.target as HTMLSelectElement).value))}>
                    {#each TURN_STEP_VALUES as v}<option value={v}>{v}</option>{/each}
                  </select>
                </div>
              {/each}
            </div>
            {#if stepsDisagree}
              <div class="bake-row">
                <span class="bake-warn"><i class="fas fa-triangle-exclamation"></i> Off-macro (Custom)</span>
                <button class="bake-btn" onclick={() => bakeToMacro("light")}>Bake → Light</button>
                <button class="bake-btn ghost" onclick={() => (perStepEdits = new Map())}>Reset</button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="axis-row">
        <div class="axis half">
          <span class="axis-label">Grid</span>
          <SegmentedControl options={[{ value: "diamond", label: "Diamond" }, { value: "box", label: "Box" }]} value={grid} onchange={(v) => (grid = v)} color="accent" size="sm" />
        </div>
        <div class="axis half">
          <span class="axis-label">Orientation</span>
          <SegmentedControl options={[{ value: "radial", label: "Radial" }, { value: "nonradial", label: "Non-rad" }, { value: "split", label: "Split" }]} value={orientation} onchange={(v) => (orientation = v)} color="accent" size="sm" />
        </div>
      </div>

      {#if mode === "deck"}
        <div class="deck-row">
          <label class="num-field">
            <span class="axis-label">Step Count</span>
            <input class="num" type="number" min="4" max="16" step="2" bind:value={stepCount} />
          </label>
          <label class="num-field">
            <span class="axis-label">Deck Size</span>
            <input class="num" type="number" min="1" max="200" bind:value={deckSize} />
          </label>
          <button class="reroll" onclick={reroll}><i class="fas fa-dice"></i> Reroll</button>
        </div>
      {/if}
    </section>

    <!-- live truth + output --------------------------------------------------->
    <aside class="rail">
      {#if mode === "deck"}
        <div class="stat">
          <div class="stat-big" class:warn={capped}>{drawCount}</div>
          <div class="stat-sub">
            cards drawn
            {#if capped}<span class="cap">capped — only {population} exist for {loopType}/{stepCount}-step</span>
            {:else}<span class="ok">of {population} possible</span>{/if}
          </div>
        </div>
      {:else if mode === "generate"}
        <div class="stat"><div class="stat-big">1</div><div class="stat-sub">sequence</div></div>
      {:else}
        <div class="stat"><div class="stat-big"><i class="fas fa-wand-magic-sparkles"></i></div><div class="stat-sub">applied to current sequence</div></div>
      {/if}

      <div class="preset-state">
        Turns projection:
        <strong>{activePreset ? TURN_PRESETS.find((p) => p.id === activePreset)?.label : turnLabel === "Custom" ? "Custom" : "Off-preset"}</strong>
      </div>

      <div class="recipe-head">
        <span>Recipe (durable truth)</span>
        <button class="copy" onclick={copyRecipe}>{copied ? "Copied!" : "Copy"}</button>
      </div>
      <pre class="recipe"><code>{JSON.stringify(recipe, null, 2)}</code></pre>

      {#if mode === "deck"}
        <div class="draw-head">Draw preview <span class="seed-tag">seed {seed.slice(0, 8)}…</span></div>
        <div class="draw-list">
          {#each drawPreview as id}<span class="draw-id">{id}</span>{/each}
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .harness {
    min-height: 100vh;
    background: radial-gradient(circle at 30% 15%, #16203a, #0a0d18 70%);
    color: var(--theme-text, #f5f5f5);
    --acc: var(--theme-accent, #8b5cf6);
    padding-bottom: 60px;
  }
  .bar {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
    padding: 14px 28px;
    background: rgba(10, 13, 24, 0.9); backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .group { display: flex; align-items: center; gap: 12px; }
  .bar-label, .axis-label, .sub-label {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: rgba(255, 255, 255, 0.5);
  }
  .mode-seg { width: 360px; }
  .ctx-note { margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.6); }
  .ctx-note strong { color: var(--acc); }

  .layout {
    display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.9fr);
    gap: 24px; max-width: 1280px; margin: 24px auto 0; padding: 0 28px;
  }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

  .panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 16px;
  }
  .panel-title { display: flex; align-items: center; gap: 10px; margin: 0 0 4px; font-size: 18px; font-weight: 700; }
  .panel-title i { color: var(--acc); }

  .axis { display: flex; flex-direction: column; gap: 8px; }
  .axis-label { display: flex; align-items: center; gap: 8px; }
  .axis-hint { margin: -8px 0 0; font-size: 12px; color: rgba(255, 255, 255, 0.4); font-style: italic; }
  .axis-row { display: flex; gap: 16px; }
  .axis.half { flex: 1; }

  .tier-tag {
    font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
    padding: 2px 6px; border-radius: 6px;
    background: color-mix(in srgb, var(--acc) 22%, transparent);
    color: var(--acc); text-transform: uppercase;
  }

  .sub {
    border-left: 2px solid color-mix(in srgb, var(--acc) 30%, transparent);
    padding-left: 14px; display: flex; flex-direction: column; gap: 10px;
  }
  .sub-label { display: flex; align-items: center; gap: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip-div { width: 1px; align-self: stretch; background: rgba(255, 255, 255, 0.12); margin: 0 2px; }

  .drill {
    display: flex; align-items: center; gap: 8px;
    background: none; border: none; color: rgba(255, 255, 255, 0.7);
    font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0;
  }
  .drill:hover { color: #fff; }
  .drill i { width: 12px; color: var(--acc); }

  .perstep { display: flex; flex-direction: column; gap: 10px; }
  .perstep-note { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); }
  .perstep-note strong { color: var(--acc); }
  .step-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .step-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .step-idx { font-size: 10px; color: rgba(255, 255, 255, 0.4); font-variant-numeric: tabular-nums; }
  .step-sel {
    width: 48px; padding: 4px; border-radius: 8px;
    background: rgba(0, 0, 0, 0.3); border: 1.5px solid rgba(255, 255, 255, 0.15);
    color: #fff; text-align: center; font-size: 13px;
  }
  .bake-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .bake-warn { font-size: 12px; color: #fbbf24; display: flex; align-items: center; gap: 6px; }
  .bake-btn {
    padding: 6px 12px; border-radius: 8px; border: 1px solid var(--acc);
    background: color-mix(in srgb, var(--acc) 18%, transparent); color: #fff;
    font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .bake-btn.ghost { border-color: rgba(255, 255, 255, 0.2); background: none; }

  .deck-row { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
  .num-field { display: flex; flex-direction: column; gap: 6px; }
  .num {
    width: 90px; padding: 8px 10px; border-radius: 8px;
    background: rgba(0, 0, 0, 0.3); border: 1.5px solid rgba(255, 255, 255, 0.15);
    color: #fff; font-size: 14px; font-variant-numeric: tabular-nums;
  }
  .reroll {
    margin-left: auto; display: flex; align-items: center; gap: 8px;
    padding: 10px 18px; border-radius: 10px; border: none;
    background: var(--acc); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  .reroll:hover { filter: brightness(1.1); }

  .rail { display: flex; flex-direction: column; gap: 14px; }
  .stat {
    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px; padding: 18px; text-align: center;
  }
  .stat-big { font-size: 44px; font-weight: 800; color: var(--acc); font-variant-numeric: tabular-nums; line-height: 1; }
  .stat-big.warn { color: #fbbf24; }
  .stat-sub { margin-top: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.55); display: flex; flex-direction: column; gap: 2px; }
  .cap { color: #fbbf24; }
  .ok { color: rgba(255, 255, 255, 0.4); }

  .preset-state { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
  .preset-state strong { color: var(--acc); }

  .recipe-head, .draw-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.5); }
  .copy { padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: none; color: #fff; font-size: 12px; cursor: pointer; }
  .copy:hover { border-color: var(--acc); }
  .recipe {
    margin: 0; max-height: 320px; overflow: auto;
    background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.5;
    color: #cbd5e1; font-variant-numeric: tabular-nums;
  }
  .seed-tag { font-weight: 500; text-transform: none; color: var(--acc); font-variant-numeric: tabular-nums; }
  .draw-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .draw-id {
    font-size: 11px; font-family: ui-monospace, monospace;
    padding: 3px 8px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.75);
  }
</style>
