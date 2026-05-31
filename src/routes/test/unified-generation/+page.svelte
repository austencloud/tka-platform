<!--
  Interactive prototype — Unified Generation Vocabulary (Bento / Customize-panel look)
  Design review gate for docs/superpowers/specs/active/2026-05-31-unified-generation-vocabulary-design.md

  Reproduces the Generate panel's Customize bento aesthetic (gradient shell + accordion
  cards with LABEL ··· value ··· chevron headers + bubbly .option-btn rows) and carries the
  unified vocabulary inside it: Loop Type, Style, Turns (progressive disclosure), Grid &
  Orientation, Rhythm, Start Pos, and a Deck section (size + reroll).

  Shell + accordion + bubbly-button CSS mirrors CustomizeExpandedOverlay.svelte /
  StyleExpandPanel.svelte. Real Phase 1 extracts a shared accordion-section primitive;
  here it is replicated so the FEEL can be approved.

  Draw is a deterministic mock driven by the spec's real sfc32 seed. No engine wiring (Phase 2).
-->
<script lang="ts">
  // ---- seeding (spec's chosen algorithm, shown live) -------------------------
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
  type Section = "style" | "turns" | "spatial" | "rhythm" | "start" | "deck";

  const LOOP_TYPES = [
    { value: "rotated", label: "Rotated" },
    { value: "mirrored", label: "Mirrored" },
    { value: "swapped", label: "Swapped" },
    { value: "inverted", label: "Inverted" },
    { value: "flipped", label: "Flipped" },
  ] as const;
  type LoopType = (typeof LOOP_TYPES)[number]["value"];

  const BASE_POP: Record<number, number> = { 16: 12612, 12: 1252, 8: 108, 6: 40, 4: 10 };
  const LOOP_FACTOR: Record<LoopType, number> = {
    rotated: 1, mirrored: 0.55, swapped: 0.5, inverted: 0.6, flipped: 0.45,
  };

  const TURN_PRESETS = [
    { id: "clean", label: "Clean", turn: "none" as Turn },
    { id: "sprinkle", label: "Sprinkle", turn: "light" as Turn },
    { id: "spicy", label: "Spicy", turn: "heavy" as Turn },
  ];
  const TURN_PATTERNS = ["Hold 1", "Pulse 1", "Trade 1", "½/1 Trade", "Wave 2·1"];
  const RHYTHMS = ["Off", "Waltz", "Swing", "Gallop"];

  // ---- state (the one normalized model) --------------------------------------
  let mode = $state<Mode>("deck");
  let openSection = $state<Section | null>("style");

  let loopType = $state<LoopType>("rotated");
  let props = $state<Tri>("smooth");
  let hands = $state<Tri>("mixed");
  let dashes = $state<Dash>("mixed");
  let turns = $state<Turn>("light");
  let grid = $state<"diamond" | "box">("diamond");
  let orientation = $state<"radial" | "nonradial" | "split">("radial");
  let rhythm = $state("Off");
  let startPos = $state<"any" | "classic" | "specific">("any");
  let stepCount = $state(8);
  let deckSize = $state(52);
  let seed = $state(mintSeed());

  let perStepOpen = $state(false);
  let enabledPatterns = $state<Set<string>>(new Set(["Hold 1", "Pulse 1"]));
  let perStepEdits = $state<Map<number, number>>(new Map());
  const TURN_STEP_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3];

  function toggle(s: Section) { openSection = openSection === s ? null : s; }
  function togglePattern(p: string) {
    const next = new Set(enabledPatterns);
    next.has(p) ? next.delete(p) : next.add(p);
    enabledPatterns = next;
  }
  function setStepTurn(step: number, v: number) {
    const next = new Map(perStepEdits); next.set(step, v); perStepEdits = next;
  }
  function bakeToMacro(t: Turn) { perStepEdits = new Map(); turns = t; }

  // ---- derived / projections (labels computed on render, never stored) -------
  const stepsDisagree = $derived(perStepEdits.size > 0);
  const turnLabel = $derived(stepsDisagree ? "Custom" : cap(turns));
  const activePreset = $derived(stepsDisagree ? null : (TURN_PRESETS.find((p) => p.turn === turns)?.id ?? null));
  const styleSummary = $derived(
    loopType === "rotated" && props === "smooth" && hands === "smooth" && dashes === "mixed"
      ? "Default" : "Custom",
  );
  const spatialSummary = $derived(`${cap(grid)} · ${orientation === "nonradial" ? "Non-rad" : cap(orientation)}`);
  const startSummary = $derived(startPos === "any" ? "Any" : startPos === "classic" ? "Classic 3" : "Specific");

  const population = $derived(Math.round((BASE_POP[stepCount] ?? 0) * LOOP_FACTOR[loopType]));
  const capped = $derived(mode === "deck" && deckSize > population);
  const drawCount = $derived(Math.min(deckSize, population));
  const deckSummary = $derived(`${drawCount} cards`);

  function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

  const recipe = $derived({
    schemaVersion: 1,
    generatorVersion: "loop-gen@0.1.0",
    seed,
    params: {
      mode, loopType, propContinuity: props, handPath: hands, dashes,
      turns: stepsDisagree ? { mode: "perStep", edits: Object.fromEntries(perStepEdits) } : turns,
      turnPatterns: [...enabledPatterns], grid, orientation, rhythm, startPos,
      ...(mode === "deck" ? { stepCount, deckSize } : { stepCount }),
    },
  });

  const drawPreview = $derived.by(() => {
    const [a, b, c, d] = cyrb128(JSON.stringify(recipe));
    const rand = sfc32(a, b, c, d);
    const n = mode === "deck" ? Math.min(drawCount, 24) : 1;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = Math.floor(rand() * Math.max(1, population)).toString(36).toUpperCase().padStart(4, "0");
      out.push(`${loopType.slice(0, 3)}-${stepCount}-${id}`);
    }
    return out;
  });

  let copied = $state(false);
  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2));
      copied = true; setTimeout(() => (copied = false), 1600);
    } catch (e) { console.error("copy failed", e); }
  }
  function reroll() { seed = mintSeed(); }
