<script lang="ts">
  import { T, useThrelte, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import ProceduralSeabed from "./ocean/ProceduralSeabed.svelte";
  import WaterSurface from "./ocean/WaterSurface.svelte";
  import { terrainHeight as terrainHeightRaw, terrainHeightForPlacement, setMoundSources, type MoundSource } from "./ocean/terrain-height";
  import type { OceanVariant } from "../domain/enums/environment-enums";
  import {
    type OceanSceneConfig,
    createDefaultOceanAbyssConfig,
    createDefaultOceanReefConfig,
    createDefaultOceanMysticalConfig,
    createDefaultOceanCinematicConfig,
  } from "../domain/models/scene-configs";
  import { poissonDiscSample, seededRandom, PlacementGrid } from "../utils/poisson-disc";
  import { clone as cloneWithSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
  import { createColoredInstancedMesh, createInstancedMeshFromModel, disposeInstancedMesh, type ColoredInstancePlacement, type InstancePlacement } from "./ocean/ocean-instancing";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, onMount } from "svelte";
  import { disposeSceneGraph } from "../utils/dispose-scene";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import RuinsPlatform from "./ocean/RuinsPlatform.svelte";
  import GodRayShafts from "./ocean/GodRayShafts.svelte";
  import FishSchool from "./ocean/FishSchool.svelte";
  import OceanMouseRaycast from "./ocean/OceanMouseRaycast.svelte";
  import UnderwaterParticles from "./ocean/UnderwaterParticles.svelte";
  import ReefStructures from "./ocean/ReefStructures.svelte";
  import type { ReefSDFData } from "./ocean/ReefStructures.svelte";
  import OceanLoadingScreen from "./ocean/OceanLoadingScreen.svelte";
  import { generateRockVariants, type RockVariant } from "./ocean/procedural-rock";
  import {
    FogExp2,
    Color,
    Mesh,
    Mesh as ThreeMesh,
    InstancedMesh,
    Object3D,
    Vector3,
    Matrix4 as ThreeMatrix4,
    Euler,
    Quaternion,
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

  const opts = { meshoptDecoder: MeshoptDecoder };

  const rockVariants: RockVariant[] = generateRockVariants(6, "#1a3a4a", 0.3);

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

  // Meshy-generated rock models (hero rocks for formations + boulders)
  const rockGlb0 = useGltf("/models/ocean/rock_0.glb", opts);
  const rockGlb1 = useGltf("/models/ocean/rock_1.glb", opts);
  const rockGlb2 = useGltf("/models/ocean/rock_2.glb", opts);
  const rockGlb3 = useGltf("/models/ocean/rock_3.glb", opts);
  const rockGlb4 = useGltf("/models/ocean/rock_4.glb", opts);
  const rockGlb5 = useGltf("/models/ocean/rock_5.glb", opts);

  const allGlbs = $derived([
    $coralGlb0, $coralGlb1, $coralGlb2, $coralGlb3, $coralLargeGlb,
    $seaweedGlb, $kelpPlantGlb,
    $jellyfishGlb, $jellyfishSmallGlb,
    $starfishGlb, $seaUrchinGlb, $shellGlb, $anemoneGlb,
    $rockGlb0, $rockGlb1, $rockGlb2, $rockGlb3, $rockGlb4, $rockGlb5,
  ]);
  const loadedCount = $derived(allGlbs.filter(Boolean).length);
  const loadingProgress = $derived(allGlbs.length > 0 ? loadedCount / allGlbs.length : 0);
  const allLoaded = $derived(loadedCount === allGlbs.length);

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
          ? 0.3 + rng() * 0.4 + distFactor * 0.3
          : 0.15 + rng() * 0.25,
      });
    }
    return formations;
  });

  // ── Coordinated placement with shared collision grid ─────────────────
  // All categories are computed together so each respects prior placements.
  // Priority order: hero rocks → procedural rocks → boulders → coral → kelp → decorations

  interface ScenePlacements {
    coral: CoralPlacement[];
    kelp: Placement[];
    rocks: Placement[];
    boulders: Placement[];
    heroRocks: (Placement & { modelIdx: number })[];
    decorations: (Placement & { type: "starfish" | "urchin" | "shell" | "anemone" })[];
  }

  const maxRockXzRadius = $derived(
    rockVariants.length > 0 ? Math.max(...rockVariants.map(v => v.xzRadius)) : 1.0,
  );

  const scenePlacements = $derived.by((): ScenePlacements => {
    // Grid only tracks LARGE items (hero rocks, boulders, large procedural rocks).
    // Coral, kelp, decorations CHECK against large items but DON'T register —
    // they cluster freely among themselves, just like a real reef.
    const grid = new PlacementGrid(3.0);
    const formations = reefFormations;
    const z_ = zones;
    const cfg = activeConfig;
    const rockRadius = maxRockXzRadius;

    // ── 1. Hero GLB rocks (largest — register with generous radius) ──
    const heroRocks: ScenePlacements["heroRocks"] = [];
    if (hasGlbRocks && cfg.rocks.enabled) {
      const rng = seededRandom(500);
      for (const formation of formations) {
        if (!formation.hasAnchorRock) continue;
        const x = formation.x + (rng() - 0.5) * 0.3;
        const z = formation.z + (rng() - 0.5) * 0.3;
        const scale = formation.anchorRockScale * 1.5;
        const r = scale * 1.2;
        if (grid.isClear(x, z, r)) {
          grid.register(x, z, r);
          heroRocks.push({ x, z, scale, rotY: rng() * Math.PI * 2, modelIdx: Math.floor(rng() * 6) });
        } else { rng(); rng(); }
      }
      const bgSamples = poissonDiscSample({ innerRadius: z_.forestOuter, outerRadius: z_.backgroundRadius, minDistance: 5.0, count: 15, seed: 550 });
      for (const s of bgSamples) {
        if (heroRocks.length >= 40) break;
        const scale = 0.8 + rng() * 1.0;
        const r = scale * 1.2;
        if (grid.isClear(s.x, s.z, r)) {
          grid.register(s.x, s.z, r);
          heroRocks.push({ x: s.x, z: s.z, scale, rotY: rng() * Math.PI * 2, modelIdx: Math.floor(rng() * 6) });
        } else { rng(); rng(); }
      }
    }

    // ── 2. Procedural rocks — scatter fill only, hero rocks own formations ─
    // When hero GLB rocks exist, they own formation anchors. Procedural rocks
    // become small pebbles/rubble filling gaps — never at formation centers.
    // When no GLB rocks, procedural rocks take formation anchor role.
    const rocks: Placement[] = [];
    if (cfg.rocks.enabled && cfg.rocks.count > 0) {
      const rng = seededRandom(300);
      const maxCount = cfg.rocks.count;

      if (!hasGlbRocks) {
        // No hero rocks — procedural rocks anchor formations
        for (const formation of formations) {
          if (!formation.hasAnchorRock) continue;
          const ax = formation.x + (rng() - 0.5) * 0.3;
          const az = formation.z + (rng() - 0.5) * 0.3;
          const as_ = formation.anchorRockScale;
          grid.register(ax, az, as_ * rockRadius);
          rocks.push({ x: ax, z: az, scale: as_, rotY: rng() * Math.PI * 2 });

          const satelliteCount = Math.floor(1 + formation.density * 3);
          for (let j = 0; j < satelliteCount && rocks.length < maxCount; j++) {
            const angle = rng() * Math.PI * 2;
            const dist = 0.5 + rng() * formation.radius * 0.6;
            rocks.push({
              x: formation.x + Math.cos(angle) * dist,
              z: formation.z + Math.sin(angle) * dist,
              scale: formation.anchorRockScale * (0.2 + rng() * 0.4),
              rotY: rng() * Math.PI * 2,
            });
          }
        }
      }

      // Small clearing pebbles (near stage)
      const clearingSamples = poissonDiscSample({ innerRadius: z_.stageRadius + 0.5, outerRadius: z_.clearingRadius, minDistance: 1.2, count: 30, seed: 345 });
      const rngC = seededRandom(346);
      for (const s of clearingSamples) {
        if (rocks.length >= maxCount) break;
        const ss = 0.08 + rngC() * 0.15;
        if (grid.isClear(s.x, s.z, ss * rockRadius)) {
          rocks.push({ x: s.x, z: s.z, scale: ss, rotY: rngC() * Math.PI * 2 });
        } else { rngC(); }
      }

      // Scatter fill between formations
      const scatterSamples = poissonDiscSample({ innerRadius: z_.clearingRadius, outerRadius: z_.backgroundRadius, minDistance: 1.5, count: Math.max(0, maxCount - rocks.length), seed: 350 });
      const rng2 = seededRandom(351);
      for (const s of scatterSamples) {
        if (rocks.length >= maxCount) break;
        const ss = 0.05 + rng2() * 0.15;
        if (grid.isClear(s.x, s.z, ss * rockRadius)) {
          rocks.push({ x: s.x, z: s.z, scale: ss, rotY: rng2() * Math.PI * 2 });
        } else { rng2(); }
      }
    }

    // ── 3. Boulders (large — register in grid) ──────────────────────
    const boulders: Placement[] = [];
    if (cfg.rocks.enabled && !hasGlbRocks) {
      const rng = seededRandom(400);
      const largeFormations = formations.filter(f => f.radius > 2.5 && f.hasAnchorRock);
      for (const formation of largeFormations) {
        if (boulders.length >= 20) break;
        const bx = formation.x + (rng() - 0.5) * 1.0;
        const bz = formation.z + (rng() - 0.5) * 1.0;
        const bs = 0.5 + formation.anchorRockScale * 0.8 + rng() * 0.4;
        if (grid.isClear(bx, bz, bs * 0.8)) {
          grid.register(bx, bz, bs * 0.8);
          boulders.push({ x: bx, z: bz, scale: bs, rotY: rng() * Math.PI * 2 });
        } else { rng(); }
      }
      const bgSamples = poissonDiscSample({ innerRadius: z_.forestOuter, outerRadius: z_.backgroundRadius, minDistance: 5.0, count: Math.max(0, 20 - boulders.length), seed: 450 });
      for (const s of bgSamples) {
        if (boulders.length >= 20) break;
        const bs = 0.6 + rng() * 0.6;
        if (grid.isClear(s.x, s.z, bs * 0.8)) {
          grid.register(s.x, s.z, bs * 0.8);
          boulders.push({ x: s.x, z: s.z, scale: bs, rotY: rng() * Math.PI * 2 });
        } else { rng(); }
      }
    }

    // ── 4. Coral — check against large items, DON'T register ─────────
    // Coral clusters freely among itself, just avoids hero rocks/boulders.
    const coral: CoralPlacement[] = [];
    if (cfg.coral.enabled) {
      const rng = seededRandom(100);
      const maxCount = cfg.coral.count;
      for (const formation of formations) {
        const count = Math.floor(3 + formation.density * 8 * (formation.radius / 2.0));
        for (let j = 0; j < count && coral.length < maxCount; j++) {
          const angle = rng() * Math.PI * 2;
          const dist = rng() * formation.radius;
          const x = formation.x + Math.cos(angle) * dist;
          const z = formation.z + Math.sin(angle) * dist;
          const rDist = Math.sqrt(x * x + z * z);
          if (rDist < z_.stageRadius || rDist > z_.backgroundRadius) continue;
          const closeness = 1.0 - dist / formation.radius;
          const sizeRoll = rng();
          const baseScale = sizeRoll > 0.85 ? 0.8 + rng() * 1.2 : sizeRoll > 0.5 ? 0.3 + rng() * 0.5 : 0.1 + rng() * 0.25;
          const finalScale = baseScale * (0.6 + closeness * 0.8);
          if (!grid.isClear(x, z, finalScale * 0.3)) continue;
          coral.push({
            x, z, scale: finalScale, rotY: rng() * Math.PI * 2,
            hueShift: formation.hue + (rng() - 0.5) * 0.03,
            satBoost: formation.saturation + (rng() - 0.5) * 0.1,
            speciesIdx: (formation.dominantSpecies + (rng() > 0.7 ? Math.floor(rng() * 4) + 1 : 0)) % 5,
          });
        }
      }
      const clearingCoral = poissonDiscSample({ innerRadius: z_.stageRadius + 0.5, outerRadius: z_.clearingRadius, minDistance: 1.5, count: 25, seed: 150 });
      const rngCl = seededRandom(151);
      for (const s of clearingCoral) {
        if (coral.length >= maxCount) break;
        coral.push({
          x: s.x, z: s.z, scale: 0.15 + rngCl() * 0.3, rotY: rngCl() * Math.PI * 2,
          hueShift: CORAL_PALETTE_HUES[Math.floor(rngCl() * 5)]! + (rngCl() - 0.5) * 0.04,
          satBoost: 0.9 + rngCl() * 0.2, speciesIdx: Math.floor(rngCl() * 5),
        });
      }
    }

    // ── 5. Kelp — check against large items, DON'T register ──────────
    const kelp: Placement[] = [];
    if (cfg.kelp.enabled && cfg.kelp.count > 0) {
      const rng = seededRandom(200);
      const maxCount = cfg.kelp.count;
      for (const formation of formations) {
        if (rng() > 0.85) continue;
        const kelpCount = Math.floor(4 + formation.density * 10 * (formation.radius / 2.0));
        const patchAngle = rng() * Math.PI * 2;
        const patchDist = formation.radius * (0.3 + rng() * 0.5);
        const patchX = formation.x + Math.cos(patchAngle) * patchDist;
        const patchZ = formation.z + Math.sin(patchAngle) * patchDist;
        for (let j = 0; j < kelpCount && kelp.length < maxCount; j++) {
          const angle = rng() * Math.PI * 2;
          const dist = rng() * 1.2;
          const x = patchX + Math.cos(angle) * dist;
          const z = patchZ + Math.sin(angle) * dist;
          const rDist = Math.sqrt(x * x + z * z);
          if (rDist < z_.clearingRadius || rDist > z_.backgroundRadius) continue;
          const ss = 0.4 + rng() * 1.0;
          if (!grid.isClear(x, z, ss * 0.2)) { rng(); continue; }
          kelp.push({ x, z, scale: ss, rotY: rng() * Math.PI * 2 });
        }
      }
    }

    // ── 6. Decorations — no grid checks, placed by ecology rules ─────
    type DecoType = "starfish" | "urchin" | "shell" | "anemone";
    const decorations: ScenePlacements["decorations"] = [];
    if (cfg.decorations.enabled) {
      const rng = seededRandom(390);
      const maxCount = cfg.decorations.count;
      for (const rock of rocks) {
        if (decorations.length >= maxCount * 0.25) break;
        if (rng() > 0.4) continue;
        const angle = rng() * Math.PI * 2;
        const dist = 0.3 + rng() * 0.6;
        decorations.push({ x: rock.x + Math.cos(angle) * dist, z: rock.z + Math.sin(angle) * dist, scale: 0.4 + rng() * 0.5, rotY: rng() * Math.PI * 2, type: "anemone" as DecoType });
      }
      for (const c of coral) {
        if (decorations.length >= maxCount * 0.5) break;
        if (rng() > 0.12) continue;
        const angle = rng() * Math.PI * 2;
        const dist = 0.2 + rng() * 0.8;
        decorations.push({ x: c.x + Math.cos(angle) * dist, z: c.z + Math.sin(angle) * dist, scale: 0.3 + rng() * 0.4, rotY: rng() * Math.PI * 2, type: "starfish" as DecoType });
      }
      for (const formation of formations) {
        if (decorations.length >= maxCount * 0.7) break;
        if (!formation.hasAnchorRock) continue;
        const urchinCount = Math.floor(1 + rng() * 3);
        for (let j = 0; j < urchinCount; j++) {
          const angle = rng() * Math.PI * 2;
          const dist = 0.5 + rng() * formation.radius * 0.5;
          decorations.push({ x: formation.x + Math.cos(angle) * dist, z: formation.z + Math.sin(angle) * dist, scale: 0.25 + rng() * 0.35, rotY: rng() * Math.PI * 2, type: "urchin" as DecoType });
        }
      }
      const shellSamples = poissonDiscSample({ innerRadius: z_.stageRadius, outerRadius: z_.clearingRadius + 3, minDistance: 0.8, count: Math.max(0, maxCount - decorations.length), seed: 395 });
      const rng2 = seededRandom(396);
      for (const s of shellSamples) {
        if (decorations.length >= maxCount) break;
        let nearFormation = false;
        for (const f of formations) {
          const dx = s.x - f.x, dz = s.z - f.z;
          if (dx * dx + dz * dz < f.radius * f.radius) { nearFormation = true; break; }
        }
        if (nearFormation) continue;
        decorations.push({ x: s.x, z: s.z, scale: 0.15 + rng2() * 0.25, rotY: rng2() * Math.PI * 2, type: "shell" as DecoType });
      }
    }

    return { coral, kelp, rocks, boulders, heroRocks, decorations };
  });

  const coralPlacements = $derived(scenePlacements.coral);
  const kelpPlacements = $derived(scenePlacements.kelp);

  const rockPlacements = $derived(scenePlacements.rocks);
  const boulderPlacements = $derived(scenePlacements.boulders);

  type DecoType = "starfish" | "urchin" | "shell" | "anemone";
  interface DecoPlacement extends Placement {
    type: DecoType;
  }
  const decorationPlacements = $derived(scenePlacements.decorations as DecoPlacement[]);

  // ── Sediment Mounding ─────────────────────────────────────────────────
  // $derived so ProceduralSeabed can react to mound changes via prop.
  const moundSources = $derived.by(() => {
    const mounds: MoundSource[] = [];
    for (const p of scenePlacements.heroRocks) {
      mounds.push({ x: p.x, z: p.z, radius: p.scale * 2.0, height: p.scale * 0.35 });
    }
    for (const p of scenePlacements.rocks) {
      if (p.scale < 0.2) continue;
      mounds.push({ x: p.x, z: p.z, radius: p.scale * 1.5, height: p.scale * 0.25 });
    }
    for (const p of scenePlacements.boulders) {
      mounds.push({ x: p.x, z: p.z, radius: p.scale * 1.8, height: p.scale * 0.3 });
    }
    for (const p of scenePlacements.coral) {
      if (p.scale < 0.4) continue;
      mounds.push({ x: p.x, z: p.z, radius: p.scale * 0.8, height: p.scale * 0.12 });
    }
    return mounds;
  });

  $effect(() => {
    setMoundSources(moundSources);
  });

  // ── Reef SDF data (passed from ReefStructures → FishSchool) ────────
  let reefSdfData = $state<ReefSDFData | null>(null);

  // y=-999 keeps scatter origin off-screen until Mouse Scatter spec wires real intersection coords
  let rayPosition = $state(new Vector3(0, -999, 0));

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

  // ── GLB Rock Models (Meshy-generated hero rocks) ───────────────────

  const rockGlbModels = $derived(
    [$rockGlb0, $rockGlb1, $rockGlb2, $rockGlb3, $rockGlb4, $rockGlb5].filter(Boolean) as { scene: Object3D }[],
  );
  const hasGlbRocks = $derived(rockGlbModels.length > 0);

  const rockGlbScales = $derived.by((): number[] =>
    rockGlbModels.map((m) => {
      const extent = measureModelExtent(m.scene as Object3D);
      return extent < 0.001 ? 0.001 : 1.0 / extent;
    }),
  );

  const rockGlbBaseOffsets = $derived.by((): number[] =>
    rockGlbModels.map((m) => {
      const raw = -measureModelMinY(m.scene as Object3D);
      return raw * 1.1 + 0.05;
    }),
  );

  interface HeroRockPlacement extends Placement {
    modelIdx: number;
  }

  const heroRockPlacements = $derived(scenePlacements.heroRocks as HeroRockPlacement[]);

  const heroRockClones = $derived.by(() => {
    if (!hasGlbRocks) return [];
    return heroRockPlacements.map((p) => {
      const model = rockGlbModels[p.modelIdx % rockGlbModels.length]!;
      return underwaterClone(model.scene, activeConfig.rocks.tintColor, activeConfig.rocks.tintBlend * 0.5);
    });
  });

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

  const coralInstances = $derived.by((): (InstancedMesh | null)[] => {
    const models = [
      $coralGlb0,
      $coralGlb1,
      $coralGlb2,
      $coralGlb3,
      $coralLargeGlb,
    ].filter(Boolean) as { scene: Object3D }[];
    if (models.length === 0) return [];

    const buckets = new Map<number, ColoredInstancePlacement[]>();

    for (let pi = 0; pi < coralPlacements.length; pi++) {
      const placement = coralPlacements[pi]!;
      const speciesIdx = placement.speciesIdx % models.length;
      if (!buckets.has(speciesIdx)) buckets.set(speciesIdx, []);

      const baseColor = new Color(activeConfig.coral.glowColor);
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);
      hsl.h += placement.hueShift;
      hsl.s = Math.min(1, hsl.s * placement.satBoost);
      hsl.l = Math.max(0.1, Math.min(0.7, hsl.l + (placement.hueShift > 0 ? 0.05 : -0.03)));
      baseColor.setHSL(hsl.h, hsl.s, hsl.l);

      const s = (coralScales[pi] ?? 0.001) * placement.scale;
      const th = getTerrainY(placement.x, placement.z);
      const baseOffset = (coralBaseOffsets[speciesIdx % coralBaseOffsets.length] ?? 0) * s;

      buckets.get(speciesIdx)!.push({
        x: placement.x,
        z: placement.z,
        y: groundY + th + baseOffset,
        scale: s,
        rotY: placement.rotY,
        color: baseColor,
      });
    }

    return models.map((model, idx) => {
      const placements = buckets.get(idx) ?? [];
      return createColoredInstancedMesh(model.scene, placements);
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

  // Instanced rock meshes — one InstancedMesh per variant (6 draw calls instead of 200+)
  const rockInstances = $derived.by((): InstancedMesh[] => {
    if (rockVariants.length === 0 || rockPlacements.length === 0) return [];
    const buckets: Placement[][] = rockVariants.map(() => []);
    for (let i = 0; i < rockPlacements.length; i++) {
      buckets[i % rockVariants.length]!.push(rockPlacements[i]!);
    }
    const m = new ThreeMatrix4();
    const q = new Quaternion();
    const s = new Vector3();
    return rockVariants.map((variant, vi) => {
      const placements = buckets[vi]!;
      const inst = new InstancedMesh(variant.geometry, variant.material, placements.length);
      inst.frustumCulled = false;
      for (let j = 0; j < placements.length; j++) {
        const p = placements[j]!;
        q.setFromEuler(new Euler(0, p.rotY, 0));
        s.setScalar(p.scale);
        const yOffset = variant.bottomOffset * p.scale;
        m.compose(new Vector3(p.x, groundY + getTerrainY(p.x, p.z) + yOffset, p.z), q, s);
        inst.setMatrixAt(j, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      return inst;
    });
  });

  const boulderInstances = $derived.by(() => {
    if (rockVariants.length === 0 || boulderPlacements.length === 0) return [];
    const buckets: Placement[][] = rockVariants.map(() => []);
    for (let i = 0; i < boulderPlacements.length; i++) {
      buckets[i % rockVariants.length]!.push(boulderPlacements[i]!);
    }
    const m = new ThreeMatrix4();
    const q = new Quaternion();
    const s = new Vector3();
    return rockVariants.map((variant, vi) => {
      const placements = buckets[vi]!;
      if (placements.length === 0) return null;
      const mat = variant.material.clone();
      mat.color.lerp(new Color("#3a5068"), 0.25);
      const inst = new InstancedMesh(variant.geometry, mat, placements.length);
      inst.frustumCulled = false;
      for (let j = 0; j < placements.length; j++) {
        const p = placements[j]!;
        q.setFromEuler(new Euler(0, p.rotY, 0));
        s.setScalar(p.scale);
        const yOffset = variant.bottomOffset * p.scale;
        m.compose(new Vector3(p.x, groundY + getTerrainY(p.x, p.z) + yOffset, p.z), q, s);
        inst.setMatrixAt(j, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      return inst;
    }).filter((inst) => inst !== null);
  });

  const kelpInstances = $derived.by((): (InstancedMesh | null)[] => {
    const models = [$seaweedGlb, $kelpPlantGlb].filter(Boolean) as { scene: Object3D }[];
    if (models.length === 0) return [];

    const buckets: InstancePlacement[][] = models.map(() => []);

    for (let i = 0; i < kelpPlacements.length; i++) {
      const p = kelpPlacements[i]!;
      const modelIdx = i % models.length;
      const s = kelpScales[i] ?? 0.001;
      const th = getTerrainY(p.x, p.z);
      const baseOffset = (kelpBaseOffsets[modelIdx % kelpBaseOffsets.length] ?? 0) * p.scale * s;

      buckets[modelIdx]!.push({
        x: p.x,
        z: p.z,
        y: groundY + th + baseOffset,
        scale: p.scale * s,
        rotY: p.rotY,
      });
    }

    return models.map((model, idx) =>
      createInstancedMeshFromModel(model.scene, buckets[idx]!),
    );
  });


  const jellyfishInstances = $derived.by((): { large: InstancedMesh | null; small: InstancedMesh | null } => {
    const large = $jellyfishGlb;
    const small = $jellyfishSmallGlb;
    if (!large) return { large: null, small: null };

    const largePlacements: InstancePlacement[] = [];
    const smallPlacements: InstancePlacement[] = [];

    for (const jf of jellyfishSamples) {
      const placement: InstancePlacement = {
        x: jf.x,
        z: jf.z,
        y: groundY + jf.y,
        scale: jf.isSmall ? jellyfishSmallScale : jellyfishLargeScale,
        rotY: 0,
      };
      if (jf.isSmall && small) {
        smallPlacements.push(placement);
      } else {
        largePlacements.push(placement);
      }
    }

    return {
      large: createInstancedMeshFromModel(large.scene, largePlacements),
      small: small ? createInstancedMeshFromModel(small.scene, smallPlacements) : null,
    };
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
    sceneFeatures.reportProgress("environment", loadingProgress);
    if (allLoaded) sceneFeatures.reportReady("environment");
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[OceanScene] Lifting curtain via timeout");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);

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
    for (const inst of coralInstances) disposeInstancedMesh(inst);
    for (const inst of kelpInstances) disposeInstancedMesh(inst);
    for (const inst of rockInstances) inst.dispose();
    for (const inst of boulderInstances) { (inst.material as any)?.dispose?.(); inst.dispose(); }
    for (const c of heroRockClones) disposeSceneGraph(c);
    disposeInstancedMesh(jellyfishInstances.large);
    disposeInstancedMesh(jellyfishInstances.small);
    for (const c of decorationClones) if (c) disposeSceneGraph(c as Object3D);
  });
</script>

<OceanLoadingScreen progress={loadingProgress} visible={!allLoaded} />

{#if allLoaded}
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
  {moundSources}
/>

<!-- Water surface shimmer -->
{#if activeConfig.waterSurface?.enabled}
  <WaterSurface config={activeConfig.waterSurface} size={activeConfig.ground.size} />
{/if}


<!-- Coral formations (instanced, Poisson-disc placed) -->
{#if activeConfig.coral.enabled}
  {#each coralInstances as inst}
    {#if inst}
      <T is={inst} />
    {/if}
  {/each}
{/if}

<!-- Kelp forest (instanced, Poisson-disc placed) -->
{#if activeConfig.kelp.enabled}
  {#each kelpInstances as inst}
    {#if inst}
      <T is={inst} />
    {/if}
  {/each}
{/if}

<!-- Hero rocks (Meshy GLB models — formation anchors + boulders) -->
{#if activeConfig.rocks.enabled && heroRockClones.length > 0}
  {#each heroRockClones as clone, i}
    {@const p = heroRockPlacements[i]}
    {#if p}
      {@const s = rockGlbScales[p.modelIdx % rockGlbScales.length] ?? 0.001}
      {@const baseOffset = (rockGlbBaseOffsets[p.modelIdx % rockGlbBaseOffsets.length] ?? 0) * p.scale * s}
      <T
        is={clone}
        position.x={p.x}
        position.y={groundY + getTerrainY(p.x, p.z) + baseOffset}
        position.z={p.z}
        scale={p.scale * s}
        rotation.y={p.rotY}
      />
    {/if}
  {/each}
{/if}

<!-- Seabed rocks (instanced procedural — small scatter fill) -->
{#if activeConfig.rocks.enabled}
  {#each rockInstances as inst}
    <T is={inst} />
  {/each}
{/if}

<!-- Background boulders (instanced procedural — fallback when no GLB rocks) -->
{#if activeConfig.rocks.enabled && !hasGlbRocks}
  {#each boulderInstances as inst}
    <T is={inst} />
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
  {#if activeConfig.fish.scatterEnabled}
    <OceanMouseRaycast
      swimHeight={activeConfig.fish.swimHeight}
      groundY={userProportionsState.groundY}
      bind:worldPosition={rayPosition}
    />
  {/if}
  <FishSchool
    targetSize={activeConfig.fish.targetSize}
    swimHeight={activeConfig.fish.swimHeight}
    speed={activeConfig.fish.speed}
    stageRadius={zones.clearingRadius}
    boundRadius={zones.forestOuter}
    currentStrength={activeConfig.fish.currentStrength}
    scatterRadius={activeConfig.fish.scatterRadius}
    scatterForce={activeConfig.fish.scatterForce}
    scatterWaveSpeed={activeConfig.fish.scatterWaveSpeed}
    perceptionAngle={activeConfig.fish.perceptionAngle}
    halfSpeedTime={activeConfig.fish.halfSpeedTime}
    {rayPosition}
    {reefSdfData}
  />
{/if}

<!-- Jellyfish (instanced) -->
{#if activeConfig.jellyfish?.enabled}
  {#if jellyfishInstances.large}
    <T is={jellyfishInstances.large} />
  {/if}
  {#if jellyfishInstances.small}
    <T is={jellyfishInstances.small} />
  {/if}
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

<!-- Reef structures (arch, wall, bommie, tower — Meshy AI generated) -->
<ReefStructures
  stageRadius={zones.stageRadius}
  clearingRadius={zones.clearingRadius}
  tintColor={activeConfig.rocks.tintColor}
  tintBlend={activeConfig.rocks.tintBlend}
  onSdfReady={(data) => { reefSdfData = data; }}
/>

<RuinsPlatform config={activeConfig.platform} />
{/if}
