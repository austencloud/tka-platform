<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf, useDraco } from "@threlte/extras";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import ProceduralSeabed from "./ocean/ProceduralSeabed.svelte";
  import WaterSurface from "./ocean/WaterSurface.svelte";
  import { terrainHeight as terrainHeightRaw, terrainHeightForPlacement } from "./ocean/terrain-height";
  import type { OceanVariant } from "../domain/enums/environment-enums";
  import {
    type OceanSceneConfig,
    createDefaultOceanAbyssConfig,
    createDefaultOceanReefConfig,
    createDefaultOceanMysticalConfig,
    createDefaultOceanCinematicConfig,
  } from "../domain/models/scene-configs";
  import { poissonDiscSample, seededRandom } from "../utils/poisson-disc";
  import { clone as cloneWithSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, onMount } from "svelte";
  import { disposeSceneGraph } from "../utils/dispose-scene";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import RuinsPlatform from "./ocean/RuinsPlatform.svelte";
  import GodRayShafts from "./ocean/GodRayShafts.svelte";
  import FishSchool from "./ocean/FishSchool.svelte";
  import UnderwaterParticles from "./ocean/UnderwaterParticles.svelte";
  import {
    FogExp2,
    Color,
    Mesh,
    Object3D,
    Vector3,
    Box3,
  } from "three";

  // ── Props + Config ────────────────────────────────────────────────────

  interface Props {
    variant?: OceanVariant;
    config?: OceanSceneConfig;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { variant = "abyss", config, performerCount = 1, stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const VARIANT_CONFIGS: Record<OceanVariant, () => OceanSceneConfig> = {
    abyss: createDefaultOceanAbyssConfig,
    reef: createDefaultOceanReefConfig,
    mystical: createDefaultOceanMysticalConfig,
    cinematic: createDefaultOceanCinematicConfig,
  };

  const baseConfig = $derived(config ?? VARIANT_CONFIGS[variant]());

  const activeConfig = $derived.by(() => {
    const w = Math.max(baseConfig.platform.width, stageWidth);
    const d = Math.max(baseConfig.platform.depth, stageDepth);
    if (w <= baseConfig.platform.width && d <= baseConfig.platform.depth) return baseConfig;
    return {
      ...baseConfig,
      platform: {
        ...baseConfig.platform,
        width: w,
        depth: d,
        zOffset: stageZOffset,
      },
    };
  });

  // ── Model Loading ─────────────────────────────────────────────────────

  const dracoLoader = useDraco("/draco/");
  const opts = { dracoLoader };

  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";
  const rockA = useGltf(`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`, opts);
  const rockB = useGltf(`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`, opts);
  const rockC = useGltf("/models/vegetation/rock/rock_largeA.glb", opts);
  const rockD = useGltf("/models/vegetation/rock/rock_largeD.glb", opts);
  const rockE = useGltf("/models/vegetation/rock/rock_smallD.glb", opts);
  const rockF = useGltf("/models/vegetation/rock/rock_tallC.glb", opts);

  const coralGlb0 = useGltf("/models/ocean/coral_0.glb", opts);
  const coralGlb1 = useGltf("/models/ocean/coral_1.glb", opts);
  const coralGlb2 = useGltf("/models/ocean/coral_2.glb", opts);
  const coralGlb3 = useGltf("/models/ocean/coral_3.glb", opts);
  const coralLargeGlb = useGltf("/models/ocean/coral_large.glb", opts);

  const seaweedGlb = useGltf("/models/ocean/seaweed.glb", opts);
  const kelpPlantGlb = useGltf("/models/ocean/kelp_plant.glb", opts);

  const jellyfishGlb = useGltf("/models/ocean/jellyfish.glb", opts);
  const jellyfishSmallGlb = useGltf("/models/ocean/jellyfish_small.glb", opts);

  const starfishGlb = useGltf("/models/ocean/starfish.glb", opts);
  const seaUrchinGlb = useGltf("/models/ocean/sea_urchin.glb", opts);
  const shellGlb = useGltf("/models/ocean/shell.glb", opts);
  const anemoneGlb = useGltf("/models/ocean/anemone.glb", opts);

  // ── Scene Context ─────────────────────────────────────────────────────

  const { scene } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(null);
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  function getTerrainY(wx: number, wz: number): number {
    return terrainHeightForPlacement(wx, wz, zones.stageRadius, zones.clearingRadius);
  }

  const seabedRippleColor = $derived.by(() => {
    const c = new Color(activeConfig.ground.color);
    c.offsetHSL(0, 0.05, 0.08);
    return "#" + c.getHexString();
  });

  // ── Reef Formation Placement ────────────────────────────────────────
  // Real reefs: rock outcrops anchor coral colonies, kelp grows near structure.
  // Generate shared "formation" centers, then populate each with mixed species.

  interface Placement {
    x: number;
    z: number;
    scale: number;
    rotY: number;
  }

  const zones = $derived(activeConfig.zones);

  interface CoralPlacement extends Placement {
    hueShift: number;
    satBoost: number;
    speciesIdx: number;
  }

  const CORAL_PALETTE_HUES = [0.0, -0.15, 0.1, 0.2, -0.25];

  interface ReefFormation {
    x: number;
    z: number;
    radius: number;
    density: number;
    dominantSpecies: number;
    hue: number;
    saturation: number;
    hasAnchorRock: boolean;
    anchorRockScale: number;
  }

  const reefFormations = $derived.by((): ReefFormation[] => {
    const rng = seededRandom(42);
    const formations: ReefFormation[] = [];

    const formationCenters = poissonDiscSample({
      innerRadius: zones.clearingRadius + 0.5,
      outerRadius: zones.backgroundRadius - 2,
      minDistance: 2.5,
      count: 50,
      seed: 42,
    });

    for (const center of formationCenters) {
      const dist = Math.sqrt(center.x * center.x + center.z * center.z);
      if (dist < zones.stageRadius) continue;

      const distFactor = Math.min((dist - zones.stageRadius) / (zones.backgroundRadius - zones.stageRadius), 1.0);
      const isLargeFormation = rng() > 0.6;
      const species = Math.floor(rng() * 5);

      formations.push({
        x: center.x,
        z: center.z,
        radius: isLargeFormation ? 2.5 + rng() * 2.0 : 1.0 + rng() * 1.5,
        density: 0.5 + rng() * 0.5,
        dominantSpecies: species,
        hue: CORAL_PALETTE_HUES[species]! + (rng() - 0.5) * 0.04,
        saturation: 0.85 + rng() * 0.3,
        hasAnchorRock: rng() > 0.3,
        anchorRockScale: isLargeFormation
          ? 0.8 + rng() * 1.5 + distFactor * 1.5
          : 0.3 + rng() * 0.5,
      });
    }
    return formations;
  });

  const coralPlacements = $derived.by((): CoralPlacement[] => {
    if (!activeConfig.coral.enabled) return [];
    const rng = seededRandom(100);
    const results: CoralPlacement[] = [];
    const maxCount = activeConfig.coral.count;

    for (const formation of reefFormations) {
      const count = Math.floor(3 + formation.density * 8 * (formation.radius / 2.0));
      for (let j = 0; j < count && results.length < maxCount; j++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * formation.radius;
        const x = formation.x + Math.cos(angle) * dist;
        const z = formation.z + Math.sin(angle) * dist;

        const r = Math.sqrt(x * x + z * z);
        if (r < zones.stageRadius || r > zones.backgroundRadius) continue;

        const closeness = 1.0 - dist / formation.radius;
        const sizeRoll = rng();
        const baseScale = sizeRoll > 0.85
          ? 0.8 + rng() * 1.2
          : sizeRoll > 0.5
            ? 0.3 + rng() * 0.5
            : 0.1 + rng() * 0.25;

        results.push({
          x, z,
          scale: baseScale * (0.6 + closeness * 0.8),
          rotY: rng() * Math.PI * 2,
          hueShift: formation.hue + (rng() - 0.5) * 0.03,
          satBoost: formation.saturation + (rng() - 0.5) * 0.1,
          speciesIdx: (formation.dominantSpecies + (rng() > 0.7 ? Math.floor(rng() * 4) + 1 : 0)) % 5,
        });
      }
    }

    // Scattered clearing coral — small clusters in the sandy zone
    const clearingCoral = poissonDiscSample({
      innerRadius: zones.stageRadius + 0.5,
      outerRadius: zones.clearingRadius,
      minDistance: 1.5,
      count: 25,
      seed: 150,
    });
    const rngClearing = seededRandom(151);
    for (const s of clearingCoral) {
      if (results.length >= maxCount) break;
      results.push({
        x: s.x, z: s.z,
        scale: 0.15 + rngClearing() * 0.3,
        rotY: rngClearing() * Math.PI * 2,
        hueShift: CORAL_PALETTE_HUES[Math.floor(rngClearing() * 5)]! + (rngClearing() - 0.5) * 0.04,
        satBoost: 0.9 + rngClearing() * 0.2,
        speciesIdx: Math.floor(rngClearing() * 5),
      });
    }

    return results;
  });

  const kelpPlacements = $derived.by((): Placement[] => {
    if (!activeConfig.kelp.enabled || activeConfig.kelp.count === 0) return [];
    const rng = seededRandom(200);
    const results: Placement[] = [];
    const maxCount = activeConfig.kelp.count;

    for (const formation of reefFormations) {
      if (rng() > 0.85) continue;

      const kelpCount = Math.floor(4 + formation.density * 10 * (formation.radius / 2.0));

      const patchAngle = rng() * Math.PI * 2;
      const patchDist = formation.radius * (0.3 + rng() * 0.5);
      const patchX = formation.x + Math.cos(patchAngle) * patchDist;
      const patchZ = formation.z + Math.sin(patchAngle) * patchDist;

      for (let j = 0; j < kelpCount && results.length < maxCount; j++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * 1.2;
        const x = patchX + Math.cos(angle) * dist;
        const z = patchZ + Math.sin(angle) * dist;

        const r = Math.sqrt(x * x + z * z);
        if (r < zones.clearingRadius || r > zones.backgroundRadius) continue;

        results.push({
          x, z,
          scale: 0.4 + rng() * 1.0,
          rotY: rng() * Math.PI * 2,
        });
      }
    }
    return results;
  });

  const rockPlacements = $derived.by((): Placement[] => {
    if (!activeConfig.rocks.enabled || activeConfig.rocks.count === 0) return [];
    const rng = seededRandom(300);
    const results: Placement[] = [];
    const maxCount = activeConfig.rocks.count;

    for (const formation of reefFormations) {
      if (!formation.hasAnchorRock) continue;
      results.push({
        x: formation.x + (rng() - 0.5) * 0.3,
        z: formation.z + (rng() - 0.5) * 0.3,
        scale: formation.anchorRockScale,
        rotY: rng() * Math.PI * 2,
      });

      const satelliteCount = Math.floor(1 + formation.density * 3);
      for (let j = 0; j < satelliteCount && results.length < maxCount; j++) {
        const angle = rng() * Math.PI * 2;
        const dist = 0.5 + rng() * formation.radius * 0.6;
        results.push({
          x: formation.x + Math.cos(angle) * dist,
          z: formation.z + Math.sin(angle) * dist,
          scale: formation.anchorRockScale * (0.2 + rng() * 0.4),
          rotY: rng() * Math.PI * 2,
        });
      }
    }

    // Clearing rocks — small pebbles/rocks in the sandy zone near stage
    const clearingSamples = poissonDiscSample({
      innerRadius: zones.stageRadius + 0.5,
      outerRadius: zones.clearingRadius,
      minDistance: 1.2,
      count: 30,
      seed: 345,
    });
    const rngClearing = seededRandom(346);
    for (const s of clearingSamples) {
      if (results.length >= maxCount) break;
      results.push({
        x: s.x, z: s.z,
        scale: 0.08 + rngClearing() * 0.2,
        rotY: rngClearing() * Math.PI * 2,
      });
    }

    const scatterSamples = poissonDiscSample({
      innerRadius: zones.clearingRadius,
      outerRadius: zones.backgroundRadius,
      minDistance: 1.8,
      count: Math.max(0, maxCount - results.length),
      seed: 350,
    });
    const rng2 = seededRandom(351);
    for (const s of scatterSamples) {
      if (results.length >= maxCount) break;
      const isLarge = rng2() < 0.2;
      results.push({
        x: s.x, z: s.z,
        scale: isLarge ? 0.4 + rng2() * 0.5 : 0.1 + rng2() * 0.35,
        rotY: rng2() * Math.PI * 2,
      });
    }

    return results;
  });

  const boulderPlacements = $derived.by((): Placement[] => {
    if (!activeConfig.rocks.enabled) return [];
    const rng = seededRandom(400);
    const results: Placement[] = [];

    const largeFormations = reefFormations.filter(f => f.radius > 2.5 && f.hasAnchorRock);
    for (const formation of largeFormations) {
      if (results.length >= 20) break;
      results.push({
        x: formation.x + (rng() - 0.5) * 1.0,
        z: formation.z + (rng() - 0.5) * 1.0,
        scale: 1.5 + formation.anchorRockScale * 1.2 + rng() * 1.0,
        rotY: rng() * Math.PI * 2,
      });
    }

    const bgSamples = poissonDiscSample({
      innerRadius: zones.forestOuter,
      outerRadius: zones.backgroundRadius,
      minDistance: 5.0,
      count: Math.max(0, 20 - results.length),
      seed: 450,
    });
    for (const s of bgSamples) {
      if (results.length >= 20) break;
      results.push({
        x: s.x, z: s.z,
        scale: 2.0 + rng() * 3.0,
        rotY: rng() * Math.PI * 2,
      });
    }

    return results;
  });

  type DecoType = "starfish" | "urchin" | "shell" | "anemone";
  interface DecoPlacement extends Placement {
    type: DecoType;
  }

  const decorationPlacements = $derived.by((): DecoPlacement[] => {
    if (!activeConfig.decorations.enabled) return [];
    const rng = seededRandom(390);
    const results: DecoPlacement[] = [];
    const maxCount = activeConfig.decorations.count;

    // Anemones — attach to rocks within formations (need hard substrate)
    for (const rock of rockPlacements) {
      if (results.length >= maxCount * 0.25) break;
      if (rng() > 0.4) continue;
      const angle = rng() * Math.PI * 2;
      const dist = 0.3 + rng() * 0.6;
      results.push({
        x: rock.x + Math.cos(angle) * dist,
        z: rock.z + Math.sin(angle) * dist,
        scale: 0.4 + rng() * 0.5,
        rotY: rng() * Math.PI * 2,
        type: "anemone",
      });
    }

    // Starfish — perch near coral and on rocks
    for (const coral of coralPlacements) {
      if (results.length >= maxCount * 0.5) break;
      if (rng() > 0.12) continue;
      const angle = rng() * Math.PI * 2;
      const dist = 0.2 + rng() * 0.8;
      results.push({
        x: coral.x + Math.cos(angle) * dist,
        z: coral.z + Math.sin(angle) * dist,
        scale: 0.3 + rng() * 0.4,
        rotY: rng() * Math.PI * 2,
        type: "starfish",
      });
    }

    // Urchins — nestle between rocks in formations
    for (const formation of reefFormations) {
      if (results.length >= maxCount * 0.7) break;
      if (!formation.hasAnchorRock) continue;
      const urchinCount = Math.floor(1 + rng() * 3);
      for (let j = 0; j < urchinCount; j++) {
        const angle = rng() * Math.PI * 2;
        const dist = 0.5 + rng() * formation.radius * 0.5;
        results.push({
          x: formation.x + Math.cos(angle) * dist,
          z: formation.z + Math.sin(angle) * dist,
          scale: 0.25 + rng() * 0.35,
          rotY: rng() * Math.PI * 2,
          type: "urchin",
        });
      }
    }

    // Shells — scattered on open sand between formations (debris, wave-deposited)
    const shellSamples = poissonDiscSample({
      innerRadius: zones.stageRadius,
      outerRadius: zones.clearingRadius + 3,
      minDistance: 0.8,
      count: Math.max(0, maxCount - results.length),
      seed: 395,
    });
    const rng2 = seededRandom(396);
    for (const s of shellSamples) {
      if (results.length >= maxCount) break;
      // Shells avoid formation centers — they're wave-deposited on open sand
      let nearFormation = false;
      for (const f of reefFormations) {
        const dx = s.x - f.x, dz = s.z - f.z;
        if (dx * dx + dz * dz < f.radius * f.radius) { nearFormation = true; break; }
      }
      if (nearFormation) continue;
      results.push({
        x: s.x, z: s.z,
        scale: 0.15 + rng2() * 0.25,
        rotY: rng2() * Math.PI * 2,
        type: "shell",
      });
    }

    return results;
  });


  let jellyfishOffsets = $state<{ dx: number; dy: number; dz: number; pulse: number }[]>([]);
  let jellyfishTime = $state(0);
  let animTime = 0;


  $effect(() => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) {
      jellyfishOffsets = [];
      return;
    }
    jellyfishOffsets = Array.from({ length: jf.count }, () => ({
      dx: 0,
      dy: 0,
      dz: 0,
      pulse: 1.0,
    }));
  });

  // ── Jellyfish Data ────────────────────────────────────────────────────

  interface JellyfishSample {
    x: number;
    y: number;
    z: number;
    seed: number;
    isSmall: boolean;
  }

  const jellyfishSamples = $derived.by((): JellyfishSample[] => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) return [];
    const rng = seededRandom(600);
    return Array.from({ length: jf.count }, (_, i) => ({
      x: (rng() - 0.5) * jf.spawnRadius * 2,
      z: (rng() - 0.5) * jf.spawnRadius * 2,
      y: jf.heightRange[0] + rng() * (jf.heightRange[1] - jf.heightRange[0]),
      seed: i * 37,
      isSmall: rng() > 0.6,
    }));
  });

  // ── Model Scaling ─────────────────────────────────────────────────────

  const MAX_CREATURE_SCALE = 0.5;

  function measureModelExtent(root: Object3D): number {
    root.updateMatrixWorld(true);
    const v = new Vector3();
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let found = false;
    root.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh || !m.geometry) return;
      const pos = m.geometry.getAttribute("position");
      if (!pos) return;
      found = true;
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
    if (!found) return 0;
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    return isFinite(extent) && extent > 0 ? extent : 0;
  }

  function measureModelMinY(root: Object3D): number {
    root.updateMatrixWorld(true);
    const v = new Vector3();
    let minY = 0;
    root.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh || !m.geometry) return;
      const pos = m.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(m.matrixWorld);
        if (v.y < minY) minY = v.y;
      }
    });
    return minY;
  }

  function mScale(
    model: { scene: Object3D } | undefined,
    target: number,
  ): number {
    if (!model) return 0.0002;
    const extent = measureModelExtent(model.scene as Object3D);
    return extent < 0.001
      ? 0.0002
      : Math.min(target / extent, MAX_CREATURE_SCALE);
  }

  const jellyfishLargeScale = $derived(mScale($jellyfishGlb, 0.4));
  const jellyfishSmallScale = $derived(mScale($jellyfishSmallGlb, 0.2));
  function decoScale(type: DecoType): number {
    const target = activeConfig.decorations.targetSize;
    if (type === "starfish") return mScale($starfishGlb, target);
    if (type === "urchin") return mScale($seaUrchinGlb, target);
    if (type === "shell") return mScale($shellGlb, target);
    return mScale($anemoneGlb, target);
  }

  // ── Underwater Tinting ────────────────────────────────────────────────

  function tintUnderwater(
    root: Object3D,
    color: string,
    blend: number,
    enrichMaterial = false,
  ) {
    const tintColor = new Color(color);
    let meshIdx = 0;
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const idx = meshIdx++;
      const cloned = mats.map((mat) => {
        const c = (mat as import("three").MeshStandardMaterial).clone();
        if (c.color) c.color.lerp(tintColor, blend);
        if (enrichMaterial) {
          const variation = ((idx * 17 + 31) % 100) / 100;
          c.roughness = 0.4 + variation * 0.4;
          c.metalness = 0.05 + variation * 0.1;
          if (c.emissive) {
            const emissiveColor = tintColor.clone();
            emissiveColor.multiplyScalar(0.3 + variation * 0.4);
            c.emissive.copy(emissiveColor);
            c.emissiveIntensity = 0.15 + variation * 0.25;
          }
          if (c.color) {
            const hsl = { h: 0, s: 0, l: 0 };
            c.color.getHSL(hsl);
            hsl.l = Math.max(0.08, Math.min(0.6, hsl.l + (variation - 0.5) * 0.15));
            c.color.setHSL(hsl.h, hsl.s, hsl.l);
          }
        } else {
          if (c.emissive) c.emissive.lerp(tintColor, blend * 0.5);
        }
        return c;
      });
      (m as unknown as { material: unknown }).material = Array.isArray(m.material)
        ? cloned
        : cloned[0]!;
    });
  }

  function hasSkeleton(root: Object3D): boolean {
    let found = false;
    root.traverse((c) => { if ((c as any).isSkinnedMesh) found = true; });
    return found;
  }

  function underwaterClone(
    sourceScene: Object3D,
    color: string,
    blend: number,
    enrichMaterial = false,
  ): Object3D {
    const cloned = hasSkeleton(sourceScene)
      ? cloneWithSkeleton(sourceScene)
      : sourceScene.clone();
    tintUnderwater(cloned, color, blend, enrichMaterial);
    return cloned;
  }

  // ── Clone Caching ─────────────────────────────────────────────────────

  const coralClones = $derived.by(() => {
    const models = [
      $coralGlb0,
      $coralGlb1,
      $coralGlb2,
      $coralGlb3,
      $coralLargeGlb,
    ].filter(Boolean) as { scene: Object3D }[];
    if (models.length === 0) return [];
    return coralPlacements.map((placement) => {
      const baseColor = new Color(activeConfig.coral.glowColor);
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      hsl.h += placement.hueShift;
      hsl.s = Math.min(1, hsl.s * placement.satBoost);
      hsl.l = Math.max(0.1, Math.min(0.7, hsl.l + (placement.hueShift > 0 ? 0.05 : -0.03)));
      baseColor.setHSL(hsl.h, hsl.s, hsl.l);
      const modelIdx = placement.speciesIdx % models.length;
      return underwaterClone(
        models[modelIdx]!.scene,
        "#" + baseColor.getHexString(),
        activeConfig.coral.glowBlend,
        true,
      );
    });
  });

  const coralScales = $derived.by((): number[] => {
    const models = [
      $coralGlb0,
      $coralGlb1,
      $coralGlb2,
      $coralGlb3,
      $coralLargeGlb,
    ].filter(Boolean) as { scene: Object3D }[];
    if (models.length === 0) return [];
    return coralPlacements.map((placement) =>
      mScale(models[placement.speciesIdx % models.length], 0.5),
    );
  });

  const coralBaseOffsets = $derived.by((): number[] => {
    const models = [
      $coralGlb0,
      $coralGlb1,
      $coralGlb2,
      $coralGlb3,
      $coralLargeGlb,
    ].filter(Boolean) as { scene: Object3D }[];
    return models.map((m) => {
      const raw = -measureModelMinY(m.scene as Object3D);
      return raw * 1.3 + 0.08;
    });
  });

  const kelpBaseOffsets = $derived.by((): number[] => {
    const models = [$seaweedGlb, $kelpPlantGlb].filter(Boolean) as { scene: Object3D }[];
    return models.map((m) => {
      const raw = -measureModelMinY(m.scene as Object3D);
      return raw * 1.3 + 0.08;
    });
  });

  const kelpScales = $derived.by((): number[] => {
    const models = [$seaweedGlb, $kelpPlantGlb].filter(Boolean) as { scene: Object3D }[];
    if (models.length === 0) return [];
    return kelpPlacements.map((_, i) =>
      mScale(models[i % models.length], 1.5),
    );
  });

  const rockModels = $derived.by(() => {
    return [$rockA, $rockB, $rockC, $rockD, $rockE, $rockF].filter(Boolean) as { scene: Object3D }[];
  });

  const rockScales = $derived.by((): number[] => {
    if (rockModels.length === 0) return [];
    return rockPlacements.map((_, i) =>
      mScale(rockModels[i % rockModels.length]!, 0.6),
    );
  });

  const rockBaseOffsets = $derived.by((): number[] => {
    return rockModels.map((m) => {
      const raw = -measureModelMinY(m.scene as Object3D);
      return raw * 1.1;
    });
  });

  const kelpClones = $derived.by(() => {
    const models = [$seaweedGlb, $kelpPlantGlb].filter(Boolean) as {
      scene: Object3D;
    }[];
    if (models.length === 0) return [];
    return kelpPlacements.map((_, i) =>
      underwaterClone(models[i % models.length]!.scene, "#0d3a1a", 0.2, true),
    );
  });

  const rockClones = $derived.by(() => {
    if (rockModels.length === 0) return [];
    return rockPlacements.map((_, i) =>
      underwaterClone(
        rockModels[i % rockModels.length]!.scene as Object3D,
        activeConfig.rocks.tintColor,
        activeConfig.rocks.tintBlend,
      ),
    );
  });

  const boulderClones = $derived.by(() => {
    if (rockModels.length === 0) return [];
    return boulderPlacements.map((_, i) =>
      underwaterClone(
        rockModels[i % rockModels.length]!.scene as Object3D,
        "#0d1a2a",
        0.6,
      ),
    );
  });

  const boulderScales = $derived.by((): number[] => {
    if (rockModels.length === 0) return [];
    return boulderPlacements.map((_, i) =>
      mScale(rockModels[i % rockModels.length]!, 2.0),
    );
  });

  const jellyfishClones = $derived.by(() => {
    const large = $jellyfishGlb;
    const small = $jellyfishSmallGlb;
    if (!large) return [];
    return jellyfishSamples.map((jf) => {
      if (jf.isSmall && small) return small.scene.clone();
      return large.scene.clone();
    });
  });

  const decorationClones = $derived.by(() => {
    return decorationPlacements.map((dec) => {
      if (dec.type === "starfish" && $starfishGlb)
        return $starfishGlb.scene.clone();
      if (dec.type === "urchin" && $seaUrchinGlb)
        return $seaUrchinGlb.scene.clone();
      if (dec.type === "shell" && $shellGlb) return $shellGlb.scene.clone();
      if (dec.type === "anemone" && $anemoneGlb)
        return underwaterClone($anemoneGlb.scene as Object3D, "#cc3366", 0.25);
      return null;
    });
  });

  // ── Animation Loop ────────────────────────────────────────────────────

  useTask((delta) => {
    animTime += delta;

    // Jellyfish: drift + bell pulse
    const jf = activeConfig.jellyfish;
    if (jf?.enabled && jellyfishOffsets.length > 0) {
      jellyfishTime += delta * jf.driftSpeed;
      const pulseAmp = jf.pulseAmplitude ?? 0.15;
      for (let i = 0; i < jellyfishOffsets.length; i++) {
        const phase = i * 2.3;
        const pulsePhase =
          jellyfishTime * jf.pulseRate * Math.PI * 2 + i * 1.7;
        jellyfishOffsets[i] = {
          dx: Math.sin(jellyfishTime * 0.7 + phase) * 1.5,
          dy:
            Math.sin(jellyfishTime * 0.4 + phase * 1.3) * 0.5 +
            Math.sin(pulsePhase) * 0.15,
          dz: Math.cos(jellyfishTime * 0.5 + phase * 0.8) * 1.5,
          pulse: 1.0 + Math.sin(pulsePhase) * pulseAmp,
        };
      }
    }

    // Kelp: gentle sway via direct rotation mutation
    const swaySpeed = activeConfig.kelp.swaySpeed;
    const swayAmp = activeConfig.kelp.swayAmplitude;
    for (let i = 0; i < kelpClones.length; i++) {
      const clone = kelpClones[i];
      if (clone) {
        const phase = i * 1.7;
        clone.rotation.x =
          Math.sin(animTime * swaySpeed + phase) * swayAmp;
        clone.rotation.z =
          Math.cos(animTime * swaySpeed * 0.7 + phase) * swayAmp * 0.6;
      }
    }

  });

  // ── Fog ───────────────────────────────────────────────────────────────

  let fogInstance: FogExp2 | null = null;

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    if (!fogInstance) {
      fogInstance = new FogExp2(fog.color, fog.density);
      scene.current.fog = fogInstance;
    } else {
      fogInstance.color.set(fog.color);
      fogInstance.density = fog.density;
    }

    return () => {
      if (scene.current) scene.current.fog = null;
      fogInstance = null;
    };
  });

  // ── Loading Progress ──────────────────────────────────────────────────

  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [
      $coralGlb0, $coralGlb1, $coralGlb2, $coralGlb3, $coralLargeGlb,
      $seaweedGlb, $kelpPlantGlb,
      $jellyfishGlb, $jellyfishSmallGlb,
      $starfishGlb, $seaUrchinGlb, $shellGlb, $anemoneGlb,
      $rockC, $rockD, $rockE, $rockF,
    ];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) sceneFeatures.reportReady("environment");
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[OceanScene] Lifting curtain via timeout");
        sceneFeatures.reportReady("environment");
      }
    }, 5_000);

    // Debug: expose seabed diagnostic on window
    (window as any).__oceanDiag = () => {
      const box = new Box3();
      const wp = new Vector3();
      const results: { name: string; x: number; z: number; meshBottom: number; terrainY: number; delta: number }[] = [];

      scene.current.traverse((obj: any) => {
        if (!obj.isMesh && !obj.isGroup) return;
        if (obj.type === 'Scene') return;
        if (obj.material?.uniforms?.uTexRepeat) return;
        if (obj.material?.uniforms?.uWaterColor) return;

        obj.getWorldPosition(wp);
        if (Math.abs(wp.y - groundY) > 5) return;

        box.setFromObject(obj);
        if (!isFinite(box.min.y)) return;

        const th = terrainHeightRaw(wp.x, wp.z, zones.stageRadius, zones.clearingRadius);
        const surfaceY = groundY + th;
        const delta = box.min.y - surfaceY;

        if (delta < -0.05) {
          results.push({
            name: obj.name || obj.type || 'unnamed',
            x: +wp.x.toFixed(2),
            z: +wp.z.toFixed(2),
            meshBottom: +box.min.y.toFixed(3),
            terrainY: +surfaceY.toFixed(3),
            delta: +delta.toFixed(3),
          });
        }
      });

      results.sort((a, b) => a.delta - b.delta);
      console.table(results);
      console.log(`${results.length} sunken objects found (bottom below terrain surface)`);
      return results;
    };

    return () => clearTimeout(timer);
  });

  // ── Cleanup ───────────────────────────────────────────────────────────

  onDestroy(() => {
    for (const c of coralClones) disposeSceneGraph(c);
    for (const c of kelpClones) disposeSceneGraph(c);
    for (const c of rockClones) disposeSceneGraph(c);
    for (const c of boulderClones) disposeSceneGraph(c);
    for (const c of jellyfishClones) disposeSceneGraph(c);
    for (const c of decorationClones) if (c) disposeSceneGraph(c as Object3D);

  });
