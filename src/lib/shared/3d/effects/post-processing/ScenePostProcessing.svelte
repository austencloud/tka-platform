<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import { EffectComposer } from "threlte-postprocessing";
  import { GodRaysEffect as GodRaysEffectComponent } from "threlte-postprocessing/effects";
  import { T } from "@threlte/core";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import WaterAbsorption from "./ocean/WaterAbsorption.svelte";
  import UnderwaterDistortion from "./ocean/UnderwaterDistortion.svelte";
  import RefractionCaustics from "./ocean/RefractionCaustics.svelte";
  import type { OceanVariant } from "../../environments/domain/enums/environment-enums";
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { Vector3, type Mesh } from "three";
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const viewer3DState = getViewer3DContext();

  const backgroundType = $derived.by((): BackgroundType => {
    try {
      return (settingsService as any)?.settings?.backgroundType ?? BackgroundType.SOLID_COLOR;
    } catch { return BackgroundType.SOLID_COLOR; }
  });

  const oceanVariant = $derived<OceanVariant>(viewer3DState.oceanVariant ?? "abyss");
  const isOcean = $derived(backgroundType === BackgroundType.DEEP_OCEAN);

  let sunMesh = $state<Mesh | undefined>(undefined);

  const ABSORPTION_CONFIGS: Record<OceanVariant, { r: number; g: number; b: number; scatter: Vector3; maxDepth: number }> = {
    abyss: { r: 0.55, g: 0.08, b: 0.02, scatter: new Vector3(0.0, 0.02, 0.06), maxDepth: 60 },
    reef: { r: 0.30, g: 0.05, b: 0.01, scatter: new Vector3(0.0, 0.06, 0.08), maxDepth: 40 },
    mystical: { r: 0.40, g: 0.04, b: 0.03, scatter: new Vector3(0.03, 0.02, 0.08), maxDepth: 50 },
    cinematic: { r: 0.35, g: 0.06, b: 0.015, scatter: new Vector3(0.01, 0.04, 0.07), maxDepth: 55 },
  };

  const DISTORTION_CONFIGS: Record<OceanVariant, { strength: number; frequency: number; speed: number }> = {
    abyss: { strength: 0.002, frequency: 10.0, speed: 0.6 },
    reef: { strength: 0.004, frequency: 14.0, speed: 1.0 },
    mystical: { strength: 0.003, frequency: 8.0, speed: 0.5 },
    cinematic: { strength: 0.0015, frequency: 12.0, speed: 0.7 },
  };

  const CAUSTICS_CONFIGS: Record<OceanVariant, { scale: number; speed: number; intensity: number; chromaticSpread: number }> = {
    abyss: { scale: 6.0, speed: 0.3, intensity: 0.08, chromaticSpread: 0.03 },
    reef: { scale: 10.0, speed: 0.5, intensity: 0.20, chromaticSpread: 0.05 },
    mystical: { scale: 7.0, speed: 0.35, intensity: 0.12, chromaticSpread: 0.06 },
    cinematic: { scale: 9.0, speed: 0.4, intensity: 0.15, chromaticSpread: 0.04 },
  };

  const GOD_RAY_CONFIGS: Record<OceanVariant, { samples: number; density: number; decay: number; weight: number; exposure: number; color: string }> = {
    abyss: { samples: 60, density: 0.96, decay: 0.93, weight: 0.4, exposure: 0.6, color: "#1a3a5c" },
    reef: { samples: 60, density: 0.97, decay: 0.94, weight: 0.5, exposure: 0.8, color: "#3a8ab0" },
    mystical: { samples: 60, density: 0.95, decay: 0.92, weight: 0.35, exposure: 0.5, color: "#2a4a6a" },
    cinematic: { samples: 60, density: 0.96, decay: 0.93, weight: 0.45, exposure: 0.7, color: "#2a5a80" },
  };

  const absorption = $derived(ABSORPTION_CONFIGS[oceanVariant]);
  const distortion = $derived(DISTORTION_CONFIGS[oceanVariant]);
  const caustics = $derived(CAUSTICS_CONFIGS[oceanVariant]);
  const godRays = $derived(GOD_RAY_CONFIGS[oceanVariant]);
</script>

{#if isOcean}
  <!-- Sun disc for god ray light source -->
  <T.Mesh
    bind:ref={sunMesh}
    position={[2, 15, -3]}
  >
    <T.SphereGeometry args={[0.5, 16, 16]} />
    <T.MeshBasicMaterial color={godRays.color} transparent opacity={0.8} />
  </T.Mesh>

  <EffectComposer>
    {@render children()}
    <WaterAbsorption
      absorptionR={absorption.r}
      absorptionG={absorption.g}
      absorptionB={absorption.b}
      scatterColor={absorption.scatter}
      maxDepth={absorption.maxDepth}
    />
    <UnderwaterDistortion
      strength={distortion.strength}
      frequency={distortion.frequency}
      speed={distortion.speed}
    />
    {#if sunMesh}
      <GodRaysEffectComponent
        sun={sunMesh}
        samples={godRays.samples}
        density={godRays.density}
        decay={godRays.decay}
        weight={godRays.weight}
        exposure={godRays.exposure}
        resolutionScale={0.5}
        blur
      />
    {/if}
    <RefractionCaustics
      scale={caustics.scale}
      speed={caustics.speed}
      intensity={caustics.intensity}
      chromaticSpread={caustics.chromaticSpread}
    />
  </EffectComposer>
{:else}
  {@render children()}
{/if}
