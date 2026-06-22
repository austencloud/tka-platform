<!--
  PositionsConceptExperience — Hand Positions lesson ("the grid way").

  Walkthrough (alpha → beta → gamma, one hero pictograph, blue anchored at south,
  red animates N → S → E) → compare beat (the three morph into a row) → tap a
  position to open a transform playground that proves the Symmetry Invariance
  Principle: rotate / mirror / swap-colors, the letter never changes, and a
  discovery tray fills in (8 for alpha/beta, 16 for gamma).

  Real assets: animated hand prop via propSvgLoader, real grid hand-points
  (grid-coordinates.ts), canonical letter glyph (TKAGlyph), canonical bases
  (alpha1 / beta5 / gamma11). Transforms are one-shot algebra on the live state.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/prop-svg-loader";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import type { PropPlacementData } from "$lib/shared/pictograph/prop/domain/models/prop-placement-data";
  import LessonGridDisplay from "$lib/features/learn/components/interactive/LessonGridDisplay.svelte";
  import type { ExperienceViewMode } from "../../../domain/types";

  let { onComplete, viewMode = "step" } = $props<{
    onComplete?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  type SvgData = { svgContent: string; viewBox: { width: number; height: number }; center: { x: number; y: number } };
  type Pt = { x: number; y: number };

  // The 8 hand points around the grid (radius ~143 from center), clockwise from N.
  // Even index = diamond (cardinal); odd index = box (intercardinal). grid-coordinates.ts.
  const PTS: Pt[] = [
    { x: 475.0, y: 331.9 }, // 0  N  diamond
    { x: 576.2, y: 373.8 }, // 1  NE box
    { x: 618.1, y: 475.0 }, // 2  E  diamond
    { x: 576.2, y: 576.2 }, // 3  SE box
    { x: 475.0, y: 618.1 }, // 4  S  diamond
    { x: 373.8, y: 576.2 }, // 5  SW box
    { x: 331.9, y: 475.0 }, // 6  W  diamond
    { x: 373.8, y: 373.8 }, // 7  NW box
  ];
  const isDiamondPt = (idx: number) => idx % 2 === 0;
  const wrap8 = (n: number) => ((n % 8) + 8) % 8;

  // beta's two hand props share one grid point; offset them a constant L/R amount.
  const BETA_DX = 16;

  type PosKind = "alpha" | "beta" | "gamma";
  type PosStep = { name: string; vtg: string; kind: PosKind; caption: string };
  const steps: PosStep[] = [
    { name: "Alpha", vtg: "Split", kind: "alpha", caption: "Hands at opposite points on the grid." },
    { name: "Beta", vtg: "Together", kind: "beta", caption: "Both hands at the same point." },
    { name: "Gamma", vtg: "Quarter", kind: "gamma", caption: "Hands at neighboring points, a right angle apart." },
  ];
  // Canonical bases (blue,red): blue anchors south, red animates N → S → E.
  //   alpha1 = blue S, red N | beta5 = blue S, red S | gamma11 = blue S, red E
  const BASE: Record<PosKind, { red: number; blue: number }> = {
    alpha: { red: 0, blue: 4 },
    beta: { red: 4, blue: 4 },
    gamma: { red: 2, blue: 4 },
  };

  // Canonical letter glyph, bottom-left at x=50 y=800 in the 950 space (per TKAGlyph).
  const GLYPH: Record<PosKind, { src: string; w: number; h: number }> = {
    alpha: { src: "/images/letters_trimmed/Type6/α.svg", w: 92.22, h: 100 },
    beta: { src: "/images/letters_trimmed/Type6/β.svg", w: 66.05, h: 100 },
    gamma: { src: "/images/letters_trimmed/Type6/γ.svg", w: 79, h: 100.11 },
  };

  // Hands from explicit current point indices. Transforms mutate these directly
  // (one-shot algebra), so rotation stays clockwise no matter what came before.
  function handsFor(kind: PosKind, redIdx: number, blueIdx: number) {
    const rp = PTS[redIdx]!;
    let red: Pt = rp;
    let blue: Pt = PTS[blueIdx]!;
    if (kind === "beta") {
      red = { x: rp.x + BETA_DX, y: rp.y };
      blue = { x: rp.x - BETA_DX, y: rp.y };
    }
    // discovery identity + variation count:
    //  alpha = 4 pairs × 2 colorings, beta = 8 points → 8; gamma = 8 pairs × 2 → 16.
    let cell: number, total: number;
    if (kind === "gamma") {
      const diff = wrap8(blueIdx - redIdx); // 2 (red leads) or 6 (blue leads)
      cell = redIdx + (diff === 2 ? 0 : 8);
      total = 16;
    } else {
      cell = redIdx;
      total = 8;
    }
    return { red, blue, diamond: isDiamondPt(redIdx), cell, total };
  }
  const baseHands = (kind: PosKind) => handsFor(kind, BASE[kind].red, BASE[kind].blue);

  const COMPARE = steps.length; // index of the compare-row stage
  const TOTAL = steps.length + 1;

  let i = $state(0);
  const isCompare = $derived(i === COMPARE);
  const step = $derived(steps[Math.min(i, steps.length - 1)]!);
  const lastIdx = steps.length - 1; // gamma
  const FLIP_MS = 600;
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

  // FLIP morph refs: big hero ↔ gamma row card; peel refs for alpha/beta.
  let heroEl = $state<HTMLDivElement>();
  let squareEls = $state<(HTMLElement | undefined)[]>([]);
  let figureEls = $state<(HTMLElement | undefined)[]>([]);
  let stackOriginLeft = 0;

  let redHand = $state<SvgData | null>(null);
  let blueHand = $state<SvgData | null>(null);

  async function loadHand(color: MotionColor): Promise<SvgData | null> {
    const motionData = { propType: PropType.HAND, color } as unknown as MotionData;
    const propData = {
      positionX: 0, positionY: 0, rotationAngle: 0,
      coordinates: null, svgCenter: null, svgMirrored: false,
      manualAdjustmentX: 0, manualAdjustmentY: 0,
    } as unknown as PropPlacementData;
    const r = await propSvgLoader.loadPropSvg(propData, motionData, true, { themeMode: "light" });
    return r.svgData as SvgData | null;
  }

  onMount(async () => {
    [redHand, blueHand] = await Promise.all([loadHand(MotionColor.RED), loadHand(MotionColor.BLUE)]);
  });

  function prefersReduced() {
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // FLIP: animate `el` from a previously-measured rect to its current spot.
  function flipFrom(el: HTMLElement | undefined, first: DOMRect | null) {
    if (!el || !first || prefersReduced()) return;
    const last = el.getBoundingClientRect();
    if (!last.width || !last.height) return;
    el.animate(
      [
        {
          transformOrigin: "top left",
          transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`,
        },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: FLIP_MS, easing: EASE },
    );
  }

  // alpha/beta peel: slides between own slot and gamma's column + fades.
  function peelTransition(node: Element, params: { slots: number }, opts?: { direction?: string }) {
    if (prefersReduced() || node === figureEls[lastIdx]) return { duration: 0 };
    const me = node.getBoundingClientRect();
    const g = squareEls[lastIdx]?.getBoundingClientRect();
    const targetLeft = g ? g.left : stackOriginLeft;
    const offset = targetLeft - me.left;
    const fadeOutEarly = opts?.direction === "out";
    return {
      delay: Math.max(0, params.slots - 1) * 90,
      duration: 520,
      easing: cubicOut,
      css: (t: number) => {
        const o = fadeOutEarly ? Math.max(0, (t - 0.45) / 0.55) : t;
        return `transform: translateX(${(1 - t) * offset}px); opacity: ${o};`;
      },
    };
  }

  // ---- transform playground: tap a position → prove invariance ----
  let focus = $state<number | null>(null);
  let redIdx = $state(0);
  let blueIdx = $state(0);
  let visited = $state<Set<number>>(new Set());
  let lastAction = $state("");
  // playground opens on an intro beat (explains the 3 transforms) before the buttons
  let phase = $state<"intro" | "play">("intro");

  // On mobile the playground opens as a full sheet (so it isn't buried below the row).
  let isMobile = $state(false);
  $effect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(max-width: 640px)");
    const update = () => (isMobile = mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  });

  const focusStep = $derived(focus === null ? null : steps[focus]);
  const focusHands = $derived(focusStep ? handsFor(focusStep.kind, redIdx, blueIdx) : null);
  const currentCell = $derived(focusHands ? focusHands.cell : 0);
  const focusTotal = $derived(focusHands ? focusHands.total : 8);

  $effect(() => {
    if (focus !== null && !visited.has(currentCell)) {
      visited = new Set(visited).add(currentCell);
    }
  });

  function openFocus(idx: number) {
    if (focus === idx) { focus = null; return; }
    focus = idx;
    const k = steps[idx]!.kind;
    redIdx = BASE[k].red; blueIdx = BASE[k].blue;
    visited = new Set();
    lastAction = "";
    phase = "intro";
  }
  function doRotate() {
    redIdx = wrap8(redIdx + 1); blueIdx = wrap8(blueIdx + 1);
    lastAction = `Rotated clockwise — still ${steps[focus!]!.name}.`;
  }
  function doMirror() {
    const nr = wrap8(8 - redIdx), nb = wrap8(8 - blueIdx);
    const noChange = nr === redIdx && nb === blueIdx;
    redIdx = nr; blueIdx = nb;
    lastAction = noChange
      ? `Mirror does nothing here — this one's symmetric. Still ${steps[focus!]!.name}.`
      : `Mirrored — still ${steps[focus!]!.name}.`;
  }
  function doSwap() {
    const noChange = redIdx === blueIdx;
    [redIdx, blueIdx] = [blueIdx, redIdx];
    lastAction = noChange
      ? `Swap does nothing here — both hands share a point. Still ${steps[focus!]!.name}.`
      : `Swapped colors — still ${steps[focus!]!.name}.`;
  }

  async function go(n: number) {
    focus = null;
    const from = i;
    const to = Math.max(0, Math.min(TOTAL - 1, n));
    if (to === from) return;

    const entering = to === COMPARE && from === lastIdx;
    const leaving = from === COMPARE && to === lastIdx;

    let firstRect: DOMRect | null = null;
    if (entering && heroEl) firstRect = heroEl.getBoundingClientRect();
    else if (leaving && squareEls[lastIdx]) firstRect = squareEls[lastIdx]!.getBoundingClientRect();
    if (leaving && firstRect) {
      stackOriginLeft = firstRect.left;
      const gFig = figureEls[lastIdx];
      if (gFig) gFig.style.opacity = "0";
    }

    i = to;
    await tick();

    if (entering) flipFrom(squareEls[lastIdx], firstRect);
    else if (leaving) flipFrom(heroEl, firstRect);
  }

  // Lets the shell's header Back step within the lesson before closing.
  export function handleBack() {
    if (i > 0) go(i - 1);
  }
</script>

{#snippet hand(sd: SvgData, p: Pt, mirror: boolean)}
  <g
    class="hand"
    style="transform: translate({p.x}px, {p.y}px) {mirror ? 'scaleX(-1) ' : ''}translate({-sd.center.x}px, {-sd.center.y}px);"
  >
    {@html sd.svgContent}
  </g>
{/snippet}

{#snippet letterGlyph(kind: PosKind)}
  <image class="glyph" href={GLYPH[kind].src} x="50" y="800" width={GLYPH[kind].w} height={GLYPH[kind].h} aria-hidden="true" />
{/snippet}

{#snippet squareInner(s: PosStep)}
  {@const b = baseHands(s.kind)}
  <div class="card-grid">
    <LessonGridDisplay type="diamond" showLabels={false} size="medium" />
  </div>
  <svg class="card-hands" viewBox="0 0 950 950" aria-hidden="true">
    {@render letterGlyph(s.kind)}
    {#if redHand}{@render hand(redHand, b.red, true)}{/if}
    {#if blueHand}{@render hand(blueHand, b.blue, false)}{/if}
  </svg>
{/snippet}

<div class="positions-experience">
  <div class="stage">
    {#if isCompare}
      <div class="pane">
        <div class="compare">
          {#each steps as s, idx (s.name)}
            <figure
              class="card"
              class:selected={focus === idx}
              style="z-index:{idx};"
              bind:this={figureEls[idx]}
              transition:peelTransition|global={{ slots: steps.length - 1 - idx }}
            >
              <button
                type="button"
                class="card-square"
                bind:this={squareEls[idx]}
                onclick={() => openFocus(idx)}
                aria-pressed={focus === idx}
                aria-label={`Explore ${s.name}`}
              >
                {@render squareInner(s)}
              </button>
              <figcaption>
                <span class="eyebrow">{s.vtg}</span>
                <b>{s.name}</b>
              </figcaption>
            </figure>
          {/each}
        </div>
        <div class="label"><p>These are the three basic positions. Tap one to play with it.</p></div>

        {#if focus !== null && focusStep && focusHands}
          <div class="focus" class:focus--sheet={isMobile} class:intro-mode={phase === "intro"} transition:slide={{ duration: 320 }}>
            {#if isMobile}
              <button type="button" class="sheet-close" onclick={() => (focus = null)} aria-label="Close">✕</button>
            {/if}
            <div class="focus-head">
              <span class="eyebrow">{focusStep.vtg}</span>
              <h2>{focusStep.name}</h2>
            </div>

            <div class="focus-pic">
              <div class="grid-layer">
                <LessonGridDisplay type={focusHands.diamond ? "diamond" : "box"} showLabels={false} size="large" />
              </div>
              <svg class="hand-layer" viewBox="0 0 950 950" aria-hidden="true">
                {@render letterGlyph(focusStep.kind)}
                {#if redHand}{@render hand(redHand, focusHands.red, true)}{/if}
                {#if blueHand}{@render hand(blueHand, focusHands.blue, false)}{/if}
              </svg>
            </div>

            {#if phase === "intro"}
              <div class="intro">
                <p class="intro-lead">Three ways to change a pictograph — and it stays {focusStep.name}:</p>
                <ul class="intro-list">
                  <li><span class="ic">⟳</span><span><b>Rotate</b> — turn it around the grid.</span></li>
                  <li><span class="ic">⇄</span><span><b>Mirror</b> — flip it left to right.</span></li>
                  <li><span class="ic">◐</span><span><b>Swap colors</b> — swap which hand is which.</span></li>
                </ul>
                <button type="button" class="navbtn primary intro-go" onclick={() => (phase = "play")}>Try it →</button>
              </div>
            {:else}
              <p class="focus-caption">
                {lastAction || `Rotate, mirror, or swap colors — it stays ${focusStep.name}.`}
              </p>

              <div class="focus-controls">
                <button type="button" class="tbtn" onclick={doRotate}>⟳ Rotate</button>
                <button type="button" class="tbtn" onclick={doMirror}>⇄ Mirror</button>
                <button type="button" class="tbtn" onclick={doSwap}>◐ Swap</button>
              </div>

              <div class="tray">
                <div class="tray-grid" style="grid-template-columns: repeat({focusTotal > 8 ? 8 : 4}, auto);">
                  {#each Array(focusTotal) as _, c}
                    <span class="cell" class:lit={visited.has(c)}></span>
                  {/each}
                </div>
                <span class="tray-count">Discovered {visited.size} of {focusTotal}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      {@const hb = baseHands(step.kind)}
      <div class="pane pane-front">
        <div class="hero" bind:this={heroEl}>
          <div class="grid-layer">
            <LessonGridDisplay type="diamond" showLabels={false} size="large" />
          </div>
          <svg class="hand-layer" viewBox="0 0 950 950" aria-hidden="true">
            {@render letterGlyph(step.kind)}
            {#if redHand}{@render hand(redHand, hb.red, true)}{/if}
            {#if blueHand}{@render hand(blueHand, hb.blue, false)}{/if}
          </svg>
        </div>

        {#key i}
          <div class="label">
            <span class="eyebrow">{step.vtg}</span>
            <h1>{step.name}</h1>
            <p>{step.caption}</p>
          </div>
        {/key}
      </div>
    {/if}
  </div>

  <footer class="nav">
    <button class="navbtn" disabled={i === 0} onclick={() => go(i - 1)}>‹ Back</button>
    <div class="ticks">
      {#each Array(TOTAL) as _, idx}
        <button class="tick" class:on={idx === i} onclick={() => go(idx)} aria-label={`Stage ${idx + 1}`}></button>
      {/each}
    </div>
    {#if i === TOTAL - 1}
      <button class="navbtn primary" onclick={() => onComplete?.()}>Finish ✓</button>
    {:else}
      <button class="navbtn primary" onclick={() => go(i + 1)}>Next ›</button>
    {/if}
  </footer>
</div>

<style>
  .positions-experience {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #0c0c12;
    color: #f0f0f5;
  }

  .stage {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: grid;
    place-items: center;
    padding: 3rem 1.5rem 2rem;
  }
  /* both swap panes share one grid cell so they overlap (not stack) mid-transition */
  .pane {
    grid-area: 1 / 1;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    width: 100%;
  }
  .pane-front { z-index: 2; }

  .hero { position: relative; width: min(70vh, 560px); aspect-ratio: 1; }
  .grid-layer { position: absolute; inset: 0; }
  .grid-layer :global(.lesson-grid-display) { width: 100%; }
  .grid-layer :global(.grid-svg) { max-width: 100% !important; }

  .hand-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .hand { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }

  /* letter glyph: black source recolored to off-white for the dark bg */
  .glyph { filter: invert(0.85); }

  /* compare-row stage */
  .compare {
    --gap: clamp(1rem, 4vw, 2.5rem);
    display: flex;
    gap: var(--gap);
    align-items: flex-start;
    justify-content: center;
  }
  .card { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
  .card-square {
    position: relative;
    width: min(26vh, 220px);
    aspect-ratio: 1;
    border: 1px solid transparent;
    border-radius: 16px;
    background: transparent;
    padding: 0;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }
  .card-square:hover { border-color: rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.03); }
  .card-square:focus-visible { outline: 2px solid #4ea7e8; outline-offset: 2px; }
  .card.selected .card-square { border-color: #4ea7e8; background: rgba(78, 167, 232, 0.08); }
  .card-grid { position: absolute; inset: 0; }
  .card-grid :global(.lesson-grid-display) { width: 100%; }
  .card-grid :global(.grid-svg) { max-width: 100% !important; }
  .card-hands { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .card figcaption { text-align: center; }
  .card figcaption b { display: block; font-size: 1.4rem; font-style: italic; font-weight: 600; }

  /* transform playground */
  .focus {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 520px;
    padding: 1.5rem 1rem 0;
  }
  /* mobile: playground takes over the screen as a sheet so it isn't buried */
  .focus--sheet {
    position: fixed;
    inset: 0;
    z-index: 50;
    height: 100svh; /* small viewport height — accounts for the mobile browser toolbars */
    max-width: none;
    background: #0c0c12;
    overflow: hidden; /* everything is sized to fit — no scroll */
    justify-content: center; /* balance the content in the available height */
    gap: 0.75rem;
    padding: 2.75rem 1rem 4.5rem; /* bottom clears the global app nav */
  }
  .sheet-close {
    position: fixed;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 51;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(20, 20, 28, 0.92);
    color: #e6e6f0;
    font-size: 1.05rem;
    cursor: pointer;
  }
  .focus-head { text-align: center; }
  .focus-head h2 { font-size: 2.2rem; font-style: italic; margin: 0; }
  .focus-pic { position: relative; width: min(52vh, 380px); aspect-ratio: 1; }
  .focus-caption {
    font-size: 1rem;
    color: #c4c4d4;
    margin: 0;
    min-height: 1.4em;
    text-align: center;
  }
  .focus-controls { display: flex; gap: 0.6rem; flex-wrap: nowrap; justify-content: center; width: 100%; max-width: 420px; }
  .tbtn {
    flex: 1 1 0;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.04);
    color: #e6e6f0;
    font-size: 0.95rem;
    white-space: nowrap;
    cursor: pointer;
    min-height: 44px;
  }

  /* intro beat: explain the three transforms before handing over the buttons */
  .intro { display: flex; flex-direction: column; gap: 0.9rem; align-items: center; width: 100%; max-width: 420px; }
  .intro-lead { font-size: 1rem; color: #c4c4d4; margin: 0; text-align: center; }
  .intro-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.65rem; width: 100%; }
  .intro-list li { display: flex; gap: 0.65rem; align-items: flex-start; font-size: 0.95rem; color: #d8d8e4; line-height: 1.4; }
  .intro-list .ic { color: #4ea7e8; font-size: 1.25rem; width: 1.4em; text-align: center; flex: none; line-height: 1.2; }
  .intro-list b { color: #fff; }
  .intro-go { margin-top: 0.25rem; }
  .tbtn:hover { background: rgba(255, 255, 255, 0.1); }
  .tbtn:active { transform: scale(0.96); }
  .tbtn:focus-visible { outline: 2px solid #4ea7e8; outline-offset: 2px; }

  .tray { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
  .tray-grid { display: grid; gap: 0.4rem; justify-content: center; }
  .cell {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: transparent;
    transition: background 0.3s ease, border-color 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .cell.lit { background: #4ea7e8; border-color: #4ea7e8; transform: scale(1.12); }
  .tray-count { font-size: 0.8rem; letter-spacing: 0.04em; color: #8a8aa0; }

  .label { text-align: center; max-width: 600px; }
  .eyebrow {
    display: block;
    font-size: 0.8rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6f6f88;
    margin-bottom: 0.35rem;
  }
  .label h1 {
    font-size: 3rem;
    font-style: italic;
    margin: 0 0 0.4rem;
    animation: pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .label p { font-size: 1.1rem; color: #c4c4d4; margin: 0; line-height: 1.5; }

  @keyframes pop {
    0% { opacity: 0; transform: scale(0.7) translateY(8px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  .nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.75rem;
    padding: 1rem;
    background: rgba(12, 12, 18, 0.92);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
  }
  .navbtn {
    padding: 0.6rem 1.5rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: transparent;
    color: #d0d0e0;
    font-size: 0.95rem;
    cursor: pointer;
    min-height: 44px;
  }
  .navbtn.primary { background: #4ea7e8; border-color: #4ea7e8; color: #06121d; font-weight: 600; }
  .navbtn:disabled { opacity: 0.35; cursor: default; }
  .ticks { display: flex; gap: 0.5rem; }
  .tick {
    width: 12px; height: 12px; border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: transparent; cursor: pointer; padding: 0;
  }
  .tick.on { background: #4ea7e8; border-color: #4ea7e8; }

  @media (prefers-reduced-motion: reduce) {
    .hand { transition: none; }
    .card { transition: none; }
    .label h1 { animation: none; }
  }

  /* mobile (portrait): everything sized to FIT the viewport height — never scroll */
  @media (max-width: 640px) {
    .stage { padding: 1.25rem 1rem; }
    /* hero sized by HEIGHT (svh) so name + caption + footer always fit */
    .hero { width: auto; height: min(86vw, 42svh); }
    .label h1 { font-size: 2rem; margin-bottom: 0.25rem; }
    .label p { font-size: 1rem; }
    /* keep all three side by side, shrunk to fit width */
    .compare { gap: 0.5rem; align-items: flex-start; }
    .card-square { width: min(29vw, 130px); }
    .card figcaption b { font-size: 1rem; }
    .card figcaption .eyebrow { font-size: 0.58rem; letter-spacing: 0.08em; margin-bottom: 0.1rem; }
    .focus-head h2 { font-size: 1.7rem; }
    .tbtn { padding: 0.55rem 0.35rem; font-size: 0.85rem; gap: 0.3rem; }
    .nav { gap: 1rem; }
    .navbtn { padding: 0.6rem 1.1rem; }

    /* sheet pictographs sized by HEIGHT so the whole sheet fits with no scroll */
    .focus--sheet .focus-pic { width: auto; height: min(86vw, 38svh); }
    .focus--sheet.intro-mode .focus-pic { width: auto; height: min(60vw, 26svh); }
    .focus--sheet.intro-mode .intro { gap: 0.55rem; }
    .focus--sheet .intro-lead { font-size: 0.9rem; }
    .focus--sheet .intro-list li { font-size: 0.88rem; }
    .focus--sheet .focus-caption { font-size: 0.9rem; }
  }
</style>
