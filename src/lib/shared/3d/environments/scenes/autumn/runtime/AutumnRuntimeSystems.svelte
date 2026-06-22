<script lang="ts">
  /**
   * AutumnRuntimeSystems
   *
   * Wiring shell for the Enchanted Autumn Dusk runtime layers — mirrors
   * ocean/runtime/OceanRuntimeSystems.svelte. It mounts the dynamic runtime
   * children (lighting, particles, wisps, pond, god rays, interaction) and
   * threads quality/ground/pond props through to each.
   *
   * Its one piece of glue: assembling the interaction layer's PulseTarget[].
   * Wisp targets are produced HERE (this composer mounts WillOWisps). Mushroom
   * targets arrive as a PROP from the orchestrator (Task 13), which mounts the
   * authored flora and pairs each cloned emissive material with its placement
   * position. The two lists are concatenated and passed to AutumnInteraction.
   *
   * No per-frame work lives here — it's a declarative wiring shell.
   */

  import type { AutumnQualityConfig } from "../quality/autumn-quality";
  import type { PulseTarget } from "./interaction/AutumnInteraction.svelte";
  import AutumnLighting from "./lighting/AutumnLighting.svelte";
  import AutumnParticles from "./atmosphere/AutumnParticles.svelte";
  import WillOWisps from "./wisps/WillOWisps.svelte";
  import AutumnPond from "./water/AutumnPond.svelte";
  import GodRayShafts from "./atmosphere/GodRayShafts.svelte";
  import AutumnInteraction from "./interaction/AutumnInteraction.svelte";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    pondCenter?: [number, number, number];
    /** Pulse targets for the authored mushrooms, paired by the orchestrator. */
    mushroomTargets?: PulseTarget[];
  }

  let {
    quality,
    groundY = 0,
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    pondCenter,
    mushroomTargets,
  }: Props = $props();

  // Wisp pulse targets, captured once when WillOWisps emits. baseIntensity is
  // the material's resting emissiveIntensity at emit time — the value the glow
  // decays back to. The position is the wisp Group's live (mutated) Vector3.
  let wispTargets = $state<PulseTarget[]>([]);

  // Combined targets: mushrooms (orchestrator prop) + wisps (assembled here).
  const allTargets = $derived([...(mushroomTargets ?? []), ...wispTargets]);
</script>

<!-- Warm/cool dusk light rig -->
<AutumnLighting {quality} {groundY} />

<!-- Leaves + spores + fireflies; fireflies cluster on the pond center -->
<AutumnParticles {quality} {groundY} {pondCenter} />

<!-- Drifting will-o-wisps. Emits pulse targets (live position + core material);
     baseIntensity captured here from the material's resting emissiveIntensity. -->
<WillOWisps
  {quality}
  {groundY}
  onWispTargets={(targets) =>
    (wispTargets = targets.map((t) => ({
      material: t.material,
      position: t.position,
      baseIntensity: t.material.emissiveIntensity,
    })))}
/>

<!-- Still mirror pond; pondCenter drives its world position when provided -->
<AutumnPond {quality} {groundY} position={pondCenter} />

<!-- Warm volumetric shafts (high/medium tiers only) -->
{#if quality.godRays}
  <GodRayShafts />
{/if}

<!-- Premium differentiator: proximity glow on wisps + mushrooms -->
<AutumnInteraction targets={allTargets} {groundY} />
