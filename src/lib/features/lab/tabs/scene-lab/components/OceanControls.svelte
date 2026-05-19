<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();

  const OCEAN_CONFIGS = {
    "ocean-abyss": () => state.oceanAbyssConfig,
    "ocean-reef": () => state.oceanReefConfig,
    "ocean-mystical": () => state.oceanMysticalConfig,
    "ocean-cinematic": () => state.oceanCinematicConfig,
  } as const;

  const cfg = $derived(
    (OCEAN_CONFIGS[state.sceneId as keyof typeof OCEAN_CONFIGS] ?? OCEAN_CONFIGS["ocean-abyss"])()
  );

  function mutate() {
    return (OCEAN_CONFIGS[state.sceneId as keyof typeof OCEAN_CONFIGS] ?? OCEAN_CONFIGS["ocean-abyss"])();
  }
</script>

<ParamPanel title="Sky">
  <ParamColor label="Top" value={cfg.sky.topColor} onChange={(v) => (mutate().sky.topColor = v)} />
  <ParamColor label="Mid" value={cfg.sky.midColor ?? "#000000"} onChange={(v) => (mutate().sky.midColor = v)} />
  <ParamColor label="Bottom" value={cfg.sky.bottomColor} onChange={(v) => (mutate().sky.bottomColor = v)} />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor label="Color" value={cfg.fog.color} onChange={(v) => (mutate().fog.color = v)} />
  <ParamSlider label="Density" value={cfg.fog.density} min={0} max={0.1} step={0.001} onChange={(v) => (mutate().fog.density = v)} />
</ParamPanel>

<ParamPanel title="Ground">
  <ParamColor label="Color" value={cfg.ground.color} onChange={(v) => (mutate().ground.color = v)} />
  <ParamSlider label="Size" value={cfg.ground.size} min={10} max={100} step={5} unit="m" onChange={(v) => (mutate().ground.size = v)} />
  <ParamSlider label="Normal scale" value={cfg.ground.normalScale ?? 1} min={0} max={3} step={0.1} onChange={(v) => (mutate().ground.normalScale = v)} />
  <ParamSlider label="Texture repeat" value={cfg.ground.textureRepeat ?? 8} min={4} max={60} step={1} onChange={(v) => (mutate().ground.textureRepeat = v)} />
</ParamPanel>

<ParamPanel title="Coral">
  <ParamSlider label="Enabled" value={cfg.coral.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mutate().coral.enabled = v > 0.5)} />
  <ParamSlider label="Count" value={cfg.coral.count} min={0} max={30} step={1} onChange={(v) => (mutate().coral.count = v)} />
  <ParamSlider label="Clearing radius" value={cfg.coral.clearingRadius} min={5} max={25} step={0.5} unit="m" onChange={(v) => (mutate().coral.clearingRadius = v)} />
  <ParamColor label="Glow color" value={cfg.coral.glowColor} onChange={(v) => (mutate().coral.glowColor = v)} />
  <ParamSlider label="Glow blend" value={cfg.coral.glowBlend} min={0} max={1} step={0.01} onChange={(v) => (mutate().coral.glowBlend = v)} />
</ParamPanel>

