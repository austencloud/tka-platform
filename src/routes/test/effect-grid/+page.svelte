<script lang="ts">
  /**
   * The effect grid — all sixteen registry effects at once.
   *
   * Sixteen stations in a 4x4 arrangement, every one running the same sequence
   * with the same overlaid rigs. The only variable across the grid is the
   * effect, which is what makes this a comparison rather than a gallery: you can
   * see which effects read as themselves, which read as each other, and which
   * are still missing a 3D renderer.
   *
   * Cost: each station mounts `centerPlanes` rigs, and each rig is one
   * EffectOrchestrator3D. At six planes that is ninety-six orchestrators, which
   * no machine renders smoothly — hence the Overlay control, defaulting to two
   * (one plane and its mirror), which keeps the layered look affordable.
   */
  import { Canvas, T } from "@threlte/core";
  import { WebGLRenderer } from "three";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import EffectGridScene from "./EffectGridScene.svelte";
  import { EFFECT_CELLS } from "./effect-grid";

  /**
   * One shared effects config for the page, persist:false so the harness never
   * writes to Austen's real tka_effects_config.
   *
   * One is enough, and it must NOT carry the per-cell selection: each cell's
   * effect travels down the tipEffectMap prop channel (effectId → CovenStation
   * → EffectOrchestrator3D → EffectsLayer.activeEffects). This context supplies
   * only the per-effect INTENT parameters, which are shared by every cell.
   */
  setEffectsConfigContext(createEffectsConfigState(undefined, { persist: false }));

  let showProps = $state(false);
  let playing = $state(true);
  let showLabels = $state(true);
  let centerPlanes = $state(2);

  const boolOptions = [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ];
  const planeOptions = [
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 6, label: "6" },
  ];
</script>

<svelte:head><title>Effect grid — all sixteen</title></svelte:head>

<div class="harness">
  <header>
    <h1>Effect grid</h1>
    <p>
      Every effect in the registry, one per cell, all running the same sequence with
      the same overlaid rigs. The effect is the only thing that changes between cells.
      Orbit to look along the rows.
    </p>
  </header>

  <section class="stage">
    <Canvas
      createRenderer={(canvas) =>
        new WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        })}
    >
      <!-- Framed to fill the stage with the 4x4: high enough that the rows read
           as a grid rather than a receding line, close enough that no cell is
           a speck. The grid spans 3 * GRID_SPACING in both axes. -->
      <T.PerspectiveCamera makeDefault position={[0, 23, 14]} fov={50}>
        <OrbitControls enableDamping target={[0, 0.6, 1]} maxPolarAngle={Math.PI / 2} />
      </T.PerspectiveCamera>
      <EffectGridScene {showProps} {playing} {showLabels} {centerPlanes} />
    </Canvas>
  </section>

  <section class="controls">
    <label class="control">
      <span>Props</span>
      <SegmentedControl
        options={boolOptions}
        value={showProps}
        onchange={(v) => (showProps = v)}
        size="sm"
        ariaLabel="Show props"
      />
    </label>
    <label class="control">
      <span>Playing</span>
      <SegmentedControl
        options={boolOptions}
        value={playing}
        onchange={(v) => (playing = v)}
        size="sm"
        ariaLabel="Playing"
      />
    </label>
    <label class="control">
      <span>Labels</span>
      <SegmentedControl
        options={boolOptions}
        value={showLabels}
        onchange={(v) => (showLabels = v)}
        size="sm"
        ariaLabel="Show labels"
      />
    </label>
    <label class="control">
      <span>Overlay</span>
      <SegmentedControl
        options={planeOptions}
        value={centerPlanes}
        onchange={(v) => (centerPlanes = v)}
        size="sm"
        ariaLabel="Overlaid rigs per station"
      />
    </label>
  </section>

  <ol class="key" aria-label="Grid reading order">
    {#each EFFECT_CELLS as cell (cell.id)}
      <li style:--accent={cell.color}>
        <span class="swatch" aria-hidden="true"></span>{cell.label}
      </li>
    {/each}
  </ol>
</div>

<style>
  /* Local type ramp. The site-wide lockstep ramp in app.css is scoped to
     .mkt-shell / .legal-container, so a test route gets none of it and renders
     as 16px type on a 3840 monitor — the page reads as a phone layout scaled
     up. Everything below is em, so it all grows off this one declaration. */
  .harness {
    display: flex;
    flex-direction: column;
    gap: 1.25em;
    padding: 1.5em;
    min-height: 100svh;
    background: #070a12;
    color: #e8ecf6;
    font-size: clamp(1rem, 0.52rem + 0.42vw, 1.6rem);
  }

  header h1 {
    margin: 0;
    font-size: 1.6em;
    letter-spacing: -0.01em;
  }

  header p {
    margin: 0.35em 0 0;
    color: #9fb0cc;
  }

  .stage {
    position: relative;
    /* Reserved box: the canvas must not resize as the scene loads. The upper
       bound is deliberately huge — a hard rem cap here is what left two thirds
       of a 4K viewport empty under the grid. */
    height: clamp(28rem, 74svh, 120rem);
    border-radius: 0.75em;
    overflow: hidden;
    background: #04060c;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25em;
  }

  .control {
    display: flex;
    align-items: center;
    gap: 0.6em;
    font-size: 0.95em;
    color: #9fb0cc;
  }

  /* Reading order key: same order as the grid fills, left to right, top row
     first, so a cell's position maps to a name without projecting labels. */
  .key {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.45em 1.2em;
    max-width: 52em;
  }

  .key li {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.9em;
    color: #8fa0bd;
  }

  .swatch {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: var(--accent);
    flex: 0 0 auto;
  }

  @media (max-width: 900px) {
    .key {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
