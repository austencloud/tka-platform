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
  import TurnIntensityCard from "$lib/features/create/generate/components/cards/TurnIntensityCard.svelte";
  import StartPositionPicker from "$lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte";
  import { createSimplifiedStartPositionState } from "$lib/shared/create/state/start-position-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  const c = getCardColors(BackgroundType.COSMIC); // DEFAULT_COLORS gradients
  const LOOP_COLOR = "linear-gradient(135deg, #a3a32a 0%, #8a8a22 50%, #6b6b1a 100%)";
  const LOOP_SHADOW = "60deg 55% 35%";

  // Props/Hands/Dashes as 3-position steppers (Smooth→Mixed→Choppy).
  const TRI = ["smooth", "mixed", "choppy"] as const;
  const TRI_LABEL = ["Smooth", "Mixed", "Choppy"];
  const DASH = ["low", "mixed", "high"] as const;
  const DASH_LABEL = ["Low", "Mixed", "High"];
  function stepArr<T extends string>(arr: readonly T[], cur: T, dir: number): T {
    return arr[Math.max(0, Math.min(arr.length - 1, arr.indexOf(cur) + dir))]!;
  }
  // Deck size = preset choice, not a 1-by-1 dial. These decks get PRINTED (poker 2.5x3.5,
  // MPC pipeline), so stops are print-run-friendly. 52 = standard deck (default anchor),
  // 54 = +2 jokers, 36 = small run, 72 = double pack. Retune freely.
  const DECK_PRESETS = [36, 52, 54, 72];
  const STYLE_COLORS = {
    props: { color: c.continuity.color, shadow: c.continuity.shadowColor },
    hands: { color: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)", shadow: "245deg 70% 55%" },
    dashes: { color: "linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%)", shadow: "25deg 90% 55%" },
  };

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
  let loopType = $state<LOOPType>(LOOPType.ROTATED);
  let loopComponents = $state<Set<LOOPComponent>>(parseLoopComponents(LOOPType.ROTATED));
  let showLoop = $state(false);
  let period = $state<"quartered" | "halved">("quartered");
  let turnIntensity = $state(1); // max turn intensity — generator model; appears at Level 2+
  let propRev = $state<"smooth" | "mixed" | "choppy">("smooth");
  let handRev = $state<"smooth" | "mixed" | "choppy">("mixed");
  let dashes = $state<"low" | "mixed" | "high">("mixed");
  let seed = $state(mintSeed());

  // Start Position & Orientation: reuse the REAL picker (3 positions / 16 variations grid,
  // Diamond/Box toggle, per-hand orientation cyclers). Grid mode now lives in here, so the
  // standalone Grid toggle tile is gone.
  const posOri = createSimplifiedStartPositionState();
  let showPosOri = $state(false);

  // Deck Prop: reuse the real BentoPropGrid (props by family). The deck's prop is part of the
  // recipe — it overrides the user's saved global prop setting at generation time.
  let propType = $state<PropType>(PropType.STAFF);
  let showProp = $state(false);
  const propLabel = $derived(propType.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));
  const oriShort = (o: Orientation): string =>
    ({ [Orientation.IN]: "In", [Orientation.OUT]: "Out", [Orientation.CLOCK]: "Clock", [Orientation.COUNTER]: "Counter" } as Record<string, string>)[o] ?? String(o);

  // ---- derived ----------------------------------------------------------------
  const wordMode = $derived(word.trim().length > 0);
  // Generation fans each base seed across the variation axes → the real card space is deep.
  const turnAllowed = $derived(level >= 3 ? [0, 0.5, 1, 1.5, 2, 2.5, 3] : [0, 1, 2, 3]);
  const variationMultiplier = $derived(
    (level > 1 && turnIntensity > 0 ? 4 : 1) * (period === "quartered" ? 2 : 1) *
    (propRev === "smooth" ? 1 : 2) * (handRev === "smooth" ? 1 : 2),
  );
  const wordVariations = $derived(wordMode ? Math.max(1, word.trim().length * 6) * variationMultiplier : 0);
  const cardSpace = $derived(wordMode ? wordVariations : baseLoops(stepCount, loopType) * variationMultiplier);
  const requested = $derived(wordMode ? wordVariations : deckSize); // word deck = ALL variations
  const drawCount = $derived(Math.min(requested, cardSpace));
  // Rare: only when you ask for more UNIQUE cards than the entire variation space holds.
  const exhausted = $derived(requested > cardSpace);

  const gridLabel = $derived(posOri.currentGridMode === GridMode.DIAMOND ? "Diamond" : "Box");
  const posOriSummary = $derived.by(() => {
    const b = posOri.blueOrientation, r = posOri.redOrientation;
    const ori = b === r ? oriShort(b) : `${oriShort(b)}/${oriShort(r)}`;
    const pos = posOri.selectedPosition?.startPosition;
    return pos ? `${pos} · ${gridLabel}` : `${gridLabel} · ${ori}`;
  });

  const recipe = $derived({
    schemaVersion: 1, generatorVersion: "loop-gen@0.1.0", seed,
    params: {
      ...(wordMode ? { word: word.trim().toUpperCase(), deck: "all-variations" } : { deckSize }),
      loopType, stepCount, level, period, prop: propType,
      grid: posOri.currentGridMode === GridMode.DIAMOND ? "diamond" : "box",
      startPosition: posOri.selectedPosition?.startPosition ?? "any",
      blueOrientation: posOri.blueOrientation, redOrientation: posOri.redOrientation,
      propReversals: propRev, handReversals: handRev, dashes,
      ...(level > 1 ? { turnIntensity } : {}),
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
  function cycleDeck() { deckSize = DECK_PRESETS[(DECK_PRESETS.indexOf(deckSize) + 1) % DECK_PRESETS.length] ?? 52; }
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
        <div class="tile" style:view-transition-name="t-word">
        {#if wordEditing}
          <div class="word-edit" style="--c: {c.mode.color}">
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
        </div>

        <div class="tile" style:view-transition-name="t-deck">
        {#if wordMode}
          <BaseCard title="Deck" currentValue={`${drawCount} vars`} color={c.favorite.color} shadowColor={c.favorite.shadowColor} gridColumnSpan={2} clickable={false} />
        {:else}
          <BaseCard title="Deck Size" currentValue={`${deckSize}`} color={c.favorite.color} shadowColor={c.favorite.shadowColor} gridColumnSpan={2} onClick={cycleDeck} />
        {/if}
        </div>

        <div class="tile" style:view-transition-name="t-length">
        <StepperCard title="Length" currentValue={stepCount} minValue={4} maxValue={16} description="STEP COUNT" color={c.length.color} shadowColor={c.length.shadowColor} gridColumnSpan={2} onIncrement={() => (stepCount = clamp(stepCount + 2, 4, 16))} onDecrement={() => (stepCount = clamp(stepCount - 2, 4, 16))} />
        </div>

        <!-- Row 2 -->
        <div class="tile" style:view-transition-name="t-level">
        <StepperCard title="Level" currentValue={level} minValue={1} maxValue={4} description="BASE MOTIONS" color={c.level.color} shadowColor={c.level.shadowColor} gridColumnSpan={2} onIncrement={() => (level = clamp(level + 1, 1, 4))} onDecrement={() => (level = clamp(level - 1, 1, 4))} />
        </div>

        <div class="tile">
        <BaseCard title="Prop" currentValue={propLabel} color={c.gridMode.color} shadowColor={c.gridMode.shadowColor} gridColumnSpan={2} onClick={() => (showProp = true)} />
        </div>

        <div class="tile">
        <BaseCard title="Pos & Ori" currentValue={posOriSummary} color={c.duration.color} shadowColor={c.duration.shadowColor} gridColumnSpan={2} onClick={() => (showPosOri = true)} />
        </div>

        <!-- Row 3 -->
        <div class="tile" style:view-transition-name="t-loop">
        <BaseCard title="Loop" currentValue={LOOP_TYPE_LABELS[loopType]} color={LOOP_COLOR} shadowColor={LOOP_SHADOW} gridColumnSpan={2} onClick={() => (showLoop = true)} />
        </div>

        <div class="tile" style:view-transition-name="t-period">
        <ToggleCard title="Period" option1={{ value: "quartered", label: "Quartered" }} option2={{ value: "halved", label: "Halved" }} activeOption={period} onToggle={(v) => (period = v as typeof period)} color={c.period.color} shadowColor={c.period.shadowColor} gridColumnSpan={2} />
        </div>

      </div>

      <!-- Style row in its OWN flex container so the Turns tile can never wrap onto the dials
           rows (that caused the row-2 flash). The collapse morph stays inside this row. -->
      <div class="card-grid style-row">
        <div class="tile turns" class:collapsed={level <= 1} aria-hidden={level <= 1}>
        <TurnIntensityCard currentIntensity={turnIntensity} allowedValues={turnAllowed} onIntensityChange={(v: number) => (turnIntensity = v)} shadowColor="140deg 70% 45%" gridColumnSpan={2} />
        </div>

        <div class="tile">
        <StepperCard title="Props" currentValue={TRI.indexOf(propRev)} minValue={0} maxValue={2} description="REVERSALS" formatValue={(i: number) => TRI_LABEL[i] ?? ""} color={STYLE_COLORS.props.color} shadowColor={STYLE_COLORS.props.shadow} gridColumnSpan={2} onIncrement={() => (propRev = stepArr(TRI, propRev, 1))} onDecrement={() => (propRev = stepArr(TRI, propRev, -1))} />
        </div>
        <div class="tile">
        <StepperCard title="Hands" currentValue={TRI.indexOf(handRev)} minValue={0} maxValue={2} description="REVERSALS" formatValue={(i: number) => TRI_LABEL[i] ?? ""} color={STYLE_COLORS.hands.color} shadowColor={STYLE_COLORS.hands.shadow} gridColumnSpan={2} onIncrement={() => (handRev = stepArr(TRI, handRev, 1))} onDecrement={() => (handRev = stepArr(TRI, handRev, -1))} />
        </div>
        <div class="tile">
        <StepperCard title="Dashes" currentValue={DASH.indexOf(dashes)} minValue={0} maxValue={2} description="FREQUENCY" formatValue={(i: number) => DASH_LABEL[i] ?? ""} color={STYLE_COLORS.dashes.color} shadowColor={STYLE_COLORS.dashes.shadow} gridColumnSpan={2} onIncrement={() => (dashes = stepArr(DASH, dashes, 1))} onDecrement={() => (dashes = stepArr(DASH, dashes, -1))} />
        </div>
      </div>

      <!-- Generate — full width, its own row below both grids -->
      <button class="generate" onclick={generate}>
        <i class="fas fa-dice"></i>
        <span>{wordMode ? `Generate ${drawCount} variations` : `Generate ${drawCount}`}</span>
      </button>
        {#if showLoop}
          <LOOPExpandedOverlay
            currentType={loopType}
            selectedComponents={loopComponents}
            onChange={(lt: LOOPType) => { loopType = lt; loopComponents = parseLoopComponents(lt); showLoop = false; }}
            onClose={() => (showLoop = false)}
          />
        {/if}

        {#if showPosOri}
          <div class="picker-overlay" transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}>
            <div class="po-header">
              <h3>Start Position &amp; Orientation</h3>
              <button class="po-close" aria-label="Close" onclick={() => (showPosOri = false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="po-body">
              <StartPositionPicker startPositionState={posOri} />
            </div>
            <button class="po-done" onclick={() => (showPosOri = false)}>Done</button>
          </div>
        {/if}

        {#if showProp}
          <div class="picker-overlay" transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}>
            <div class="po-header">
              <h3>Deck Prop</h3>
              <button class="po-close" aria-label="Close" onclick={() => (showProp = false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="po-body">
              <BentoPropGrid selectedPropType={propType} variant="inline" title="Select Prop" onSelect={(p: PropType) => { propType = p; showProp = false; }} />
            </div>
            <button class="po-done" onclick={() => (showProp = false)}>Done</button>
          </div>
        {/if}
      </div>
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
  .grid-stage { position: relative; display: flex; flex-direction: column; gap: 10px; }
  /* Flex-wrap, not fixed grid: whatever lands on the last row stretches to fill the
     width equally (3-up stretched when Turns is hidden, 4-up when it appears) — no holes
     at any tile count, and the reflow is the thing that can animate on add/remove. */
  .card-grid {
    display: flex; flex-wrap: wrap; align-content: flex-start;
    gap: 10px; width: 100%; margin: 0;
  }
  .card-grid > .tile {
    flex: 1 1 230px; min-width: 200px; height: 120px; min-height: 0;
  }
  .tile > :global(*) { width: 100%; height: 100%; }
  /* Generate spans the full width on its own row, below both grids. */
  .grid-stage > .generate { width: 100%; height: auto; min-height: 92px; }

  @media (min-width: 1700px) { .layout { max-width: 1700px; } }

  /* Max Turns morph: always mounted. Animating its flex-basis 230->0 makes the row
     re-flow live every frame, so the sibling style tiles shrink/grow their REAL width
     with crisp content — no bitmap cross-fade, no remount. */
  .tile.turns {
    min-width: 0; overflow: hidden;
    transition: flex-basis 340ms cubic-bezier(0.4, 0, 0.2, 1),
                flex-grow 340ms cubic-bezier(0.4, 0, 0.2, 1),
                margin-right 340ms cubic-bezier(0.4, 0, 0.2, 1),
                opacity 240ms ease;
  }
  .tile.turns.collapsed {
    flex: 0 0 0; opacity: 0; pointer-events: none;
    margin-right: -10px; /* cancel the grid gap left by the zero-width tile */
  }
  @media (prefers-reduced-motion: reduce) {
    .tile.turns { transition-duration: 0.001ms; }
  }

  /* Unify typography across BaseCard / StepperCard / ToggleCard.
     Each component sized its value text differently (stepper up to 60px, base 22px,
     toggle option clamp 11–28px). Normalize to one hierarchy:
       single-value text (stepper number + base value) → 24px
       toggle option labels (two stacked) → 17px
       card headers (GRID, PROPS, …) → 11px */
  .card-grid :global(.value-number),
  .card-grid :global(.base-card .card-value) { font-size: 24px !important; line-height: 1.15 !important; }
  .card-grid :global(.option-label) { font-size: 17px !important; }
  .card-grid :global(.card-title) { font-size: 11px !important; letter-spacing: 0.8px !important; }

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
    border-radius: 20px; color: #fff; font-size: 24px; font-weight: 800; letter-spacing: 0.3px;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
    background: linear-gradient(135deg, color-mix(in srgb, #22c55e 85%, #065f46) 0%, #22c55e 25%, color-mix(in srgb, #22c55e 100%, #a7f3d0) 50%, #22c55e 75%, color-mix(in srgb, #22c55e 85%, #065f46) 100%);
    box-shadow: 0 4px 14px color-mix(in srgb, #22c55e 45%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: transform 200ms, filter 200ms;
  }
  .generate:hover { filter: brightness(1.12) saturate(1.1); transform: scale(1.01); }
  .generate:active { transform: scale(0.985); }
  .generate i { font-size: 22px; }

  /* Full-stage picker overlay (Pos & Ori), styled to match LOOPExpandedOverlay. */
  .picker-overlay {
    position: absolute; inset: 0; z-index: 100;
    display: flex; flex-direction: column; gap: 10px; padding: 12px;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%);
    border-radius: 16px; border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 24px color-mix(in srgb, var(--theme-accent) 30%, transparent);
    overflow: hidden;
  }
  .po-header { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .po-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; letter-spacing: 0.3px; }
  .po-close {
    background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px;
    color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; padding: 8px;
  }
  .po-close svg { width: 20px; height: 20px; }
  .po-close:hover { background: rgba(255, 255, 255, 0.15); }
  .po-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
  .po-done {
    flex-shrink: 0; width: 100%; padding: 12px 20px; min-height: 44px;
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border: 2px solid var(--theme-accent); border-radius: 10px; color: #fff;
    font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;
  }
  .po-done:hover { background: color-mix(in srgb, var(--theme-accent) 45%, transparent); }

  .rail { display: flex; flex-direction: column; gap: 14px; }
  .stat { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; text-align: center; }
  .stat-big { font-size: 44px; font-weight: 800; color: #22c55e; font-variant-numeric: tabular-nums; line-height: 1; }
  .stat-big.warn { color: #fbbf24; }
  .stat-sub { margin-top: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.55); display: flex; flex-direction: column; gap: 2px; }
  .recipe-head, .draw-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.5); }
  .copy { padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2); background: none; color: #fff; font-size: 12px; cursor: pointer; }
  .recipe { margin: 0; max-height: 300px; overflow: auto; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.5; color: #cbd5e1; }
  .seed-tag { font-weight: 500; text-transform: none; color: #22c55e; font-variant-numeric: tabular-nums; }
  .draw-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .draw-id { font-size: 11px; font-family: ui-monospace, monospace; padding: 3px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.75); }
</style>
