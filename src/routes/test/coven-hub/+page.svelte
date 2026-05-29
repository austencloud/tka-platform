<script lang="ts">
  /**
   * Coven Hub — layout skeleton (throwaway, brainstorming aid).
   *
   * Spatial sketch of the "acolyte station" generative hub idea:
   *   - Center: one full telekinetic coven running the seed sequence.
   *   - Ring: N satellite covens around it, one per effect slot, color-tagged
   *     by the effect registry. In the real build each satellite wears its own
   *     effect + gets proximity LOD; here every coven is full so we can judge
   *     spacing, scale and density (and feel the perf cost of going full-fat).
   *
   * Not the feature. A sketch to get layout feedback before the spec locks.
   */
  import { Canvas, T } from "@threlte/core";
  import { Color } from "three";
  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import TelekineticFormation3D from "$lib/features/museum/components/game/TelekineticFormation3D.svelte";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "$lib/features/museum/data/museum-exhibit-sequences";
  import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

  // Real exhibit sequence ids to feed the covens (only these exist baked).
  const SEQ_IDS = Object.keys(MUSEUM_EXHIBIT_SEQUENCES);
  const CENTER_SEQ = SEQ_IDS[0];

  // Ring count toggle — full covens are heavy (~12 rigs each), so default low.
  const RING_OPTIONS = [3, 6, 12] as const;
  let ringCount = $state<(typeof RING_OPTIONS)[number]>(6);
  let autoRotate = $state(true);

  // One coven footprint ≈ platform(3.5) + acolyte ring; keep ~9u between
  // adjacent ring stations so platforms never overlap.
  const SEP = 9;
  const ringRadius = $derived(Math.max(10, SEP / (2 * Math.sin(Math.PI / ringCount))));

  const ringStations = $derived(
    Array.from({ length: ringCount }, (_, i) => {
      const angle = (i / ringCount) * Math.PI * 2;
      const effect = EFFECTS[i % EFFECTS.length];
      return {
        i,
        x: Math.sin(angle) * ringRadius,
        z: Math.cos(angle) * ringRadius,
        seqId: SEQ_IDS[(i + 1) % SEQ_IDS.length],
        effectId: effect.id,
        label: effect.label,
        color: new Color(effect.color),
        css: effect.color,
      };
    }),
  );

  // Camera pulls back as the ring grows so the whole hub stays framed.
  const camDist = $derived(ringRadius * 2 + 14);
</script>

<svelte:head>
  <title>Coven Hub Skeleton | TKA</title>
</svelte:head>

<div class="page">
  <div class="hud">
    <div class="title">Coven Hub — layout skeleton</div>

    <div class="row">
      <span class="lbl">Ring covens</span>
      <div class="seg">
        {#each RING_OPTIONS as n}
          <button
            type="button"
            class="seg-btn"
            class:active={ringCount === n}
            aria-pressed={ringCount === n}
            onclick={() => (ringCount = n)}
          >
            {n}{n === 12 ? " ⚠" : ""}
          </button>
        {/each}
      </div>
    </div>

    <div class="row">
      <span class="lbl">Auto-orbit</span>
      <button
        type="button"
        class="seg-btn solo"
        class:active={autoRotate}
        aria-pressed={autoRotate}
        onclick={() => (autoRotate = !autoRotate)}
      >
        {autoRotate ? "On" : "Off"}
      </button>
    </div>

    <div class="legend">
      {#each ringStations as s (s.i)}
        <span class="chip">
          <span class="dot" style:background={s.css}></span>
          {s.i + 1}. {s.label}
        </span>
      {/each}
    </div>

    <p class="note">
      Center = seed coven. Ring = one coven per effect slot (color-tagged).
      Every coven is full here (no LOD) — 12 covens = ~144 rigs, expect lag.
      Real build: satellites wear their own effect + proximity LOD.
    </p>
  </div>

  <div class="canvas-wrap">
    <Canvas>
      <T.PerspectiveCamera makeDefault position={[0, camDist * 0.7, camDist]} fov={50} />
      <OrbitControls enableDamping {autoRotate} autoRotateSpeed={0.4} target={[0, 1, 0]} />

      <T.AmbientLight intensity={0.45} />
      <T.DirectionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <T.DirectionalLight position={[-10, 8, -10]} intensity={0.3} />

      <!-- Ground -->
      <T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
        <T.CircleGeometry args={[ringRadius + 8, 64]} />
        <T.MeshStandardMaterial color="#15151f" roughness={1} />
      </T.Mesh>

      <!-- Center seed coven -->
      <TelekineticFormation3D stationId="hub-center" worldX={0} worldZ={0} sequenceId={CENTER_SEQ} />

      <!-- Ring of effect covens -->
      {#each ringStations as s (s.i)}
        <!-- Effect color marker disc under each satellite -->
        <T.Mesh position={[s.x, 0.02, s.z]} rotation.x={-Math.PI / 2}>
          <T.RingGeometry args={[3.7, 4.2, 48]} />
          <T.MeshBasicMaterial color={s.color} transparent opacity={0.85} />
        </T.Mesh>
        <TelekineticFormation3D
          stationId={`hub-ring-${s.i}`}
          worldX={s.x}
          worldZ={s.z}
          sequenceId={s.seqId}
        />
      {/each}
    </Canvas>
  </div>
</div>

<style>
  .page {
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #0a0a12;
  }
  .canvas-wrap {
    position: absolute;
    inset: 0;
  }
  .hud {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    width: 18rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: rgba(12, 12, 20, 0.82);
    backdrop-filter: blur(8px);
    color: #e8e8f0;
    font-size: 0.85rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  .title {
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.6rem;
    gap: 0.75rem;
  }
  .lbl {
    opacity: 0.75;
  }
  .seg {
    display: flex;
    gap: 0.25rem;
  }
  .seg-btn {
    min-width: 2.75rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    color: #e8e8f0;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .seg-btn.solo {
    min-width: 3.5rem;
  }
  .seg-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .seg-btn.active {
    background: #3a7fd9;
    border-color: #3a7fd9;
    color: #fff;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.6rem;
    margin: 0.5rem 0;
    max-height: 9rem;
    overflow-y: auto;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    opacity: 0.9;
  }
  .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    display: inline-block;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.72rem;
    line-height: 1.4;
    opacity: 0.6;
  }
</style>