</script>

<svelte:head><title>Unified Generation — Bento Prototype</title></svelte:head>

<div class="harness">
  <header class="topbar">
    <div class="mode-seg-wrap">
      <span class="topbar-label">Context</span>
      <div class="mode-seg">
        {#each [{ v: "generate", l: "Generate (1)" }, { v: "deck", l: "Deck (N)" }, { v: "actions", l: "Sequence Actions" }] as m}
          <button class="mode-btn" class:on={mode === m.v} onclick={() => (mode = m.v as Mode)}>{m.l}</button>
        {/each}
      </div>
    </div>
    <p class="ctx-note">
      {#if mode === "generate"}Builds <strong>one</strong> sequence.
      {:else if mode === "deck"}Draws <strong>N</strong> — same dials + deck size + reroll.
      {:else}Applies dials as <strong>post-transforms</strong> to the current sequence.{/if}
    </p>
  </header>

  <div class="layout">
    <!-- the bento Customize-style panel -------------------------------------->
    <section class="bento">
      <div class="bento-head">
        <h3 class="bento-title">Customize</h3>
        <span class="bento-sub">{mode === "deck" ? "Deck recipe" : mode === "generate" ? "Sequence" : "Transform"}</span>
      </div>

      <div class="bento-body">
        <!-- Style -->
        <div class="card">
          <button class="card-head" class:active={openSection === "style"} onclick={() => toggle("style")}>
            <span class="card-label">Style</span>
            <span class="card-value">{styleSummary}</span>
            <i class="fas fa-chevron-down chev" class:open={openSection === "style"}></i>
          </button>
          {#if openSection === "style"}
            <div class="card-body">
              {#if mode !== "actions"}
                <div class="brow">
                  <span class="brow-label">Loop</span>
                  <div class="opts">
                    {#each LOOP_TYPES as l}
                      <button class="option-btn" class:selected={loopType === l.value} onclick={() => (loopType = l.value)}>{l.label}</button>
                    {/each}
                  </div>
                </div>
              {/if}
              <div class="brow">
                <span class="brow-label">Props</span>
                <div class="opts">
                  {#each [["smooth", "Smooth"], ["mixed", "Mixed"], ["choppy", "Choppy"]] as [v, l]}
                    <button class="option-btn" class:selected={props === v} onclick={() => (props = v as Tri)}>{l}</button>
                  {/each}
                </div>
              </div>
              <div class="brow">
                <span class="brow-label">Hands</span>
                <div class="opts">
                  {#each [["smooth", "Smooth"], ["mixed", "Mixed"], ["choppy", "Choppy"]] as [v, l]}
                    <button class="option-btn" class:selected={hands === v} onclick={() => (hands = v as Tri)}>{l}</button>
                  {/each}
                </div>
              </div>
              <div class="brow">
                <span class="brow-label">Dashes</span>
                <div class="opts">
                  {#each [["low", "Low"], ["mixed", "Mixed"], ["high", "High"]] as [v, l]}
                    <button class="option-btn" class:selected={dashes === v} onclick={() => (dashes = v as Dash)}>{l}</button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Turns -->
        <div class="card">
          <button class="card-head" class:active={openSection === "turns"} onclick={() => toggle("turns")}>
            <span class="card-label">Turns</span>
            <span class="card-value">{turnLabel}</span>
            <i class="fas fa-chevron-down chev" class:open={openSection === "turns"}></i>
          </button>
          {#if openSection === "turns"}
            <div class="card-body">
              <div class="brow">
                <span class="brow-label">Level</span>
                <div class="opts">
                  {#each [["none", "None"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]] as [v, l]}
                    <button class="option-btn" class:selected={!stepsDisagree && turns === v} onclick={() => bakeToMacro(v as Turn)}>{l}</button>
                  {/each}
                </div>
              </div>
              <div class="chip-row">
                {#each TURN_PRESETS as p}
                  <button class="pill" class:on={activePreset === p.id} onclick={() => bakeToMacro(p.turn)}>{p.label}</button>
                {/each}
                <span class="chip-div"></span>
                {#each TURN_PATTERNS as pat}
                  <button class="pill" class:on={enabledPatterns.has(pat)} onclick={() => togglePattern(pat)}>{pat}</button>
                {/each}
              </div>
              <button class="drill" class:open={perStepOpen} onclick={() => (perStepOpen = !perStepOpen)}>
                <i class="fas fa-chevron-{perStepOpen ? 'down' : 'right'}"></i> Per-step editor
              </button>
              {#if perStepOpen}
                <div class="perstep">
                  <p class="hint">Edit one step → tier-1 reads <strong>“Custom”</strong>. Collapsing back is explicit, never automatic.</p>
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
                      <button class="pill on" onclick={() => bakeToMacro("light")}>Bake → Light</button>
                      <button class="pill" onclick={() => (perStepEdits = new Map())}>Reset</button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Grid & Orientation -->
        <div class="card">
          <button class="card-head" class:active={openSection === "spatial"} onclick={() => toggle("spatial")}>
            <span class="card-label">Grid · Orient</span>
            <span class="card-value">{spatialSummary}</span>
            <i class="fas fa-chevron-down chev" class:open={openSection === "spatial"}></i>
          </button>
          {#if openSection === "spatial"}
            <div class="card-body">
              <div class="brow">
                <span class="brow-label">Grid</span>
                <div class="opts">
                  {#each [["diamond", "Diamond"], ["box", "Box"]] as [v, l]}
                    <button class="option-btn" class:selected={grid === v} onclick={() => (grid = v as typeof grid)}>{l}</button>
                  {/each}
                </div>
              </div>
              <div class="brow">
                <span class="brow-label">Orient</span>
                <div class="opts">
                  {#each [["radial", "Radial"], ["nonradial", "Non-rad"], ["split", "Split"]] as [v, l]}
                    <button class="option-btn" class:selected={orientation === v} onclick={() => (orientation = v as typeof orientation)}>{l}</button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Rhythm -->
        <div class="card">
          <button class="card-head" class:active={openSection === "rhythm"} onclick={() => toggle("rhythm")}>
            <span class="card-label">Rhythm</span>
            <span class="card-value">{rhythm}</span>
            <i class="fas fa-chevron-down chev" class:open={openSection === "rhythm"}></i>
          </button>
          {#if openSection === "rhythm"}
            <div class="card-body">
              <div class="chip-row">
                {#each RHYTHMS as r}
                  <button class="pill" class:on={rhythm === r} onclick={() => (rhythm = r)}>{r}</button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Start Pos -->
        {#if mode !== "actions"}
          <div class="card">
            <button class="card-head" class:active={openSection === "start"} onclick={() => toggle("start")}>
              <span class="card-label">Start Pos.</span>
              <span class="card-value">{startSummary}</span>
              <i class="fas fa-chevron-down chev" class:open={openSection === "start"}></i>
            </button>
            {#if openSection === "start"}
              <div class="card-body">
                <div class="opts wide">
                  {#each [["any", "All"], ["classic", "Classic 3"], ["specific", "Specific"]] as [v, l]}
                    <button class="option-btn" class:selected={startPos === v} onclick={() => (startPos = v as typeof startPos)}>{l}</button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Deck (deck mode only) -->
        {#if mode === "deck"}
          <div class="card deck-card">
            <button class="card-head" class:active={openSection === "deck"} onclick={() => toggle("deck")}>
              <span class="card-label">Deck</span>
              <span class="card-value" class:warn={capped}>{deckSummary}</span>
              <i class="fas fa-chevron-down chev" class:open={openSection === "deck"}></i>
            </button>
            {#if openSection === "deck"}
              <div class="card-body">
                <div class="deck-row">
                  <label class="num-field"><span class="brow-label">Step Count</span><input class="num" type="number" min="4" max="16" step="2" bind:value={stepCount} /></label>
                  <label class="num-field"><span class="brow-label">Deck Size</span><input class="num" type="number" min="1" max="200" bind:value={deckSize} /></label>
                  <button class="reroll" onclick={reroll}><i class="fas fa-dice"></i> Reroll</button>
                </div>
                <p class="hint" class:warn={capped}>
                  {#if capped}<i class="fas fa-triangle-exclamation"></i> Capped — only {population} {loopType} {stepCount}-step LOOPs exist. Drawing {drawCount}.
                  {:else}Drawing {drawCount} of {population} possible. seed {seed.slice(0, 8)}…{/if}
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </section>

    <!-- live truth + output --------------------------------------------------->
    <aside class="rail">
      {#if mode === "deck"}
        <div class="stat"><div class="stat-big" class:warn={capped}>{drawCount}</div><div class="stat-sub">cards{#if capped}<span class="cap">capped at {population}</span>{:else}<span class="ok">of {population}</span>{/if}</div></div>
      {:else if mode === "generate"}
        <div class="stat"><div class="stat-big">1</div><div class="stat-sub">sequence</div></div>
      {:else}
        <div class="stat"><div class="stat-big"><i class="fas fa-wand-magic-sparkles"></i></div><div class="stat-sub">applied to current</div></div>
      {/if}

      <div class="recipe-head"><span>Recipe (durable truth)</span><button class="copy" onclick={copyRecipe}>{copied ? "Copied!" : "Copy"}</button></div>
      <pre class="recipe"><code>{JSON.stringify(recipe, null, 2)}</code></pre>

      {#if mode === "deck"}
        <div class="draw-head">Draw preview <span class="seed-tag">seed {seed.slice(0, 8)}…</span></div>
        <div class="draw-list">{#each drawPreview as id}<span class="draw-id">{id}</span>{/each}</div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .harness {
    min-height: 100vh;
    background: radial-gradient(circle at 30% 12%, #16203a, #0a0d18 70%);
    color: #f5f5f5; padding-bottom: 60px;
    --acc: #06b6d4;
  }
  .topbar {
    position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
    padding: 14px 28px; background: rgba(10, 13, 24, 0.9); backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .topbar-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255, 255, 255, 0.5); }
  .mode-seg-wrap { display: flex; align-items: center; gap: 12px; }
  .mode-seg { display: flex; gap: 4px; background: rgba(0, 0, 0, 0.3); border-radius: 10px; padding: 4px; }
  .mode-btn { padding: 8px 16px; border-radius: 7px; border: none; background: none; color: rgba(255, 255, 255, 0.65); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 150ms; }
  .mode-btn.on { background: var(--acc); color: #06121a; }
  .ctx-note { margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.6); }
  .ctx-note strong { color: var(--acc); }

  .layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(330px, 0.85fr); gap: 24px; max-width: 1200px; margin: 26px auto 0; padding: 0 28px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

  /* ── bento shell (mirrors CustomizeExpandedOverlay) ── */
  .bento {
    display: flex; flex-direction: column; gap: 10px; padding: 16px;
    background: linear-gradient(135deg,
      color-mix(in srgb, #06b6d4 20%, #1a1a2e) 0%,
      color-mix(in srgb, #0891b2 12%, #1a1a2e) 50%,
      color-mix(in srgb, #06b6d4 16%, #1a1a2e) 100%);
    border-radius: 16px; border: 2px solid color-mix(in srgb, #06b6d4 40%, transparent);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 24px color-mix(in srgb, #06b6d4 20%, transparent);
  }
  .bento-head { display: flex; align-items: baseline; justify-content: space-between; }
  .bento-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.3px; }
  .bento-sub { font-size: 12px; color: rgba(255, 255, 255, 0.55); text-transform: uppercase; letter-spacing: 0.05em; }
  .bento-body { display: flex; flex-direction: column; gap: 6px; }

  /* ── accordion card ── */
  .card { border-radius: 10px; overflow: hidden; background: rgba(0, 0, 0, 0.15); border: 1.5px solid rgba(255, 255, 255, 0.08); }
  .card-head { width: 100%; display: flex; align-items: center; gap: 8px; padding: 11px 13px; background: transparent; border: none; color: #fff; cursor: pointer; min-height: 44px; transition: background 200ms; }
  .card-head:hover { background: rgba(255, 255, 255, 0.05); }
  .card-head.active { border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
  .card-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255, 255, 255, 0.5); min-width: 84px; text-align: left; }
  .card-value { flex: 1; text-align: right; font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.9); }
  .card-value.warn { color: #fbbf24; }
  .chev { font-size: 13px; opacity: 0.5; transition: transform 200ms; }
  .chev.open { transform: rotate(180deg); }
  .card-body { padding: 12px 13px 14px; display: flex; flex-direction: column; gap: 12px; }

  /* ── bubbly button row (mirrors StyleExpandPanel) ── */
  .brow { display: flex; align-items: center; gap: 12px; }
  .brow-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255, 255, 255, 0.5); min-width: 52px; flex-shrink: 0; }
  .opts { display: flex; gap: 4px; flex: 1; }
  .opts.wide { width: 100%; }
  .option-btn {
    flex: 1; min-height: 44px; background: rgba(0, 0, 0, 0.25); border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px; color: rgba(255, 255, 255, 0.7); cursor: pointer; font-weight: 600; font-size: 12px; padding: 4px 6px;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
  }
  .option-btn:active { transform: scale(0.96); }
  .option-btn.selected { background: rgba(6, 182, 212, 0.28); border-color: rgba(6, 182, 212, 0.7); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); box-shadow: 0 0 12px rgba(6, 182, 212, 0.2); }

  /* ── pills (presets / patterns / rhythm) ── */
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip-div { width: 1px; align-self: stretch; background: rgba(255, 255, 255, 0.14); margin: 0 2px; }
  .pill { padding: 7px 13px; border-radius: 9999px; border: 1.5px solid rgba(255, 255, 255, 0.15); background: rgba(0, 0, 0, 0.25); color: rgba(255, 255, 255, 0.72); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 150ms; }
  .pill:hover { border-color: rgba(255, 255, 255, 0.3); color: #fff; }
  .pill.on { background: rgba(6, 182, 212, 0.22); border-color: rgba(6, 182, 212, 0.65); color: #fff; }

  .drill { display: flex; align-items: center; gap: 8px; background: none; border: none; color: rgba(255, 255, 255, 0.7); font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 0; }
  .drill:hover { color: #fff; }
  .drill i { width: 12px; color: var(--acc); }
  .perstep { display: flex; flex-direction: column; gap: 10px; }
  .hint { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); }
  .hint strong { color: var(--acc); }
  .hint.warn { color: #fbbf24; }
  .step-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .step-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .step-idx { font-size: 10px; color: rgba(255, 255, 255, 0.4); font-variant-numeric: tabular-nums; }
  .step-sel { width: 48px; padding: 4px; border-radius: 8px; background: rgba(0, 0, 0, 0.3); border: 1.5px solid rgba(255, 255, 255, 0.15); color: #fff; text-align: center; font-size: 13px; }
  .bake-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .bake-warn { font-size: 12px; color: #fbbf24; display: flex; align-items: center; gap: 6px; }

  .deck-row { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
  .num-field { display: flex; flex-direction: column; gap: 6px; }
  .num { width: 90px; padding: 8px 10px; border-radius: 8px; background: rgba(0, 0, 0, 0.3); border: 1.5px solid rgba(255, 255, 255, 0.15); color: #fff; font-size: 14px; font-variant-numeric: tabular-nums; }
  .reroll { margin-left: auto; display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 10px; border: none; background: var(--acc); color: #06121a; font-size: 14px; font-weight: 700; cursor: pointer; }
  .reroll:hover { filter: brightness(1.1); }

  /* ── rail ── */
  .rail { display: flex; flex-direction: column; gap: 14px; }
  .stat { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; text-align: center; }
  .stat-big { font-size: 44px; font-weight: 800; color: var(--acc); font-variant-numeric: tabular-nums; line-height: 1; }
  .stat-big.warn { color: #fbbf24; }
  .stat-sub { margin-top: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.55); display: flex; flex-direction: column; gap: 2px; }
  .cap { color: #fbbf24; } .ok { color: rgba(255, 255, 255, 0.4); }
  .recipe-head, .draw-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.5); }
  .copy { padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: none; color: #fff; font-size: 12px; cursor: pointer; }
  .copy:hover { border-color: var(--acc); }
  .recipe { margin: 0; max-height: 300px; overflow: auto; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.5; color: #cbd5e1; }
  .seed-tag { font-weight: 500; text-transform: none; color: var(--acc); font-variant-numeric: tabular-nums; }
  .draw-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .draw-id { font-size: 11px; font-family: ui-monospace, monospace; padding: 3px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.75); }

  @media (prefers-reduced-motion: reduce) { .option-btn, .chev, .card-head, .pill { transition: none; } }
</style>