<ParamPanel title="Kelp forest" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.kelp.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mutate().kelp.enabled = v > 0.5)} />
  <ParamSlider label="Sway speed" value={cfg.kelp.swaySpeed} min={0} max={3} step={0.1} onChange={(v) => (mutate().kelp.swaySpeed = v)} />
  <ParamSlider label="Sway amplitude" value={cfg.kelp.swayAmplitude} min={0} max={0.5} step={0.01} unit="rad" onChange={(v) => (mutate().kelp.swayAmplitude = v)} />
  <ParamSlider label="Clearing radius" value={cfg.kelp.clearingRadius} min={5} max={25} step={0.5} unit="m" onChange={(v) => (mutate().kelp.clearingRadius = v)} />
  {#each cfg.kelp.rings as _, i}
    <div class="ring-group">
      <div class="ring-label">Ring {i + 1}</div>
      <ParamSlider label="Radius" value={cfg.kelp.rings[i]!.radius} min={8} max={40} step={0.5} unit="m" onChange={(v) => (mutate().kelp.rings[i]!.radius = v)} />
      <ParamSlider label="Count" value={cfg.kelp.rings[i]!.count} min={0} max={50} step={1} onChange={(v) => (mutate().kelp.rings[i]!.count = v)} />
      <ParamSlider label="Scale base" value={cfg.kelp.rings[i]!.scaleBase} min={0.3} max={2.5} step={0.05} onChange={(v) => (mutate().kelp.rings[i]!.scaleBase = v)} />
    </div>
  {/each}
</ParamPanel>

<ParamPanel title="Fish" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.fish.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mutate().fish.enabled = v > 0.5)} />
  <ParamSlider label="Count" value={cfg.fish.count} min={0} max={30} step={1} onChange={(v) => (mutate().fish.count = v)} />
  <ParamSlider label="Target size" value={cfg.fish.targetSize} min={0.05} max={1} step={0.01} unit="m" onChange={(v) => (mutate().fish.targetSize = v)} />
  <ParamSlider label="Min radius" value={cfg.fish.swimRadius[0]} min={2} max={20} step={0.5} unit="m" onChange={(v) => (mutate().fish.swimRadius[0] = v)} />
  <ParamSlider label="Max radius" value={cfg.fish.swimRadius[1]} min={4} max={30} step={0.5} unit="m" onChange={(v) => (mutate().fish.swimRadius[1] = v)} />
  <ParamSlider label="Min height" value={cfg.fish.swimHeight[0]} min={0.5} max={8} step={0.25} unit="m" onChange={(v) => (mutate().fish.swimHeight[0] = v)} />
  <ParamSlider label="Max height" value={cfg.fish.swimHeight[1]} min={1} max={12} step={0.25} unit="m" onChange={(v) => (mutate().fish.swimHeight[1] = v)} />
  <ParamSlider label="Min speed" value={cfg.fish.speed[0]} min={0.05} max={2} step={0.05} onChange={(v) => (mutate().fish.speed[0] = v)} />
  <ParamSlider label="Max speed" value={cfg.fish.speed[1]} min={0.1} max={3} step={0.05} onChange={(v) => (mutate().fish.speed[1] = v)} />
</ParamPanel>

<ParamPanel title="Decorations" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.decorations.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mutate().decorations.enabled = v > 0.5)} />
  <ParamSlider label="Count" value={cfg.decorations.count} min={0} max={24} step={1} onChange={(v) => (mutate().decorations.count = v)} />
  <ParamSlider label="Target size" value={cfg.decorations.targetSize} min={0.05} max={1} step={0.01} unit="m" onChange={(v) => (mutate().decorations.targetSize = v)} />
</ParamPanel>

<ParamPanel title="Rocks" defaultOpen={false}>
  <ParamSlider label="Count" value={cfg.rockCount} min={0} max={20} step={1} onChange={(v) => (mutate().rockCount = v)} />
  <ParamColor label="Tint color" value={cfg.rockTintColor} onChange={(v) => (mutate().rockTintColor = v)} />
  <ParamSlider label="Tint blend" value={cfg.rockTintBlend} min={0} max={1} step={0.01} onChange={(v) => (mutate().rockTintBlend = v)} />
</ParamPanel>

