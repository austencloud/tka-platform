<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { onMount } from "svelte";
  import {
    Color,
    WebGLRenderer,
    MeshStandardMaterial,
  } from "three";
  import { Tree } from "@dgreenheck/ez-tree";
  import { CORAL_PRESETS, type CoralPreset } from "./coral-presets";

  let specimens = $state<{ tree: Tree; preset: CoralPreset; x: number; z: number }[]>([]);
  let selectedIdx = $state<number | null>(null);
  let currentSeed = $state(0);

  function generateAll(seedOffset = 0) {
    const results: typeof specimens = [];
    const cols = 3;
    const spacing = 12;

    for (let i = 0; i < CORAL_PRESETS.length; i++) {
      const preset = CORAL_PRESETS[i]!;
      const tree = new Tree();
      const params = structuredClone(preset.params);
      (params as any).seed = ((params as any).seed ?? 0) + seedOffset;
      tree.loadFromJson(params as any);
      tree.generate();

      const mat = tree.branchesMesh.material as MeshStandardMaterial;
      if (mat?.color) {
        mat.color.set(preset.color);
        mat.roughness = 0.85;
        mat.metalness = 0.05;
      }

      const col = i % cols;
      const row = Math.floor(i / cols);
      results.push({
        tree,
        preset,
        x: (col - (cols - 1) / 2) * spacing,
        z: (row - 0.5) * spacing,
      });
    }
    specimens = results;
  }

  function regenerate() {
    currentSeed += 1000;
    generateAll(currentSeed);
  }

  onMount(() => {
    generateAll(0);
  });
</script>

<div class="coral-lab">
  <div class="controls">
    <h2>Coral Lab — EZ-Tree Prototypes</h2>
    <p class="subtitle">6 coral species generated from tree parameters. Orbit to inspect.</p>
    <button class="regen-btn" onclick={regenerate}>
      Randomize Seeds
    </button>
    <div class="legend">
      {#each CORAL_PRESETS as preset, i}
        <button
          class="legend-item"
          class:selected={selectedIdx === i}
          onclick={() => selectedIdx = selectedIdx === i ? null : i}
        >
          <span
            class="swatch"
            style="background: #{preset.color.toString(16).padStart(6, '0')}"
          ></span>
          <span class="name">{preset.name}</span>
          <span class="desc">{preset.description}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="viewport">
    <Canvas
      createRenderer={(canvas) => new WebGLRenderer({ canvas, antialias: true })}
    >
      <T.PerspectiveCamera makeDefault position={[0, 10, 25]} fov={50}>
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          target={[0, 3, 0]}
        />
      </T.PerspectiveCamera>

      <T.AmbientLight intensity={0.4} color={new Color(0x88bbdd)} />
      <T.DirectionalLight
        intensity={1.2}
        position={[10, 15, 8]}
        color={new Color(0xffeedd)}
      />
      <T.DirectionalLight
        intensity={0.3}
        position={[-5, 8, -5]}
        color={new Color(0x6699cc)}
      />

      <T.Fog args={[0x1a3a5c, 30, 60]} attach="fog" />

      <!-- Ground plane -->
      <T.Mesh rotation.x={-Math.PI / 2} position.y={0} receiveShadow>
        <T.PlaneGeometry args={[60, 40]} />
        <T.MeshStandardMaterial color={new Color(0x2a4a3a)} roughness={0.95} />
      </T.Mesh>

      <!-- Coral specimens -->
      {#each specimens as { tree, preset, x, z }, i}
        <T.Group position.x={x} position.z={z}>
          <T is={tree} />
          <!-- Label post -->
          <T.Mesh position.y={-0.3}>
            <T.CylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
            <T.MeshStandardMaterial color={new Color(0x666666)} />
          </T.Mesh>
        </T.Group>
      {/each}
    </Canvas>
  </div>
</div>

<style>
  .coral-lab {
    display: flex;
    height: 100%;
    background: #0d1b2a;
    color: #ccc;
    font-family: var(--font-sans, system-ui);
  }

  .controls {
    width: 280px;
    padding: 16px;
    overflow-y: auto;
    border-right: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
    color: #eee;
    margin: 0;
  }

  .subtitle {
    font-size: 12px;
    color: #888;
    margin: 0;
  }

  .regen-btn {
    padding: 8px 12px;
    background: rgba(100, 180, 255, 0.15);
    border: 1px solid rgba(100, 180, 255, 0.3);
    border-radius: 6px;
    color: #8cc;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s;
  }
  .regen-btn:hover {
    background: rgba(100, 180, 255, 0.25);
  }

  .legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .legend-item:hover {
    background: rgba(255,255,255,0.07);
  }
  .legend-item.selected {
    background: rgba(100, 180, 255, 0.12);
    border-color: rgba(100, 180, 255, 0.3);
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .name {
    font-size: 13px;
    font-weight: 500;
    color: #ddd;
    flex-shrink: 0;
  }

  .desc {
    font-size: 11px;
    color: #777;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .viewport {
    flex: 1;
    position: relative;
  }
</style>
