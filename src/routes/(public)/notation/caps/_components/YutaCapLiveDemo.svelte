<!--
  Live Yuta CAP hero for /notation/caps: one club floating in space, drawing
  the pattern's trace as it plays, looping forever. Same recipe as the
  shape-matrix drill hero (InlineAnimationPlayer + transparent canvas + trail
  preset + tip-effect map + engine-aligned MandalaHeroLayer ghost underneath),
  so it reads as "a prop doing the pattern" with no letter/step chrome and no
  background box.

  This surface is LOCKED for visitors: effort/BPM/prop hardcoded, grid hidden,
  context menu suppressed — a public exhibit, not an editable canvas.

  Tuning rig: append ?tune to the URL and a knob panel appears under the stage
  (BPM, effort, trail shape, ghost opacity, grid). Values feed the player live;
  "Copy values" puts the current JSON on the clipboard so the winning numbers
  can be hardcoded back into DEFAULTS below.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import MandalaHeroLayer from "$lib/shared/shape-matrix/components/MandalaHeroLayer.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { buildYutaCapSequence } from "./yuta-cap-sequence";
  import { setPerHand } from "$lib/shared/animation-engine/services/tip-effect-resolver";
  import { setTipPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
  import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
  import type { EffortId } from "$lib/shared/effort/domain/effort-types";
  import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import {
    TrailMode,
    TrailEffect,
    DEFAULT_TRAIL_SETTINGS,
    type TrailSettings,
  } from "$lib/shared/animation-engine/domain/types/trail-types";

  const sequence = buildYutaCapSequence();

  // Austen's directive is no play/pause control on this exhibit, so the
  // accessibility accommodation is a static poster, not a pause button: under
  // reduced motion the live player is not mounted and the static ghost mandala
  // (which draws client-side either way) stands in as the still.
  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");

  // Poster = SSR / no-JS / pre-hydration first paint only. $effect runs client
  // side after mount, so on the server the poster renders (no blank square for
  // SEO / no-JS); once hydrated the client-drawn ghost and player own the frame
  // and the poster is removed so it never doubles the ghost curve.
  let mounted = $state(false);
  $effect(() => {
    mounted = true;
  });

  // The static mandala under the live trail — same alignment contract as the
  // shape-matrix drill: both layers fill the SAME square, and the geometry is
  // computed with the club's outer tip so the ghost sits exactly under the path
  // the prop traces. (Blue is invisible in this sequence, so only the red hand's
  // locus comes back.)
  //
  // Tip reach = the VISIBLE club tip, not the trail EMITTER. The emitter point
  // in prop-tip-points is dx=130, but the club's weighted bulb reaches farther
  // (measured ~150, i.e. one grid radius), and the eye follows that bulb tip.
  // Feeding the emitter's 130 drew the ghost ring ~7% inset — sitting inside the
  // very path the prop visibly traces (Austen, 2026-07-20: "make the mandala
  // match what the prop is currently doing"). 150 lands the ghost on the club
  // tip. Verified by pixel-measuring club reach vs ghost radius at 0.316·size.
  const clubTipDx = 150;
  const mandalaPaths = calculateMandalaGeometry(
    sequence.steps,
    undefined,
    undefined,
    { tipEnds: 1, pathShape: "arc" },
    { dx: clubTipDx, dy: 0 },
  );

  // Trails on the red (solo) hand only — index 1 = red.
  const tipEffectMap = setPerHand({}, 1, "trails");

  // Emit the trail from the club's VISIBLE tip (dx 150), matching the ghost and
  // the club-graphic end. The default trail emitter is dx 130, which sits inside
  // the bulb, so the trace rendered ~inset from the club end (Austen, 2026-07-20:
  // "the trail is rendering inset from the tip of the club end"). The player
  // reads the club tip from the global tip-point override provider; scope the
  // override to this exhibit's lifetime (the caps page mounts no other club
  // render / effects-lab, so there is nothing else to clobber).
  $effect(() => {
    setTipPointOverrideProvider((propType) =>
      propType === "club" ? { points: [{ dx: 150, dy: 0 }] } : null,
    );
    return () => setTipPointOverrideProvider(null);
  });

  // Per-instance ephemeral visibility manager. Without it the player's
  // orchestrator reads effort/path-shape from the GLOBAL singleton (a
  // visitor's — or Austen's — in-app glide leaks into this embed) and
  // setSpeed WRITES the embed's BPM back into that singleton. Ephemeral =
  // defaults, no localStorage, no DOM sync; fully isolated both directions.
  const visibilityManager = new AnimationVisibilityStateManager({ ephemeral: true });

  // The shipped look. The tuner edits live copies of these; once a set wins,
  // paste the copied JSON back over this object.
  // Tuned by Austen via the ?tune rig, 2026-07-19.
  const DEFAULTS = {
    bpm: 80,
    effort: "linear" as EffortId,
    ghostOpacity: 1,
    gridVisible: false,
    fadeDurationMs: 400,
    glowBlur: 6,
    tailLength: 36,
    lineWidth: 2,
    minOpacity: 0.55,
  };

  let bpm = $state(DEFAULTS.bpm);
  let effort = $state<EffortId>(DEFAULTS.effort);
  let ghostOpacity = $state(DEFAULTS.ghostOpacity);
  let gridVisible = $state(DEFAULTS.gridVisible);
  let fadeDurationMs = $state(DEFAULTS.fadeDurationMs);
  let glowBlur = $state(DEFAULTS.glowBlur);
  let tailLength = $state(DEFAULTS.tailLength);
  let lineWidth = $state(DEFAULTS.lineWidth);
  let minOpacity = $state(DEFAULTS.minOpacity);

  // Keep the scoped manager's effort in lockstep with the (tunable) knob —
  // this is what the orchestrator actually eases motion with.
  $effect(() => {
    visibilityManager.setEffortPreset(effort);
  });

  // Hero-visibility numbers from the landing hero preset, with LOOP_CLEAR so
  // the club redraws the full closed curve fresh on every cycle — the trace IS
  // the mandala, drawn live over its ghost.
  const trailSettings = $derived<TrailSettings>({
    ...DEFAULT_TRAIL_SETTINGS,
    mode: TrailMode.LOOP_CLEAR,
    effect: TrailEffect.GLOW,
    fadeDurationMs,
    glowBlur,
    tailLength,
    lineWidth,
    minOpacity,
  });

  // LazyMount spreads this reactively, so knob changes hit the player live.
  const playerProps = $derived({
    sequence,
    autoPlay: true,
    externalBpm: bpm,
    tipEffortMap: { "*": { effort } },
    chrome: "minimal" as const,
    fill: true,
    beatIndicators: false,
    leftPropType: "club",
    rightPropType: "club",
    hideTkaGlyph: true,
    hideStepNumbers: true,
    gridVisible,
    disableContextMenu: true,
    interactive: false,
    visibilityManagerOverride: visibilityManager,
    trailSettingsOverride: trailSettings,
    tipEffectMap,
    backgroundAlpha: 0,
  });

  // ?tune reveals the rig after hydration. Reading a request query while this
  // public page is prerendering would prevent the page from being emitted.
  let tunable = $state(false);
  onMount(() => {
    tunable = new URLSearchParams(window.location.search).has("tune");
  });

  const EFFORT_OPTIONS = (
    ["linear", "glide", "dab", "press", "punch", "elastic", "bounce", "anticipation"] as EffortId[]
  ).map((value) => ({ value, label: value }));

  interface Knob {
    label: string;
    min: number;
    max: number;
    step: number;
    get: () => number;
    set: (v: number) => void;
    fmt?: (v: number) => string;
  }
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const KNOBS: Knob[] = [
    { label: "BPM", min: 30, max: 180, step: 5, get: () => bpm, set: (v) => (bpm = v) },
    { label: "Ghost opacity", min: 0, max: 1, step: 0.05, get: () => ghostOpacity, set: (v) => (ghostOpacity = v), fmt: pct },
    { label: "Trail fade (ms)", min: 400, max: 8000, step: 100, get: () => fadeDurationMs, set: (v) => (fadeDurationMs = v) },
    { label: "Glow blur", min: 0, max: 24, step: 1, get: () => glowBlur, set: (v) => (glowBlur = v) },
    { label: "Tail length", min: 4, max: 120, step: 2, get: () => tailLength, set: (v) => (tailLength = v) },
    { label: "Line width", min: 1, max: 16, step: 0.5, get: () => lineWidth, set: (v) => (lineWidth = v) },
    { label: "Min opacity", min: 0, max: 1, step: 0.05, get: () => minOpacity, set: (v) => (minOpacity = v), fmt: pct },
  ];

  let copied = $state(false);
  async function copyValues() {
    const values = {
      bpm,
      effort,
      ghostOpacity,
      gridVisible,
      fadeDurationMs,
      glowBlur,
      tailLength,
      lineWidth,
      minOpacity,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch (err) {
      console.error("copy failed", err);
    }
  }
</script>

<div class="yuta-demo">
  <div class="yuta-stage">
    {#if !mounted}
      <img
        class="yuta-poster"
        src="/caps/yuta-cap.svg"
        alt="The Yuta CAP: an extension arc joined to antispin petals, traced by one prop"
        width="500"
        height="500"
      />
    {/if}
    <MandalaHeroLayer paths={mandalaPaths} {clubTipDx} opacity={ghostOpacity} />
    {#if !reduceMotion.current}
      <div class="player-layer">
        <LazyMount
          loader={() =>
            import(
              "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
            )}
          active={true}
          props={playerProps}
        />
      </div>
    {/if}
  </div>

  {#if tunable}
    <div class="tuner" aria-label="CAP hero tuning rig">
      <div class="tuner-row effort-row">
        <span class="knob-label">Effort</span>
        <SegmentedControl
          options={EFFORT_OPTIONS}
          value={effort}
          onchange={(v) => (effort = v)}
          size="sm"
          color="accent"
        />
      </div>
      {#each KNOBS as k (k.label)}
        <div class="tuner-row">
          <span class="knob-label">{k.label}</span>
          <input
            type="range"
            min={k.min}
            max={k.max}
            step={k.step}
            value={k.get()}
            oninput={(e) => k.set(Number(e.currentTarget.value))}
          />
          <span class="knob-value">{k.fmt ? k.fmt(k.get()) : k.get()}</span>
        </div>
      {/each}
      <div class="tuner-actions">
        <button
          type="button"
          class="tuner-btn"
          aria-pressed={gridVisible}
          onclick={() => (gridVisible = !gridVisible)}
        >
          <span class="toggle-dot" data-on={gridVisible || undefined}></span>
          Grid
        </button>
        <button type="button" class="tuner-btn" onclick={copyValues}>
          <i class="fas {copied ? 'fa-check' : 'fa-copy'}" aria-hidden="true"></i>
          Copy values
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Square stage reserved up front (no-layout-shift); mandala ghost and player
     both fill THIS box, so their coordinate frames coincide — that is the
     alignment contract (see ShapeMatrixDrill's .hero-square). The player's
     canvas is transparent, so ghost and page background show through. */
  .yuta-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
  }

  .player-layer {
    position: absolute;
    inset: 0;
  }

  /* SSR / pre-hydration / no-JS floor. Removed once the client draws the ghost
     and player (see the mounted gate), so it never doubles the ghost curve. */
  .yuta-poster {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 0;
    pointer-events: none;
  }

  .tuner {
    margin-top: 0.9rem;
    padding: 0.85rem 1rem;
    display: grid;
    gap: 0.55rem;
    border-radius: 12px;
    border: 1px solid oklch(0.4 0.04 270 / 0.25);
    background: oklch(0.17 0.02 270 / 0.85);
  }

  .tuner-row {
    display: grid;
    grid-template-columns: 8.5rem 1fr 3.5rem;
    align-items: center;
    gap: 0.6rem;
  }

  .effort-row {
    grid-template-columns: 8.5rem 1fr;
  }

  .knob-label {
    font-size: 0.82rem;
    color: oklch(0.78 0.02 270);
  }

  /* Fixed-width, tabular readout so slider drags shift nothing. */
  .knob-value {
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: oklch(0.9 0.02 270);
  }

  input[type="range"] {
    width: 100%;
    accent-color: #38bdf8;
  }

  .tuner-actions {
    display: flex;
    gap: 0.6rem;
    padding-top: 0.2rem;
  }

  .tuner-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0 1rem;
    border-radius: 10px;
    border: 1px solid oklch(0.45 0.04 270 / 0.35);
    background: oklch(0.24 0.02 270);
    color: oklch(0.9 0.02 270);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .tuner-btn:hover {
    background: oklch(0.3 0.03 270);
  }

  /* Button + indicator toggle (no checkboxes). */
  .toggle-dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    border: 1px solid oklch(0.6 0.03 270);
    background: transparent;
    transition: background 150ms ease;
  }
  .toggle-dot[data-on] {
    background: #38bdf8;
    border-color: #38bdf8;
  }
</style>