<ParamPanel title="Bubbles">
  <ParamSlider label="Count" value={cfg.bubbles.count} min={0} max={500} step={10} onChange={(v) => (mutate().bubbles.count = v)} />
  <ParamSlider label="Speed" value={cfg.bubbles.speed} min={0} max={0.5} step={0.005} unit="m/s" onChange={(v) => (mutate().bubbles.speed = v)} />
  <ParamSlider label="Min size" value={cfg.bubbles.sizeRange[0]} min={0.01} max={0.2} step={0.005} unit="m" onChange={(v) => (mutate().bubbles.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.bubbles.sizeRange[1]} min={0.02} max={0.3} step={0.005} unit="m" onChange={(v) => (mutate().bubbles.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.bubbles.area.width} min={2} max={30} step={1} unit="m" onChange={(v) => (mutate().bubbles.area.width = v)} />
  {#each cfg.bubbles.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.bubbles.colors[i]!} onChange={(v) => (mutate().bubbles.colors[i] = v)} />
  {/each}
</ParamPanel>

{#if cfg.dust}
  <ParamPanel title="Dust motes" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.dust.count} min={0} max={500} step={10} onChange={(v) => { if (mutate().dust) mutate().dust!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.dust.speed} min={0} max={0.1} step={0.001} onChange={(v) => { if (mutate().dust) mutate().dust!.speed = v; }} />
    <ParamSlider label="Area width" value={cfg.dust.area.width} min={2} max={30} step={1} unit="m" onChange={(v) => { if (mutate().dust) mutate().dust!.area.width = v; }} />
  </ParamPanel>
{/if}

{#if cfg.plankton}
  <ParamPanel title="Bioluminescent plankton" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.plankton.count} min={0} max={200} step={5} onChange={(v) => { if (mutate().plankton) mutate().plankton!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.plankton.speed} min={0} max={0.05} step={0.001} onChange={(v) => { if (mutate().plankton) mutate().plankton!.speed = v; }} />
    {#each cfg.plankton.colors as _, i}
      <ParamColor label={`Color ${i + 1}`} value={cfg.plankton.colors[i]!} onChange={(v) => { if (mutate().plankton) mutate().plankton!.colors[i] = v; }} />
    {/each}
  </ParamPanel>
{/if}

{#if cfg.jellyfish}
  <ParamPanel title="Jellyfish" defaultOpen={false}>
    <ParamSlider label="Enabled" value={cfg.jellyfish.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.enabled = v > 0.5; }} />
    <ParamSlider label="Count" value={cfg.jellyfish.count} min={0} max={8} step={1} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.count = v; }} />
    <ParamColor label="Glow color" value={cfg.jellyfish.glowColor} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.glowColor = v; }} />
    <ParamSlider label="Drift speed" value={cfg.jellyfish.driftSpeed} min={0} max={2} step={0.05} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.driftSpeed = v; }} />
    <ParamSlider label="Pulse rate" value={cfg.jellyfish.pulseRate} min={0} max={2} step={0.05} unit="Hz" onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.pulseRate = v; }} />
    <ParamSlider label="Light intensity" value={cfg.jellyfish.lightIntensity} min={0} max={30} step={1} onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.lightIntensity = v; }} />
    <ParamSlider label="Light distance" value={cfg.jellyfish.lightDistance} min={1} max={20} step={0.5} unit="m" onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.lightDistance = v; }} />
    <ParamSlider label="Spawn radius" value={cfg.jellyfish.spawnRadius} min={3} max={20} step={0.5} unit="m" onChange={(v) => { if (mutate().jellyfish) mutate().jellyfish!.spawnRadius = v; }} />
  </ParamPanel>
{/if}

{#if cfg.caustics}
  <ParamPanel title="Caustic ripples" defaultOpen={false}>
    <ParamSlider label="Enabled" value={cfg.caustics.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (mutate().caustics) mutate().caustics!.enabled = v > 0.5; }} />
    <ParamSlider label="Intensity" value={cfg.caustics.intensity} min={0} max={1} step={0.01} onChange={(v) => { if (mutate().caustics) mutate().caustics!.intensity = v; }} />
    <ParamSlider label="Speed" value={cfg.caustics.speed} min={0} max={0.1} step={0.002} onChange={(v) => { if (mutate().caustics) mutate().caustics!.speed = v; }} />
    <ParamSlider label="Scale" value={cfg.caustics.scale} min={1} max={10} step={0.5} onChange={(v) => { if (mutate().caustics) mutate().caustics!.scale = v; }} />
    <ParamColor label="Color" value={cfg.caustics.color} onChange={(v) => { if (mutate().caustics) mutate().caustics!.color = v; }} />
  </ParamPanel>
{/if}

{#if cfg.godRays}
  <ParamPanel title="God rays" defaultOpen={false}>
    <ParamSlider label="Enabled" value={cfg.godRays.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { if (mutate().godRays) mutate().godRays!.enabled = v > 0.5; }} />
    <ParamColor label="Color" value={cfg.godRays.color} onChange={(v) => { if (mutate().godRays) mutate().godRays!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.godRays.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mutate().godRays) mutate().godRays!.intensity = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mutate().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mutate().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mutate().hemisphereLight.intensity = v)} />
</ParamPanel>

<style>
  .ring-group {
    margin: 4px 0 8px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.02);
    border-left: 2px solid var(--theme-accent, #38bdf8);
    border-radius: 4px;
  }

  .ring-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin-bottom: 4px;
  }
</style>
