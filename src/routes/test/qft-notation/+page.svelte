<script lang="ts">
  /**
   * QfT notation — a generative instrument for Charlie Cushing's poi notation.
   *
   * Turn the knobs, watch the shape, read the notation. The convention toggle
   * switches between Charlie's rule and Drex's, which is the one place the two
   * authors disagree in print and have since 2011.
   *
   * Design: docs/superpowers/specs/2026-07-26-qft-notation-toy-design.md
   * Sources: docs/reference/archive/qft-notation/README.md
   */
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    buildIncrements,
    buildPendulum,
    type Convention,
    type QftKnobs,
    type Spin
  } from "$lib/shared/notation/qft/qft-model";
  import { nameFor } from "$lib/shared/notation/qft/qft-naming";
  import QftStage from "./_components/QftStage.svelte";
  import QftTable from "./_components/QftTable.svelte";

  type Mode = "rotational" | "pendulum";

  let radius = $state(1);
  let downbeats = $state(3);
  let spin = $state<Spin>("antispin");
  let phase = $state(0);
  let convention = $state<Convention>("charlie");
  let mode = $state<Mode>("rotational");

  let cursor = $state(0);
  let playing = $state(false);

  const knobs = $derived<QftKnobs>({ radius, downbeats, spin, phase });

  const increments = $derived(
    mode === "pendulum" ? buildPendulum() : buildIncrements(knobs, convention)
  );

  const moveName = $derived(
    mode === "pendulum"
      ? { label: "Pendulum", provenance: "sourced" as const }
      : nameFor(knobs)
  );

  const step = $derived(Math.floor(cursor) % 8);

  interface Preset {
    label: string;
    mode: Mode;
    radius: number;
    downbeats: number;
    spin: Spin;
    phase: number;
  }

  const PRESETS: Preset[] = [
    { label: "Static spin", mode: "rotational", radius: 0, downbeats: 1, spin: "inspin", phase: 0 },
    { label: "Pendulum", mode: "pendulum", radius: 0, downbeats: 1, spin: "inspin", phase: 0 },
    { label: "Extension", mode: "rotational", radius: 1, downbeats: 1, spin: "inspin", phase: 0 },
    { label: "Isolation", mode: "rotational", radius: 0.5, downbeats: 1, spin: "inspin", phase: 4 },
    { label: "Cateye", mode: "rotational", radius: 0.5, downbeats: 1, spin: "antispin", phase: 0 },
    { label: "Triquetra", mode: "rotational", radius: 1, downbeats: 2, spin: "antispin", phase: 0 },
    { label: "4-petal antispin", mode: "rotational", radius: 1, downbeats: 3, spin: "antispin", phase: 0 },
    { label: "4-petal inspin", mode: "rotational", radius: 1, downbeats: 5, spin: "inspin", phase: 0 }
  ];

  /**
   * Match on the knob values, not on the label. The generated name for a preset
   * is not always the preset's own label ("4-petal antispin" vs the generated
   * "4-petal antispin flower"), so comparing strings silently never matches.
   */
  const isActive = (p: Preset) =>
    p.mode === mode &&
    (p.mode === "pendulum" ||
      (Math.abs(p.radius - radius) < 0.02 &&
        p.downbeats === downbeats &&
        p.spin === spin &&
        p.phase === phase));

  const applyPreset = (p: Preset) => {
    mode = p.mode;
    radius = p.radius;
    downbeats = p.downbeats;
    spin = p.spin;
    phase = p.phase;
    cursor = 0;
  };

  /**
   * SegmentedControl's option values are strings, so the downbeat count travels
   * as a string and is parsed on the way back in rather than fighting the
   * primitive's generic.
   */
  const DOWNBEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    value: String(n),
    label: String(n),
    ariaLabel: `${n} prop rotation${n === 1 ? "" : "s"} per hand rotation`
  }));

  const SPIN_OPTIONS: Array<{ value: Spin; label: string }> = [
    { value: "inspin", label: "Inspin" },
    { value: "antispin", label: "Antispin" }
  ];

  const CONVENTION_OPTIONS: Array<{ value: Convention; label: string }> = [
    { value: "charlie", label: "Charlie" },
    { value: "drex", label: "Drex" }
  ];

  const CONVENTION_NOTE: Record<Convention, string> = {
    charlie:
      "Direction runs parallel to the instantaneous slope of the traced path. Where that slope misses the eight-point compass, the cell reads n — out of resolution.",
    drex: "Direction always sits at a right angle to the tether, so every cell resolves and nothing is ever out of resolution."
  };

  const step8 = (delta: number) => {
    playing = false;
    cursor = (Math.floor(cursor) + delta + 8) % 8;
  };

  $effect(() => {
    if (!playing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      playing = false;
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      cursor = (cursor + (now - last) / 1000) % 8;
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
</script>

<svelte:head>
  <title>QfT Notation — instrument</title>
</svelte:head>

<div class="page qft-page">
  <header>
    <h1>QfT Notation</h1>
    <p class="lede">
      Charlie Cushing's poi notation, computed rather than traced. Turn the knobs and the
      motion, the name and the notation all follow.
    </p>
  </header>

  <div class="preset-row">
    {#each PRESETS as preset (preset.label)}
      <button
        type="button"
        class="preset"
        class:on={isActive(preset)}
        onclick={() => applyPreset(preset)}
      >
        {preset.label}
      </button>
    {/each}
  </div>

  <div class="split">
    <section class="stage-pane" aria-label="Motion">
      <QftStage {knobs} {increments} {cursor} />

      <div class="transport">
        <button type="button" onclick={() => step8(-1)} aria-label="Previous increment">‹</button>
        <span class="counter">{step + 1} / 8</span>
        <button type="button" onclick={() => step8(1)} aria-label="Next increment">›</button>
        <button type="button" class="play" onclick={() => (playing = !playing)}>
          {playing ? "Pause" : "Play"}
        </button>
      </div>
    </section>

    <section class="controls" aria-label="Controls">
      <div class="named">
        <span class="name">{moveName.label}</span>
        <span class="provenance" class:derived={moveName.provenance === "derived"}>
          {moveName.provenance}
        </span>
      </div>

      <label class="knob" for="radius">
        <span class="knob-label">
          Hand path radius
          <span class="value">{radius.toFixed(2)} prop lengths</span>
        </span>
        <input
          id="radius"
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          bind:value={radius}
          oninput={() => (mode = "rotational")}
        />
      </label>

      <div class="knob">
        <span class="knob-label" id="downbeats-label">Prop rotations per hand rotation</span>
        <div class="fit"><SegmentedControl
          options={DOWNBEAT_OPTIONS}
          value={String(downbeats)}
          onchange={(v) => {
            downbeats = Number(v);
            mode = "rotational";
          }}
          size="sm"
          ariaLabelledby="downbeats-label"
        /></div>
      </div>

      <div class="knob">
        <span class="knob-label" id="spin-label">Direction</span>
        <div class="fit"><SegmentedControl
          options={SPIN_OPTIONS}
          value={spin}
          onchange={(v) => {
            spin = v;
            mode = "rotational";
          }}
          size="sm"
          ariaLabelledby="spin-label"
        /></div>
      </div>

      <div class="knob convention">
        <span class="knob-label" id="convention-label">Direction convention</span>
        <div class="fit"><SegmentedControl
          options={CONVENTION_OPTIONS}
          value={convention}
          onchange={(v) => (convention = v)}
          size="sm"
          ariaLabelledby="convention-label"
        /></div>
        <p class="note">{CONVENTION_NOTE[convention]}</p>
      </div>

      <QftTable {increments} activeStep={step} />

      <p class="legend">
        <strong>sourced</strong> names are worked through in the 2011 written guide.
        <strong>derived</strong> names follow the petal rule the guide's own examples confirm
        but never states outright. QfT as published is single-plane, so this stays in-plane.
      </p>
    </section>
  </div>
</div>

<style>
  /**
   * The lockstep root ramp from app.css is scoped to html:has(.mkt-shell) and
   * html:has(.legal-container), so a test route gets no ramp at all and every
   * rem stays frozen at 1080p proportions. Same curve, same endpoints: 16px at
   * 1680 up to 24px at 3840, continuous, so every rem measure on the page grows
   * by one multiplier and nothing can outgrow its neighbours.
   */
  :global(html:has(.qft-page)) {
    font-size: clamp(16px, 9.78px + 0.3704vw, 24px);
  }

  .page {
    width: 100%;
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }

  header {
    margin-bottom: 1.5rem;
  }

  h1 {
    margin: 0 0 0.4rem;
    font-size: clamp(1.9rem, 3vw, 2.6rem);
    font-weight: 700;
  }

  .lede {
    margin: 0;
    font-size: 1.05rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.66));
  }

  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .preset {
    min-height: 2.75rem;
    padding: 0 0.95rem;
    border-radius: 999px;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.22));
    background: var(--semantic-surface-raised, rgb(255 255 255 / 0.05));
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.88));
    font-size: 0.92rem;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .preset:hover {
    background: var(--semantic-surface-hover, rgb(255 255 255 / 0.1));
  }

  .preset.on {
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 24%, transparent);
  }

  .split {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    align-items: start;
  }

  @media (min-width: 60rem) {
    .split {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  @media (min-width: 105rem) {
    .split {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 3rem;
    }
  }

  .stage-pane {
    position: sticky;
    top: 1.5rem;
  }

  .transport {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 1rem;
  }

  .transport button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0 0.9rem;
    border-radius: 0.7rem;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.22));
    background: var(--semantic-surface-raised, rgb(255 255 255 / 0.05));
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.88));
    font-size: 1.15rem;
    cursor: pointer;
  }

  .transport .play {
    font-size: 0.95rem;
    min-width: 5rem;
  }

  .counter {
    min-width: 4.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.66));
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1.35rem;
  }

  .named {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .name {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .provenance {
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: color-mix(in srgb, var(--semantic-success, #34d399) 26%, transparent);
    color: var(--semantic-text-primary, #fff);
  }

  .provenance.derived {
    background: color-mix(in srgb, var(--semantic-warning, #fbbf24) 30%, transparent);
  }

  .knob {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  /**
   * SegmentedControl sets width: 100% internally, so dropping it straight into
   * a stretch-aligned flex column makes two short labels span the whole panel.
   * An inline-flex wrapper that starts at the leading edge shrink-wraps to the
   * options instead.
   */
  .fit {
    display: inline-flex;
    align-self: flex-start;
    max-width: 100%;
  }

  .knob-label {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.7));
  }

  .value {
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }

  input[type="range"] {
    width: 100%;
    height: 2.75rem;
    accent-color: var(--theme-accent, #8b5cf6);
    cursor: pointer;
  }

  .convention .note {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.45;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.62));
  }

  .legend {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.58));
  }

  .legend strong {
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
  }

  @media (prefers-reduced-motion: reduce) {
    .preset {
      transition: none;
    }
  }
</style>
