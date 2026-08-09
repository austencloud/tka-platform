<script lang="ts">
  /**
   * AutumnRuntimeSystems
   *
   * Wiring shell for the Enchanted Autumn Dusk runtime layers. It mounts the
   * dynamic runtime children (lighting, particles, wisps, pond, interaction)
   * and threads quality/ground/pond props through to each.
   *
   * Its one piece of glue: assembling the interaction layer's PulseTarget[].
   * Wisp targets are produced HERE (this composer mounts WillOWisps) and are
   * the only source. See AutumnInteraction's module doc for why the authored
   * mushrooms cannot join them.
   *
   * No per-frame work lives here — it's a declarative wiring shell.
   */

  import type {
    AutumnQualityConfig,
    AutumnQualityTier,
  } from "../quality/autumn-quality";
  import type { Object3D } from "three";
  import type { PulseTarget } from "./interaction/AutumnInteraction.svelte";
  import AutumnLighting from "./lighting/AutumnLighting.svelte";
  import AutumnParticles from "./atmosphere/AutumnParticles.svelte";
  import WillOWisps from "./wisps/WillOWisps.svelte";
  import AutumnPond from "./water/AutumnPond.svelte";
  import AutumnInteraction from "./interaction/AutumnInteraction.svelte";
  import AutumnWind from "./wind/AutumnWind.svelte";

  interface Props {
    quality: AutumnQualityConfig;
    tier: AutumnQualityTier;
    environmentScene?: Object3D | null;
    groundY?: number;
    pondCenter?: [number, number, number];
  }

  let {
    quality,
    tier,
    environmentScene = null,
    groundY = 0,
    pondCenter,
  }: Props = $props();

  // Wisp pulse targets, captured once when WillOWisps emits. baseIntensity is
  // the material's resting emissiveIntensity at emit time — the value the glow
  // decays back to. The position is the wisp Group's live (mutated) Vector3.
  let wispTargets = $state<PulseTarget[]>([]);
</script>

<!-- Authored grass stays rooted while its tips share one deterministic shader
     clock. The quality tier reveals cumulative Blender-authored density. -->
<AutumnWind scene={environmentScene} {tier} />

<!-- Moon-aligned dusk light rig -->
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

<!-- Static dusk pond; pondCenter drives its world position when provided -->
<AutumnPond {quality} {groundY} position={pondCenter} />

<!-- Premium differentiator: proximity glow on the drifting wisps -->
<AutumnInteraction targets={wispTargets} {groundY} />
