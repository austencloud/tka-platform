<!--
  Tunnel Tuner Clarity — interactive prototype.

  The proposed "dead simple" tuner, wired to a live TunnelConfig, with the REAL
  kaleidoscope (LookCell) beside it. Toggle Mirror → watch the Performer Ring
  twins spring in and the count double. Toggle Invert/Echo/Speed → the count
  holds (motion is free). Judge surface for the 2026-07-07 tuner-clarity design;
  real components in a test page, per visualization-routing.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import LookCell from "../tunnel-looks/LookCell.svelte";
  import PerformerRing from "$lib/shared/sequence-viewer/tunnel/PerformerRing.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import {
    DEFAULT_CONFIG,
    FOLD_OPTIONS,
    imageCount,
    propCount,
    type TunnelConfig,
  } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
  import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { DifficultyLevel } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let config = $state<TunnelConfig>({ ...DEFAULT_CONFIG });

  const performers = $derived(imageCount(config));
  const props = $derived(propCount(config));

  // Everything is a multiplier on ONE base performer ("you"). Only active
  // (>×1) factors show, so the count reads as a build-up: 1 → ×copies → ×mirror.
  const factors = $derived(
    [
      config.fold > 1 ? { x: config.fold, label: "copies" } : null,
      config.mirror ? { x: 2, label: "mirror" } : null,
      config.flip ? { x: 2, label: "flip" } : null,
    ].filter((f): f is { x: number; label: string } => f !== null),
  );

  // Fold shown as a ×multiplier (not a count) so it never collides with the
  // "performers" total: ×1 selected + Mirror ×2 obviously = 2 performers.
  const foldSegOptions = FOLD_OPTIONS.map((a) => ({ value: String(a), label: `×${a}` }));

  // Count-builders (Mirror/Flip each ×2) vs motion modulators (no new copies).
  const twinChips = $derived([
    { key: "mirror", label: "Mirror ×2", icon: "fas fa-arrows-left-right", active: config.mirror, toggle: () => (config.mirror = !config.mirror) },
    { key: "flip", label: "Flip ×2", icon: "fas fa-arrows-up-down", active: config.flip, toggle: () => (config.flip = !config.flip) },
  ]);
  const motionChips = $derived([
    { key: "invert", label: "Invert", icon: "fas fa-arrows-spin", active: config.invert, toggle: () => (config.invert = !config.invert) },
    { key: "echo", label: "Echo", icon: "fas fa-backward", active: config.echo, toggle: () => (config.echo = !config.echo) },
    { key: "speed", label: "Speed", icon: "fas fa-gauge-high", active: config.speed, toggle: () => (config.speed = !config.speed) },
  ]);

  // ── live render base + shared playhead (reused from the tunnel-looks rig) ──
  let base = $state<SequenceData | null>(null);
  let status = $state("generating sample sequence…");
  let errorMsg = $state<string | null>(null);
  let step = $state(1);
  const speed = 0.4;
  const propTypeStr = String(PropType.STAFF);
  const staggerMax = $derived(Math.max(0, (base?.steps?.length ?? 8) - 1));

  async function generate() {
    status = "generating sample sequence…";
    errorMsg = null;
    base = null;
    try {
      base = await generationOrchestrator.generateSequence({
        length: 8,
        gridMode: GridMode.DIAMOND,
        propType: PropType.STAFF,
        difficulty: DifficultyLevel.INTERMEDIATE,
        constraintPreset: "smooth",
      });
      status = `${base.steps.length}-step sample`;
    } catch (e) {
      errorMsg = String(e instanceof Error ? (e.stack ?? e.message) : e);
      status = "error";
    }
  }

  onMount(generate);
  onMount(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const n = base?.steps?.length ?? 0;
      if (n > 0) step = ((step - 1 + dt * speed) % n) + 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function setStagger(v: number) {
    config.staggerSteps = Math.max(0, Math.min(staggerMax, v));
  }
</script>

<div class="page">
  <header>
    <h1>Tunnel Tuner — clarity prototype</h1>
    <p class="sub">Tap <b>Mirror</b>: twins spring in, count doubles. Tap <b>Invert/Echo/Speed</b>: count holds. · {status}</p>
  </header>

  <div class="stage">
    <!-- LEFT: the proposed tuner -->
    <section class="tuner">
      <!-- Hero: the countable Performer Ring + the count sentence -->
      <div class="hero">
        <PerformerRing {config} size={120} />
        <p class="result">
          <span class="n big">{performers}</span> {performers === 1 ? "performer" : "performers"}
          <span class="mid">·</span>
          <span class="n">{props}</span> props
        </p>
        {#if factors.length}
          <p class="build">
            <span class="seed">1</span>
            {#each factors as f (f.label)}
              <span class="dim">×</span> {f.x} {f.label}
            {/each}
          </p>
        {:else}
          <p class="build">just you</p>
        {/if}
      </div>

      <!-- Performers (count-builder) -->
      <div class="zone">
        <span class="zone-lbl">Copies <span class="hint">— of you</span></span>
        <div class="seg">
          <SegmentedControl
            options={foldSegOptions}
            value={String(config.fold)}
            onchange={(v) => (config.fold = Number(v))}
            color="accent"
            size="sm"
          />
        </div>
      </div>

      <!-- Add twins — each doubles -->
      <div class="zone">
        <span class="zone-lbl">Add twins <span class="hint">— each doubles</span></span>
        <div class="chips">
          {#each twinChips as c (c.key)}
            <FilterChipBase mode="toggle" size="sm" label={c.label} icon={c.icon} active={c.active} onclick={c.toggle} />
          {/each}
        </div>
      </div>

      <!-- Motion — same count -->
      <div class="zone">
        <span class="zone-lbl">Motion <span class="hint">— same count</span></span>
        <div class="chips">
          {#each motionChips as c (c.key)}
            <FilterChipBase mode="toggle" size="sm" label={c.label} icon={c.icon} active={c.active} onclick={c.toggle} />
          {/each}
        </div>
        <div class="stagger">
          <span class="stagger-lbl">Stagger</span>
          <button type="button" disabled={config.staggerSteps <= 0} onclick={() => setStagger(config.staggerSteps - 1)} aria-label="Less stagger">−</button>
          <span class="stagger-val">{config.staggerSteps}</span>
          <button type="button" disabled={config.staggerSteps >= staggerMax} onclick={() => setStagger(config.staggerSteps + 1)} aria-label="More stagger">+</button>
        </div>
      </div>
    </section>

    <!-- RIGHT: the real kaleidoscope for the same config -->
    <section class="live">
      <span class="live-lbl">Live render</span>
      {#if base}
        <div class="live-cell">
          <LookCell {base} {config} label={`${props} props`} {step} propType={propTypeStr} spectrum={true} grid={false} />
        </div>
      {:else if !errorMsg}
        <div class="ph">{status}</div>
      {/if}
      {#if errorMsg}
        <pre class="err">{errorMsg}</pre>
      {/if}
    </section>
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    background: radial-gradient(circle at 50% 20%, #14141f 0%, #0a0a0f 72%);
    color: #e8e8f0;
    font-family: system-ui, sans-serif;
  }
  header { text-align: center; }
  h1 { margin: 0; font-size: 1.3rem; }
  .sub { margin: 6px 0 0; opacity: 0.65; font-size: 0.82rem; }
  .sub b { color: #fff; }

  .stage {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(280px, 420px);
    gap: 28px;
    align-items: start;
    width: 100%;
    max-width: 900px;
  }
  @media (max-width: 720px) {
    .stage { grid-template-columns: 1fr; }
  }

  .tuner {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    border-radius: 16px;
    background: rgba(255 255 255 / 0.04);
    border: 1px solid rgba(255 255 255 / 0.1);
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .result {
    margin: 0;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .result .n {
    font-weight: 700;
    color: #fff;
  }
  .result .n.big {
    font-size: 1.35rem;
    color: #c79bff;
  }
  .result .mid { opacity: 0.4; margin: 0 6px; }

  .build {
    margin: 0;
    font-size: 0.74rem;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .build .seed {
    color: #c79bff;
    font-weight: 700;
  }
  .build .dim { margin: 0 1px; }

  .zone { display: flex; flex-direction: column; gap: 8px; }
  .zone-lbl {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    opacity: 0.6;
  }
  .zone-lbl .hint { text-transform: none; letter-spacing: 0; opacity: 0.7; }
  .seg { max-width: 220px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }

  .stagger { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
  .stagger-lbl { font-size: 0.8rem; opacity: 0.75; }
  .stagger button {
    width: 28px; height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(255 255 255 / 0.15);
    background: rgba(255 255 255 / 0.06);
    color: inherit; cursor: pointer;
    font-size: 1rem; line-height: 1;
  }
  .stagger button:disabled { opacity: 0.3; cursor: default; }
  .stagger-val { font-variant-numeric: tabular-nums; width: 1.5ch; text-align: center; }

  .live {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .live-lbl {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    opacity: 0.6;
  }
  .live-cell { width: 100%; }
  .ph { opacity: 0.5; padding: 40px; text-align: center; font-size: 0.85rem; }
  .err {
    white-space: pre-wrap;
    background: rgba(220 60 60 / 0.12);
    border: 1px solid rgba(220 60 60 / 0.4);
    color: #ffb4b4;
    padding: 10px; border-radius: 10px; font-size: 0.7rem;
  }
</style>
