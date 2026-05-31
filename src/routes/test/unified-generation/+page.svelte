<!--
  Interactive prototype — Unified Generation as the Generate BENTO CARD GRID
  Design review gate for docs/superpowers/specs/active/2026-05-31-unified-generation-vocabulary-design.md

  Reuses the REAL generate cards (BaseCard / ToggleCard / StepperCard) and the real
  card-colors gradients, laid out 6-col like CardBasedSettingsContainer. Carries the deck
  vocabulary: WORD (type a word -> deck of all its variations), DECK SIZE, STEP COUNT, LEVEL,
  GRID, ORIENTATION, CUSTOMIZE, LOOP (pick any loop type), PERIOD, and a GENERATE/Draw button.

  Draw is a deterministic mock driven by the spec's real sfc32 seed. No engine wiring (Phase 2).
-->
<script lang="ts">
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import ToggleCard from "$lib/features/create/generate/components/cards/ToggleCard.svelte";
  import StepperCard from "$lib/features/create/generate/components/cards/StepperCard/StepperCard.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { BackgroundType } from "@austencloud/backgrounds";
  import LOOPExpandedOverlay from "$lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte";
  import { LOOPType, LOOP_TYPE_LABELS, ROTATED_LOOP_TYPES } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
  import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";

  const c = getCardColors(BackgroundType.COSMIC); // DEFAULT_COLORS gradients
  const LOOP_COLOR = "linear-gradient(135deg, #a3a32a 0%, #8a8a22 50%, #6b6b1a 100%)";
  const LOOP_SHADOW = "60deg 55% 35%";

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
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a: number, b: number, c2: number, d: number): () => number {
    return () => {
      a >>>= 0; b >>>= 0; c2 >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c2 + (c2 << 3)) | 0;
      c2 = (c2 << 21) | (c2 >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c2 = (c2 + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function mintSeed(): string {
    const buf = new Uint32Array(2); crypto.getRandomValues(buf);
    return buf[0]!.toString(16).padStart(8, "0") + buf[1]!.toString(16).padStart(8, "0");
  }

  // Base LOOP seeds that close for a (type, stepCount). Finite & computable, but nonzero for
  // every valid length — generation produces these FRESH; it never draws from a fixed store.
  function loopFactor(lt: LOOPType): number { return ROTATED_LOOP_TYPES.has(lt) ? 1 : 0.6; }
  function baseLoops(step: number, lt: LOOPType): number {
    return Math.max(6, Math.round(Math.pow(step / 2, 3) * 4 * loopFactor(lt)));
  }

  // ---- state ------------------------------------------------------------------
  let word = $state("");
  let wordEditing = $state(false);
  let deckSize = $state(52);
  let stepCount = $state(8);
  let level = $state(1);
  let grid = $state<"diamond" | "box">("diamond");
  let orientation = $state<"radial" | "nonradial" | "split">("radial");
  let loopType = $state<LOOPType>(LOOPType.ROTATED);
  let loopComponents = $state<Set<LOOPComponent>>(parseLoopComponents(LOOPType.ROTATED));
  let showLoop = $state(false);
  let period = $state<"quartered" | "halved">("quartered");
  let turns = $state<"none" | "light" | "medium" | "heavy">("light"); // turn intensity
  let turnVariation = $state<"clean" | "sprinkle" | "spicy">("sprinkle");
  let turnPatterns = $state<Set<string>>(new Set(["Hold 1", "Pulse 1"]));
  let propRev = $state<"smooth" | "mixed" | "choppy">("smooth");
  let handRev = $state<"smooth" | "mixed" | "choppy">("mixed");
  let dashes = $state<"low" | "mixed" | "high">("mixed");
  let startMode = $state<"all" | "classic" | "specific">("all");
  let showDetail = $state(false);
  let showOrient = $state(false);
  let seed = $state(mintSeed());

  const TURN_PATTERNS = ["Hold 1", "Pulse 1", "Trade 1", "½/1 Trade", "Wave 2·1"];
  function togglePattern(p: string) {
    const next = new Set(turnPatterns); next.has(p) ? next.delete(p) : next.add(p); turnPatterns = next;
  }
  function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---- derived ----------------------------------------------------------------
  const wordMode = $derived(word.trim().length > 0);
  // Generation fans each base seed across the variation axes → the real card space is deep.
  const variationMultiplier = $derived(
    (turns === "none" ? 1 : 4) * (period === "quartered" ? 2 : 1) *
    (propRev === "smooth" ? 1 : 2) * (handRev === "smooth" ? 1 : 2),
  );
  const wordVariations = $derived(wordMode ? Math.max(1, word.trim().length * 6) * variationMultiplier : 0);
  const cardSpace = $derived(wordMode ? wordVariations : baseLoops(stepCount, loopType) * variationMultiplier);
  const requested = $derived(wordMode ? wordVariations : deckSize); // word deck = ALL variations
  const drawCount = $derived(Math.min(requested, cardSpace));
  // Rare: only when you ask for more UNIQUE cards than the entire variation space holds.
  const exhausted = $derived(requested > cardSpace);

  const customizeSummary = $derived(
    propRev === "smooth" && handRev === "mixed" && dashes === "mixed" &&
    turns === "light" && turnVariation === "sprinkle" ? "Default" : "Custom",
  );
  const orientSummary = $derived(
    (orientation === "nonradial" ? "Non-radial" : cap(orientation)) +
    (startMode === "all" ? "" : ` · ${cap(startMode)}`),
  );

  const recipe = $derived({
    schemaVersion: 1, generatorVersion: "loop-gen@0.1.0", seed,
    params: {
      ...(wordMode ? { word: word.trim().toUpperCase(), deck: "all-variations" } : { deckSize }),
      loopType, stepCount, level, grid, orientation, startMode, period,
      propReversals: propRev, handReversals: handRev, dashes,
      turnIntensity: turns, turnVariation, turnPatterns: [...turnPatterns],
    },
  });

  const drawPreview = $derived.by(() => {
    const [a, b, cc, d] = cyrb128(JSON.stringify(recipe));
    const rand = sfc32(a, b, cc, d);
    const n = Math.min(drawCount, 24);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = Math.floor(rand() * Math.max(1, cardSpace)).toString(36).toUpperCase().padStart(4, "0");
      out.push(wordMode ? `${word.trim().slice(0, 3).toUpperCase()}·${id}` : `${loopType.slice(0, 3)}-${stepCount}-${id}`);
    }
    return out;
  });

  let copied = $state(false);
  async function copyRecipe() {
    try { await navigator.clipboard.writeText(JSON.stringify(recipe, null, 2)); copied = true; setTimeout(() => (copied = false), 1600); }
    catch (e) { console.error(e); }
  }
  function generate() { seed = mintSeed(); }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
</script>

<svelte:head><title>Unified Generation — Bento Grid Prototype</title></svelte:head>

<div class="harness">
  <header class="topbar">
    <span class="badge">Deck Generator</span>
    <p class="ctx-note">Generate a deck the way you generate a sequence. {#if wordMode}<strong>Word mode:</strong> drawing every variation of “{word.trim().toUpperCase()}”.{:else}Pick dials → <strong>Generate</strong> draws {drawCount}.{/if}</p>
  </header>
  <div class="mock-banner"><i class="fas fa-flask"></i> Counts are <strong>illustrative placeholders</strong>, not computed. Real enumeration (closed-form ceiling) is Phase&nbsp;0/2. This prototype is for layout & feel.</div>

  <div class="layout">
    <section class="grid-pane">
      <div class="grid-stage">
      <div class="card-grid">
        <!-- Row 1 -->
        {#if wordEditing}
          <div class="word-edit" style="--c: {c.mode.color}" style:grid-column="span 2">
            <span class="we-label">Word</span>
            <input
              class="we-input"
              autofocus
              placeholder="A–Z"
              bind:value={word}
              onblur={() => (wordEditing = false)}
              onkeydown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
        {:else}
          <BaseCard title="Word" currentValue={wordMode ? word.trim().toUpperCase() : "A–Z"} color={c.mode.color} shadowColor={c.mode.shadowColor} gridColumnSpan={2} onClick={() => (wordEditing = true)} />
        {/if}

        {#if wordMode}
          <BaseCard title="Deck" currentValue={`${drawCount} vars`} color={c.favorite.color} shadowColor={c.favorite.shadowColor} gridColumnSpan={2} clickable={false} />
        {:else}
          <StepperCard title="Deck Size" currentValue={deckSize} minValue={1} maxValue={200} color={c.favorite.color} shadowColor={c.favorite.shadowColor} gridColumnSpan={2} onIncrement={() => (deckSize = clamp(deckSize + 1, 1, 200))} onDecrement={() => (deckSize = clamp(deckSize - 1, 1, 200))} />
        {/if}

        <StepperCard title="Length" currentValue={stepCount} minValue={4} maxValue={16} description="STEP COUNT" color={c.length.color} shadowColor={c.length.shadowColor} gridColumnSpan={2} onIncrement={() => (stepCount = clamp(stepCount + 2, 4, 16))} onDecrement={() => (stepCount = clamp(stepCount - 2, 4, 16))} />

        <!-- Row 2 -->
        <StepperCard title="Level" currentValue={level} minValue={1} maxValue={4} description="BASE MOTIONS" color={c.level.color} shadowColor={c.level.shadowColor} gridColumnSpan={2} onIncrement={() => (level = clamp(level + 1, 1, 4))} onDecrement={() => (level = clamp(level - 1, 1, 4))} />

        <ToggleCard title="Grid" option1={{ value: "diamond", label: "Diamond" }} option2={{ value: "box", label: "Box" }} activeOption={grid} onToggle={(v) => (grid = v as typeof grid)} color={c.gridMode.color} shadowColor={c.gridMode.shadowColor} gridColumnSpan={2} />

        <BaseCard title="Orientation" currentValue={orientSummary} color={c.duration.color} shadowColor={c.duration.shadowColor} gridColumnSpan={2} onClick={() => (showOrient = !showOrient)} />

        <!-- Row 3 -->
        <BaseCard title="Customize" currentValue={customizeSummary} color={c.customize.color} shadowColor={c.customize.shadowColor} gridColumnSpan={2} onClick={() => (showDetail = !showDetail)} />

        <BaseCard title="Loop" currentValue={LOOP_TYPE_LABELS[loopType]} color={LOOP_COLOR} shadowColor={LOOP_SHADOW} gridColumnSpan={2} onClick={() => (showLoop = true)} />

        <ToggleCard title="Period" option1={{ value: "quartered", label: "Quartered" }} option2={{ value: "halved", label: "Halved" }} activeOption={period} onToggle={(v) => (period = v as typeof period)} color={c.period.color} shadowColor={c.period.shadowColor} gridColumnSpan={2} />

        <!-- Row 4 -->
        <button class="generate" style:grid-column="span 6" onclick={generate}>
          <i class="fas fa-dice"></i>
          <span>{wordMode ? `Generate ${drawCount} variations` : `Generate ${drawCount}`}</span>
        </button>
      </div>
        {#if showLoop}
          <LOOPExpandedOverlay
            currentType={loopType}
            selectedComponents={loopComponents}
            onChange={(lt: LOOPType) => { loopType = lt; loopComponents = parseLoopComponents(lt); showLoop = false; }}
            onClose={() => (showLoop = false)}
          />
        {/if}
      </div>

      {#if showOrient}
        <div class="detail">
          <span class="detail-title">Orientation &amp; Start</span>
          <div class="brow"><span class="brow-label">Orientation</span><div class="opts">
            {#each [["radial", "Radial"], ["nonradial", "Non-radial"], ["split", "Split"]] as [v, l]}
              <button class="opt" class:on={orientation === v} onclick={() => (orientation = v as typeof orientation)}>{l}</button>
            {/each}
          </div></div>
          <div class="brow"><span class="brow-label">Start</span><div class="opts">
            {#each [["all", "All"], ["classic", "Classic 3"], ["specific", "Specific"]] as [v, l]}
              <button class="opt" class:on={startMode === v} onclick={() => (startMode = v as typeof startMode)}>{l}</button>
            {/each}
          </div></div>
          <p class="detail-note">Start position folds in here. “Specific” reveals the position grid (deep tier).</p>
        </div>
      {/if}

      {#if showDetail}
        <div class="detail">
          <span class="detail-title">Customize · Style</span>
          <div class="brow"><span class="brow-label">Props</span><div class="opts">
            {#each [["smooth", "Smooth"], ["mixed", "Mixed"], ["choppy", "Choppy"]] as [v, l]}
              <button class="opt" class:on={propRev === v} onclick={() => (propRev = v as typeof propRev)}>{l}</button>
            {/each}
          </div></div>
          <div class="brow"><span class="brow-label">Hands</span><div class="opts">
            {#each [["smooth", "Smooth"], ["mixed", "Mixed"], ["choppy", "Choppy"]] as [v, l]}
              <button class="opt" class:on={handRev === v} onclick={() => (handRev = v as typeof handRev)}>{l}</button>
            {/each}
          </div></div>
          <div class="brow"><span class="brow-label">Dashes</span><div class="opts">
            {#each [["low", "Low"], ["mixed", "Mixed"], ["high", "High"]] as [v, l]}
              <button class="opt" class:on={dashes === v} onclick={() => (dashes = v as typeof dashes)}>{l}</button>
            {/each}
          </div></div>
          <span class="detail-title">Customize · Turns</span>
          <div class="brow"><span class="brow-label">Intensity</span><div class="opts">
            {#each [["none", "None"], ["light", "Light"], ["medium", "Medium"], ["heavy", "Heavy"]] as [v, l]}
              <button class="opt" class:on={turns === v} onclick={() => (turns = v as typeof turns)}>{l}</button>
            {/each}
          </div></div>
          <div class="brow"><span class="brow-label">Variation</span><div class="opts">
            {#each [["clean", "Clean"], ["sprinkle", "Sprinkle"], ["spicy", "Spicy"]] as [v, l]}
              <button class="opt" class:on={turnVariation === v} onclick={() => (turnVariation = v as typeof turnVariation)}>{l}</button>
            {/each}
          </div></div>
          <div class="brow"><span class="brow-label">Patterns</span><div class="pills">
            {#each TURN_PATTERNS as p}
              <button class="pill" class:on={turnPatterns.has(p)} onclick={() => togglePattern(p)}>{p}</button>
            {/each}
          </div></div>
          <p class="detail-note">Per-step turn &amp; reversal editors are the deep tier (drill-in from here).</p>
        </div>
      {/if}
    </section>

    <aside class="rail">
      <div class="stat">
        <div class="stat-big" class:warn={exhausted}>{drawCount}</div>
        <div class="stat-sub">{wordMode ? "variations of the word" : "fresh cards"}<span class="mocktag">illustrative — not computed</span></div>
      </div>

      <div class="recipe-head"><span>Recipe (durable truth)</span><button class="copy" onclick={copyRecipe}>{copied ? "Copied!" : "Copy"}</button></div>
      <pre class="recipe"><code>{JSON.stringify(recipe, null, 2)}</code></pre>

      <div class="draw-head">Draw preview <span class="seed-tag">seed {seed.slice(0, 8)}…</span></div>
      <div class="draw-list">{#each drawPreview as id}<span class="draw-id">{id}</span>{/each}</div>
    </aside>
  </div>
</div>

<style>
  .harness {
    min-height: 100vh; padding-bottom: 60px; color: #f5f5f5;
    background: radial-gradient(circle at 30% 12%, #16203a, #0a0d18 70%);
    /* theme vars the real cards read */
    --theme-text: #f5f5f5; --theme-stroke: rgba(255, 255, 255, 0.2);
    --theme-stroke-strong: rgba(255, 255, 255, 0.3); --theme-shadow: rgba(0, 0, 0, 0.35);
    --theme-card-bg: rgba(255, 255, 255, 0.06); --theme-accent: #818cf8; --theme-accent-strong: #6366f1;
    --semantic-success: #22c55e; --semantic-info: #3b82f6; --semantic-warning: #f59e0b;
    --min-touch-target: 44px;
    --duration-instant: 90ms; --duration-fast: 150ms; --duration-normal: 220ms;
    --duration-emphasis: 300ms; --duration-dramatic: 450ms;
    --card-text-size: 22px; --card-text-weight: 800; --card-text-spacing: 0.3px;
    --card-text-shadow: 0 2px 6px rgba(0, 0, 0, 0.45); --element-spacing: 10px;
  }
  .topbar {
    position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
    padding: 14px 28px; background: rgba(10, 13, 24, 0.9); backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .badge { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #06121a; background: #22c55e; padding: 5px 12px; border-radius: 999px; }
  .ctx-note { margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.65); }
  .ctx-note strong { color: #22c55e; }
  .mock-banner { display: flex; align-items: center; gap: 8px; max-width: 1180px; margin: 12px auto 0; padding: 8px 28px; font-size: 12px; color: #fbbf24; }
  .mock-banner strong { color: #fbbf24; }
  .mocktag { color: #fbbf24; font-size: 11px; opacity: 0.85; }

  .layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.8fr); gap: 24px; max-width: 1180px; margin: 28px auto 0; padding: 0 28px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

  .grid-pane { display: flex; flex-direction: column; gap: 14px; }
  .grid-stage { position: relative; }
  .card-grid {
    display: grid; grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-auto-rows: 112px; gap: 10px; width: 100%; max-width: 760px; margin: 0 auto;
  }
  .card-grid > :global(*) { grid-column: span 2; min-width: 0; }

  /* word edit tile mirrors the base-card look while typing */
  .word-edit {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    border-radius: 16px; background: var(--c); padding: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }
  .we-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: rgba(255, 255, 255, 0.85); }
  .we-input {
    width: 100%; background: rgba(0, 0, 0, 0.25); border: 1.5px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px; color: #fff; font-size: 20px; font-weight: 700; letter-spacing: 1.5px;
    text-align: center; text-transform: uppercase; padding: 8px; outline: none;
  }
  .we-input:focus { border-color: rgba(255, 255, 255, 0.6); }

  .generate {
    display: flex; align-items: center; justify-content: center; gap: 12px; border: none; cursor: pointer;
    border-radius: 20px; color: #06121a; font-size: 20px; font-weight: 800; letter-spacing: 0.3px;
    background: linear-gradient(135deg, color-mix(in srgb, #22c55e 85%, #065f46) 0%, #22c55e 25%, color-mix(in srgb, #22c55e 100%, #a7f3d0) 50%, #22c55e 75%, color-mix(in srgb, #22c55e 85%, #065f46) 100%);
    box-shadow: 0 4px 14px color-mix(in srgb, #22c55e 45%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: transform 200ms, filter 200ms;
  }
  .generate:hover { filter: brightness(1.12) saturate(1.1); transform: scale(1.01); }
  .generate:active { transform: scale(0.985); }
  .generate i { font-size: 22px; }

  .detail {
    max-width: 760px; margin: 0 auto; width: 100%;
    background: rgba(6, 182, 212, 0.1); border: 1.5px solid rgba(6, 182, 212, 0.3);
    border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
  }
  .detail-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255, 255, 255, 0.6); }
  .pills { display: flex; gap: 8px; flex-wrap: wrap; }
  .brow { display: flex; align-items: center; gap: 12px; }
  .brow-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255, 255, 255, 0.5); min-width: 72px; flex-shrink: 0; }
  .opts { display: flex; gap: 4px; flex: 1; }
  .opt { flex: 1; min-height: 40px; background: rgba(0, 0, 0, 0.25); border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 10px; color: rgba(255, 255, 255, 0.7); cursor: pointer; font-weight: 600; font-size: 12px; padding: 4px 6px; transition: all 150ms; }
  .opt:active { transform: scale(0.96); }
  .opt.on { background: rgba(6, 182, 212, 0.28); border-color: rgba(6, 182, 212, 0.7); color: #fff; box-shadow: 0 0 12px rgba(6, 182, 212, 0.2); }
  .pill { padding: 8px 16px; border-radius: 999px; border: 1.5px solid rgba(255, 255, 255, 0.18); background: rgba(0, 0, 0, 0.25); color: rgba(255, 255, 255, 0.75); font-size: 13px; font-weight: 600; cursor: pointer; }
  .pill.on { background: rgba(6, 182, 212, 0.25); border-color: rgba(6, 182, 212, 0.7); color: #fff; }
  .detail-note { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.45); }

  .rail { display: flex; flex-direction: column; gap: 14px; }
  .stat { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; text-align: center; }
  .stat-big { font-size: 44px; font-weight: 800; color: #22c55e; font-variant-numeric: tabular-nums; line-height: 1; }
  .stat-big.warn { color: #fbbf24; }
  .stat-sub { margin-top: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.55); display: flex; flex-direction: column; gap: 2px; }
  .cap { color: #fbbf24; } .ok { color: rgba(255, 255, 255, 0.4); }
  .recipe-head, .draw-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.5); }
  .copy { padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: none; color: #fff; font-size: 12px; cursor: pointer; }
  .recipe { margin: 0; max-height: 300px; overflow: auto; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.5; color: #cbd5e1; }
  .seed-tag { font-weight: 500; text-transform: none; color: #22c55e; font-variant-numeric: tabular-nums; }
  .draw-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .draw-id { font-size: 11px; font-family: ui-monospace, monospace; padding: 3px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.75); }
</style>
