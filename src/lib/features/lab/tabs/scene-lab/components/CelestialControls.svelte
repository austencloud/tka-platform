<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.celestialConfig);
  function mut() { return state.celestialConfig; }
</script>

<ParamPanel title="Sky">
  <ParamColor label="Top" value={cfg.sky.topColor} onChange={(v) => (mut().sky.topColor = v)} />
  <ParamColor label="Mid" value={cfg.sky.midColor ?? "#000000"} onChange={(v) => (mut().sky.midColor = v)} />
  <ParamColor label="Bottom" value={cfg.sky.bottomColor} onChange={(v) => (mut().sky.bottomColor = v)} />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor label="Color" value={cfg.fog.color} onChange={(v) => (mut().fog.color = v)} />
  <ParamSlider label="Density" value={cfg.fog.density} min={0} max={0.1} step={0.001} onChange={(v) => (mut().fog.density = v)} />
</ParamPanel>

<ParamPanel title="Ground">
  <ParamColor label="Color" value={cfg.ground.color} onChange={(v) => (mut().ground.color = v)} />
  <ParamSlider label="Size" value={cfg.ground.size} min={10} max={100} step={5} unit="m" onChange={(v) => (mut().ground.size = v)} />
</ParamPanel>

<ParamPanel title="Cloud dome" enabled={cfg.cloudDome.enabled} onToggle={(v) => (mut().cloudDome.enabled = v)}>
  <ParamSlider label="Density" value={cfg.cloudDome.density} min={0} max={2} step={0.05} onChange={(v) => (mut().cloudDome.density = v)} />
  <ParamSlider label="Coverage" value={cfg.cloudDome.coverage} min={0} max={1} step={0.01} onChange={(v) => (mut().cloudDome.coverage = v)} />
  <ParamSlider label="Drift speed" value={cfg.cloudDome.driftSpeed} min={0} max={0.2} step={0.005} onChange={(v) => (mut().cloudDome.driftSpeed = v)} />
  <ParamSlider label="Opacity" value={cfg.cloudDome.opacity} min={0} max={1} step={0.01} onChange={(v) => (mut().cloudDome.opacity = v)} />
  <ParamColor label="Lit color" value={cfg.cloudDome.litColor} onChange={(v) => (mut().cloudDome.litColor = v)} />
  <ParamColor label="Shadow color" value={cfg.cloudDome.shadowColor} onChange={(v) => (mut().cloudDome.shadowColor = v)} />
</ParamPanel>

<ParamPanel title="God rays" defaultOpen={false} enabled={cfg.godRays.enabled} onToggle={(v) => (mut().godRays.enabled = v)}>
  <ParamColor label="Color" value={cfg.godRays.color} onChange={(v) => (mut().godRays.color = v)} />
  <ParamSlider label="Intensity" value={cfg.godRays.intensity} min={0} max={2} step={0.05} onChange={(v) => (mut().godRays.intensity = v)} />
  <ParamSlider label="Count" value={cfg.godRays.count} min={1} max={20} step={1} onChange={(v) => (mut().godRays.count = v)} />
  <ParamSlider label="Speed" value={cfg.godRays.speed} min={0} max={0.1} step={0.002} onChange={(v) => (mut().godRays.speed = v)} />
</ParamPanel>