</script>

<!-- Sky gradient -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Procedural seabed with sand ripples (replaces flat ground) -->
<ProceduralSeabed
  color={activeConfig.ground.color}
  rippleColor={seabedRippleColor}
  size={activeConfig.ground.size}
  stageRadius={zones.stageRadius}
  clearingRadius={zones.clearingRadius}
/>

<!-- Water surface shimmer -->
{#if activeConfig.waterSurface?.enabled}
  <WaterSurface config={activeConfig.waterSurface} size={activeConfig.ground.size} />
{/if}


<!-- Coral formations (Poisson-disc placed, auto-scaled) -->
{#if activeConfig.coral.enabled && coralClones.length > 0}
  {#each coralClones as clone, i}
    {@const p = coralPlacements[i]}
    {@const s = coralScales[i] ?? 0.001}
    {#if p}
      {@const th = getTerrainY(p.x, p.z)}
      {@const baseOffset = (coralBaseOffsets[p.speciesIdx % coralBaseOffsets.length] ?? 0) * p.scale * s}
      <T
        is={clone}
        position.x={p.x}
        position.y={groundY + th + baseOffset}
        position.z={p.z}
        scale={p.scale * s}
        rotation.y={p.rotY}
      />
    {/if}
  {/each}
{/if}

<!-- Kelp forest (Poisson-disc, sway-animated via useTask) -->
{#if activeConfig.kelp.enabled && kelpClones.length > 0}
  {#each kelpClones as clone, i}
    {@const p = kelpPlacements[i]}
    {@const s = kelpScales[i] ?? 0.001}
    {#if p}
      {@const th = getTerrainY(p.x, p.z)}
      {@const baseOffset = (kelpBaseOffsets[i % kelpBaseOffsets.length] ?? 0) * p.scale * s}
      <T
        is={clone}
        position.x={p.x}
        position.y={groundY + th + baseOffset}
        position.z={p.z}
        scale={p.scale * s}
        rotation.y={p.rotY}
      />
    {/if}
  {/each}
{/if}

<!-- Seabed rocks (zone-placed: clearing → background) -->
{#if activeConfig.rocks.enabled && rockClones.length > 0}
  {#each rockClones as clone, i}
    {@const p = rockPlacements[i]}
    {@const s = rockScales[i] ?? 0.001}
    {#if p}
      {@const finalScale = p.scale * s}
      {@const baseY = (rockBaseOffsets[i % rockBaseOffsets.length] ?? 0) * finalScale}
      <T
        is={clone}
        position.x={p.x}
        position.y={groundY + getTerrainY(p.x, p.z) + baseY}
        position.z={p.z}
        scale={finalScale}
        rotation.y={p.rotY}
      />
    {/if}
  {/each}
{/if}

<!-- Background boulders (large silhouettes at distance) -->
{#if activeConfig.rocks.enabled && boulderClones.length > 0}
  {#each boulderClones as clone, i}
    {@const p = boulderPlacements[i]}
    {@const s = boulderScales[i] ?? 0.001}
    {#if p}
      {@const finalScale = p.scale * s}
      {@const baseY = (rockBaseOffsets[i % rockBaseOffsets.length] ?? 0) * finalScale}
      <T
        is={clone}
        position.x={p.x}
        position.y={groundY + getTerrainY(p.x, p.z) + baseY}
        position.z={p.z}
        scale={finalScale}
        rotation.y={p.rotY}
      />
    {/if}
  {/each}
{/if}

<!-- Floor decorations (zone-placed: stage edge → clearing) -->
{#if activeConfig.decorations.enabled}
  {#each decorationClones as clone, i}
    {@const dec = decorationPlacements[i]}
    {#if clone && dec}
      <T
        is={clone}
        position.x={dec.x}
        position.y={groundY + getTerrainY(dec.x, dec.z)}
        position.z={dec.z}
        scale={dec.scale * decoScale(dec.type)}
        rotation.y={dec.rotY}
      />
    {/if}
  {/each}
{/if}

<!-- GPGPU fish school (boids simulation) -->
{#if activeConfig.fish.enabled}
  <FishSchool
    targetSize={activeConfig.fish.targetSize}
    swimHeight={activeConfig.fish.swimHeight}
    speed={activeConfig.fish.speed}
    stageRadius={zones.clearingRadius}
    boundRadius={zones.forestOuter}
    currentStrength={activeConfig.fish.currentStrength}
    scatterRadius={activeConfig.fish.scatterRadius}
    perceptionAngle={activeConfig.fish.perceptionAngle}
  />
{/if}

<!-- Jellyfish (drift + pulse + bioluminescent glow) -->
{#if activeConfig.jellyfish?.enabled && jellyfishClones.length > 0}
  {#each jellyfishSamples as jf, i}
    {@const offset = jellyfishOffsets[i] ?? { dx: 0, dy: 0, dz: 0, pulse: 1.0 }}
    {@const baseScale = jf.isSmall ? jellyfishSmallScale : jellyfishLargeScale}
    {@const pulseScale = baseScale * (offset.pulse ?? 1.0)}
    <T.Group
      position.x={jf.x + offset.dx}
      position.y={groundY + jf.y + offset.dy}
      position.z={jf.z + offset.dz}
    >
      {#if jellyfishClones[i]}
        <T is={jellyfishClones[i]} scale={pulseScale} />
      {/if}
      <T.PointLight
        color={activeConfig.jellyfish.glowColor}
        intensity={activeConfig.jellyfish.lightIntensity *
          (0.7 +
            0.3 *
              Math.sin(
                jellyfishTime *
                  activeConfig.jellyfish.pulseRate *
                  Math.PI *
                  2 +
                  i * 1.7,
              ))}
        distance={activeConfig.jellyfish.lightDistance}
        decay={2}
      />
    </T.Group>
  {/each}
{/if}

<!-- Bubbles -->
{#key activeConfig.bubbles.count}
  <FallingParticles
    type={activeConfig.bubbles.type}
    count={activeConfig.bubbles.count}
    area={activeConfig.bubbles.area}
    speed={activeConfig.bubbles.speed}
    colors={activeConfig.bubbles.colors}
    sizeRange={activeConfig.bubbles.sizeRange}
    spin={activeConfig.bubbles.spin}
  />
{/key}

<!-- Dust motes -->
{#if activeConfig.dust}
  {#key activeConfig.dust.count}
    <FallingParticles
      type={activeConfig.dust.type}
      count={activeConfig.dust.count}
      area={activeConfig.dust.area}
      speed={activeConfig.dust.speed}
      colors={activeConfig.dust.colors}
      sizeRange={activeConfig.dust.sizeRange}
      spin={activeConfig.dust.spin}
    />
  {/key}
{/if}

<!-- Bioluminescent plankton -->
{#if activeConfig.plankton}
  {#key activeConfig.plankton.count}
    <FallingParticles
      type={activeConfig.plankton.type}
      count={activeConfig.plankton.count}
      area={activeConfig.plankton.area}
      speed={activeConfig.plankton.speed}
      colors={activeConfig.plankton.colors}
      sizeRange={activeConfig.plankton.sizeRange}
      spin={activeConfig.plankton.spin}
    />
  {/key}
{/if}

<!-- God rays (directional light from above) -->
{#if activeConfig.godRays?.enabled}
  <T.DirectionalLight
    color={activeConfig.godRays.color}
    intensity={activeConfig.godRays.intensity}
    position.x={activeConfig.godRays.position[0]}
    position.y={activeConfig.godRays.position[1]}
    position.z={activeConfig.godRays.position[2]}
  />
{/if}

<!-- Geometric god ray shafts (additive-blended light beams) -->
{#if activeConfig.godRayShafts?.enabled}
  <GodRayShafts config={activeConfig.godRayShafts} />
{/if}

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

<!-- Warm sun penetration fill — creates golden pool on seabed + performers -->
<T.PointLight
  color="#ffd080"
  intensity={0.6}
  distance={25}
  decay={2}
  position.x={3}
  position.y={groundY + 12}
  position.z={2}
/>

<!-- Marine snow / suspended sediment (GPU-driven, 4000 particles) -->
<UnderwaterParticles />

<RuinsPlatform config={activeConfig.platform} />
