<script lang="ts">
  import { T } from "@threlte/core";
  import { useGltf, useDraco } from "@threlte/extras";
  import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
  import { userProportionsState } from "@austencloud/scene-3d";
  import { terrainHeightForPlacement } from "./terrain-height";
  import { Color, Object3D, Mesh, Vector3, Matrix4 } from "three";
  import { onDestroy } from "svelte";
  import { disposeSceneGraph } from "../../utils/dispose-scene";
  import { generateSDFTexture, type SDFResult } from "./sdf-generator";

  export interface ReefSDFData {
    results: SDFResult[];
  }

  interface Props {
    stageRadius?: number;
    clearingRadius?: number;
    tintColor?: string;
    tintBlend?: number;
    onSdfReady?: (data: ReefSDFData) => void;
  }

  let {
    stageRadius = 6,
    clearingRadius = 10,
    tintColor = "#0d2a3a",
    tintBlend = 0.3,
    onSdfReady,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const dracoLoader = useDraco("/draco/");
  const opts = { dracoLoader, meshoptDecoder: MeshoptDecoder };

  const archGlb = useGltf("/models/ocean/structures/coral-arch.glb", opts);
  const wallGlb = useGltf("/models/ocean/structures/reef-wall.glb", opts);
  const bommieGlb = useGltf("/models/ocean/structures/coral-bommie.glb", opts);
  const towerGlb = useGltf("/models/ocean/structures/coral-tower.glb", opts);

  interface StructurePlacement {
    model: { scene: Object3D } | undefined;
    x: number;
    z: number;
    rotY: number;
    targetHeight: number;
  }

  const placements: StructurePlacement[] = [
    { model: undefined, x: -18, z: -16, rotY: 0.3, targetHeight: 6 },
    { model: undefined, x: 14, z: -18, rotY: -0.5, targetHeight: 5 },
    { model: undefined, x: -12, z: 16, rotY: 2.2, targetHeight: 3 },
    { model: undefined, x: 18, z: 10, rotY: -1.8, targetHeight: 8 },
  ];

  function measureExtent(root: Object3D): { maxDim: number; minY: number } {
    root.updateMatrixWorld(true);
    const v = new Vector3();
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    root.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh || !m.geometry) return;
      const pos = m.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(m.matrixWorld);
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        minZ = Math.min(minZ, v.z);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
        maxZ = Math.max(maxZ, v.z);
      }
    });
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    return {
      maxDim: isFinite(maxDim) && maxDim > 0 ? maxDim : 1,
      minY: isFinite(minY) ? minY : 0,
    };
  }

  function tintModel(root: Object3D, color: string, blend: number) {
    const tc = new Color(color);
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const c = (mat as import("three").MeshStandardMaterial).clone();
        if (c.color) c.color.lerp(tc, blend);
        c.roughness = Math.max(c.roughness, 0.6);
        return c;
      });
      (m as any).material = Array.isArray(m.material) ? cloned : cloned[0];
    });
  }

  function getTerrainY(x: number, z: number): number {
    return terrainHeightForPlacement(x, z, stageRadius, clearingRadius);
  }

  interface PreparedStructure {
    clone: Object3D;
    x: number;
    z: number;
    rotY: number;
    scale: number;
    baseY: number;
  }

  const structures = $derived.by((): PreparedStructure[] => {
    const models = [$archGlb, $wallGlb, $bommieGlb, $towerGlb];
    const results: PreparedStructure[] = [];

    for (let i = 0; i < placements.length; i++) {
      const model = models[i];
      const p = placements[i]!;
      if (!model) continue;

      const clone = model.scene.clone();
      tintModel(clone, tintColor, tintBlend);

      const { maxDim, minY } = measureExtent(model.scene);
      const scale = p.targetHeight / maxDim;
      const baseY = -minY * scale;

      results.push({
        clone,
        x: p.x,
        z: p.z,
        rotY: p.rotY,
        scale,
        baseY,
      });
    }

    return results;
  });

  // ── SDF Generation ─────────────────────────────────────────────────
  // Generate SDF textures once all 4 models are loaded. We build a
  // temporary Object3D with the final world transform for each structure
  // and pass it to the CPU-based SDF generator.

  let sdfGenerated = false;

  $effect(() => {
    const models = [$archGlb, $wallGlb, $bommieGlb, $towerGlb];
    const allLoaded = models.every(Boolean);
    if (!allLoaded || sdfGenerated || !onSdfReady) return;

    sdfGenerated = true;
    let aborted = false;

    (async () => {
      const t0 = performance.now();
      const sdfResults: SDFResult[] = [];

      for (let i = 0; i < placements.length; i++) {
        if (aborted) return;
        const model = models[i];
        const p = placements[i]!;
        if (!model) continue;

        const { maxDim, minY } = measureExtent(model.scene);
        const scale = p.targetHeight / maxDim;
        const baseY = -minY * scale;
        const posY = groundY + getTerrainY(p.x, p.z) + baseY;

        const wrapper = new Object3D();
        const sceneClone = model.scene.clone();
        wrapper.add(sceneClone);
        sceneClone.position.set(p.x, posY, p.z);
        sceneClone.rotation.y = p.rotY;
        sceneClone.scale.setScalar(scale);
        wrapper.updateMatrixWorld(true);

        try {
          const result = await generateSDFTexture(wrapper, { resolution: 32, padding: 2.0 });
          sdfResults.push(result);
          console.log(`[ReefStructures] SDF ${i + 1}/${placements.length} done`);
        } catch (e) {
          console.warn(`[ReefStructures] SDF generation failed for structure ${i}:`, e);
        }
      }

      if (!aborted && sdfResults.length > 0 && onSdfReady) {
        const elapsed = (performance.now() - t0).toFixed(1);
        console.log(`[ReefStructures] Generated ${sdfResults.length} SDF textures in ${elapsed}ms`);
        onSdfReady({ results: sdfResults });
      }
    })();

    return () => { aborted = true; };
  });

  onDestroy(() => {
    for (const s of structures) disposeSceneGraph(s.clone);
  });
</script>

{#each structures as s}
  <T
    is={s.clone}
    position.x={s.x}
    position.y={groundY + getTerrainY(s.x, s.z) + s.baseY}
    position.z={s.z}
    scale={s.scale}
    rotation.y={s.rotY}
  />
{/each}