<ParamPanel title="Cloud platform" defaultOpen={false} enabled={cfg.cloudPlatform.enabled} onToggle={(v) => (mut().cloudPlatform.enabled = v)}>
  <ParamSlider label="Radius" value={cfg.cloudPlatform.radius} min={2} max={20} step={0.5} unit="m" onChange={(v) => (mut().cloudPlatform.radius = v)} />
  <ParamColor label="Glow color" value={cfg.cloudPlatform.glowColor} onChange={(v) => (mut().cloudPlatform.glowColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.cloudPlatform.glowIntensity} min={0} max={3} step={0.05} onChange={(v) => (mut().cloudPlatform.glowIntensity = v)} />
  <ParamSlider label="Noise scale" value={cfg.cloudPlatform.noiseScale} min={0.5} max={5} step={0.25} onChange={(v) => (mut().cloudPlatform.noiseScale = v)} />
  <ParamSlider label="Drift speed" value={cfg.cloudPlatform.driftSpeed} min={0} max={0.1} step={0.002} onChange={(v) => (mut().cloudPlatform.driftSpeed = v)} />
</ParamPanel>

<ParamPanel title="Cloud islands" defaultOpen={false} enabled={cfg.cloudIslands.enabled} onToggle={(v) => (mut().cloudIslands.enabled = v)}>
  <ParamSlider label="Count" value={cfg.cloudIslands.count} min={0} max={20} step={1} onChange={(v) => (mut().cloudIslands.count = v)} />
  <ParamSlider label="Drift speed" value={cfg.cloudIslands.driftSpeed} min={0} max={1} step={0.02} onChange={(v) => (mut().cloudIslands.driftSpeed = v)} />
  <ParamSlider label="Bob speed" value={cfg.cloudIslands.bobSpeed} min={0} max={2} step={0.05} onChange={(v) => (mut().cloudIslands.bobSpeed = v)} />
  <ParamSlider label="Min height" value={cfg.cloudIslands.heightRange[0]} min={1} max={15} step={0.5} unit="m" onChange={(v) => (mut().cloudIslands.heightRange[0] = v)} />
  <ParamSlider label="Max height" value={cfg.cloudIslands.heightRange[1]} min={2} max={25} step={0.5} unit="m" onChange={(v) => (mut().cloudIslands.heightRange[1] = v)} />
  <ParamSlider label="Spawn radius" value={cfg.cloudIslands.spawnRadius} min={5} max={40} step={1} unit="m" onChange={(v) => (mut().cloudIslands.spawnRadius = v)} />
  <ParamSlider label="Min size" value={cfg.cloudIslands.sizeRange[0]} min={0.5} max={5} step={0.25} unit="m" onChange={(v) => (mut().cloudIslands.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.cloudIslands.sizeRange[1]} min={1} max={10} step={0.25} unit="m" onChange={(v) => (mut().cloudIslands.sizeRange[1] = v)} />
  <ParamColor label="Color" value={cfg.cloudIslands.color} onChange={(v) => (mut().cloudIslands.color = v)} />
</ParamPanel>

<ParamPanel title="Celestial pillars" defaultOpen={false} enabled={cfg.celestialPillars.enabled} onToggle={(v) => (mut().celestialPillars.enabled = v)}>
  <ParamSlider label="Clearing radius" value={cfg.celestialPillars.clearingRadius} min={4} max={25} step={0.5} unit="m" onChange={(v) => (mut().celestialPillars.clearingRadius = v)} />
  <ParamColor label="Base color" value={cfg.celestialPillars.baseColor} onChange={(v) => (mut().celestialPillars.baseColor = v)} />
  <ParamColor label="Glow color" value={cfg.celestialPillars.glowColor} onChange={(v) => (mut().celestialPillars.glowColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.celestialPillars.glowIntensity} min={0} max={3} step={0.05} onChange={(v) => (mut().celestialPillars.glowIntensity = v)} />
  <ParamSlider label="Min height" value={cfg.celestialPillars.heightRange[0]} min={0.5} max={5} step={0.25} unit="m" onChange={(v) => (mut().celestialPillars.heightRange[0] = v)} />
  <ParamSlider label="Max height" value={cfg.celestialPillars.heightRange[1]} min={1} max={12} step={0.25} unit="m" onChange={(v) => (mut().celestialPillars.heightRange[1] = v)} />
  {#each cfg.celestialPillars.rings as _, i}
    <div class="ring-group">
      <div class="ring-label">Ring {i + 1}</div>
      <ParamSlider label="Radius" value={cfg.celestialPillars.rings[i]!.radius} min={4} max={30} step={0.5} unit="m" onChange={(v) => (mut().celestialPillars.rings[i]!.radius = v)} />
      <ParamSlider label="Count" value={cfg.celestialPillars.rings[i]!.count} min={0} max={30} step={1} onChange={(v) => (mut().celestialPillars.rings[i]!.count = v)} />
      <ParamSlider label="Scale base" value={cfg.celestialPillars.rings[i]!.scaleBase} min={0.3} max={2.5} step={0.05} onChange={(v) => (mut().celestialPillars.rings[i]!.scaleBase = v)} />
    </div>
  {/each}
</ParamPanel>

<ParamPanel title="Motes" defaultOpen={false}>
  <ParamSlider label="Count" value={cfg.motes.count} min={0} max={300} step={5} onChange={(v) => (mut().motes.count = v)} />
  <ParamSlider label="Speed" value={cfg.motes.speed} min={0} max={0.05} step={0.001} onChange={(v) => (mut().motes.speed = v)} />
  <ParamSlider label="Min size" value={cfg.motes.sizeRange[0]} min={0.01} max={0.3} step={0.005} unit="m" onChange={(v) => (mut().motes.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.motes.sizeRange[1]} min={0.02} max={0.5} step={0.005} unit="m" onChange={(v) => (mut().motes.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.motes.area.width} min={5} max={30} step={1} unit="m" onChange={(v) => (mut().motes.area.width = v)} />
  {#each cfg.motes.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.motes.colors[i]!} onChange={(v) => (mut().motes.colors[i] = v)} />
  {/each}
</ParamPanel>

{#if cfg.wisps}
  <ParamPanel title="Wisps" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.wisps.count} min={0} max={200} step={5} onChange={(v) => { if (mut().wisps) mut().wisps!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.wisps.speed} min={0} max={0.1} step={0.002} onChange={(v) => { if (mut().wisps) mut().wisps!.speed = v; }} />
    <ParamSlider label="Min size" value={cfg.wisps.sizeRange[0]} min={0.05} max={0.5} step={0.01} unit="m" onChange={(v) => { if (mut().wisps) mut().wisps!.sizeRange[0] = v; }} />
    <ParamSlider label="Max size" value={cfg.wisps.sizeRange[1]} min={0.1} max={1} step={0.01} unit="m" onChange={(v) => { if (mut().wisps) mut().wisps!.sizeRange[1] = v; }} />
    <ParamSlider label="Area width" value={cfg.wisps.area.width} min={5} max={40} step={1} unit="m" onChange={(v) => { if (mut().wisps) mut().wisps!.area.width = v; }} />
    {#each cfg.wisps.colors as _, i}
      <ParamColor label={`Color ${i + 1}`} value={cfg.wisps.colors[i]!} onChange={(v) => { if (mut().wisps) mut().wisps!.colors[i] = v; }} />
    {/each}
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mut().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mut().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().hemisphereLight.intensity = v)} />
</ParamPanel>

{#if cfg.sunLight}
  <ParamPanel title="Sun light" defaultOpen={false} enabled={cfg.sunLight.enabled} onToggle={(v) => { if (mut().sunLight) mut().sunLight!.enabled = v; }}>
    <ParamColor label="Color" value={cfg.sunLight.color} onChange={(v) => { if (mut().sunLight) mut().sunLight!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.sunLight.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().sunLight) mut().sunLight!.intensity = v; }} />
  </ParamPanel>
{/if}

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
