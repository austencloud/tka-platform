<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.emberConfig);
  function mut() { return state.emberConfig; }
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

<ParamPanel title="Lava cracks" enabled={cfg.lavaCracks.enabled} onToggle={(v) => (mut().lavaCracks.enabled = v)}>
  <ParamColor label="Crack color" value={cfg.lavaCracks.crackColor} onChange={(v) => (mut().lavaCracks.crackColor = v)} />
  <ParamSlider label="Intensity" value={cfg.lavaCracks.intensity} min={0} max={1} step={0.01} onChange={(v) => (mut().lavaCracks.intensity = v)} />
  <ParamSlider label="Speed" value={cfg.lavaCracks.speed} min={0} max={0.1} step={0.001} onChange={(v) => (mut().lavaCracks.speed = v)} />
  <ParamSlider label="Scale" value={cfg.lavaCracks.scale} min={0.5} max={10} step={0.25} onChange={(v) => (mut().lavaCracks.scale = v)} />
  <ParamSlider label="Pulse speed" value={cfg.lavaCracks.pulseSpeed} min={0} max={2} step={0.05} onChange={(v) => (mut().lavaCracks.pulseSpeed = v)} />
  <ParamSlider label="Pulse intensity" value={cfg.lavaCracks.pulseIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().lavaCracks.pulseIntensity = v)} />
</ParamPanel>

<ParamPanel title="Lava pool" defaultOpen={false} enabled={cfg.lavaPool.enabled} onToggle={(v) => (mut().lavaPool.enabled = v)}>
  <ParamSlider label="Pos X" value={cfg.lavaPool.position.x} min={-20} max={20} step={0.25} unit="m" onChange={(v) => (mut().lavaPool.position.x = v)} />
  <ParamSlider label="Pos Z" value={cfg.lavaPool.position.z} min={-20} max={20} step={0.25} unit="m" onChange={(v) => (mut().lavaPool.position.z = v)} />
  <ParamSlider label="Radius" value={cfg.lavaPool.radius} min={1} max={15} step={0.25} unit="m" onChange={(v) => (mut().lavaPool.radius = v)} />
  <ParamColor label="Base color" value={cfg.lavaPool.baseColor} onChange={(v) => (mut().lavaPool.baseColor = v)} />
  <ParamColor label="Hot color" value={cfg.lavaPool.hotColor} onChange={(v) => (mut().lavaPool.hotColor = v)} />
  <ParamColor label="Crust color" value={cfg.lavaPool.crustColor} onChange={(v) => (mut().lavaPool.crustColor = v)} />
  <ParamSlider label="Flow speed" value={cfg.lavaPool.flowSpeed} min={0} max={0.5} step={0.01} onChange={(v) => (mut().lavaPool.flowSpeed = v)} />
  <ParamSlider label="Light intensity" value={cfg.lavaPool.lightIntensity} min={0} max={150} step={1} onChange={(v) => (mut().lavaPool.lightIntensity = v)} />
  <ParamSlider label="Light distance" value={cfg.lavaPool.lightDistance} min={1} max={40} step={0.5} unit="m" onChange={(v) => (mut().lavaPool.lightDistance = v)} />
  <ParamSlider label="Pulse speed" value={cfg.lavaPool.pulseSpeed} min={0} max={2} step={0.05} onChange={(v) => (mut().lavaPool.pulseSpeed = v)} />
  <ParamSlider label="Warp intensity" value={cfg.lavaPool.warpIntensity} min={0} max={10} step={0.25} onChange={(v) => (mut().lavaPool.warpIntensity = v)} />
</ParamPanel>

<ParamPanel title="Obsidian pillars" defaultOpen={false} enabled={cfg.obsidianPillars.enabled} onToggle={(v) => (mut().obsidianPillars.enabled = v)}>
  <ParamSlider label="Clearing radius" value={cfg.obsidianPillars.clearingRadius} min={4} max={25} step={0.5} unit="m" onChange={(v) => (mut().obsidianPillars.clearingRadius = v)} />
  <ParamColor label="Base color" value={cfg.obsidianPillars.baseColor} onChange={(v) => (mut().obsidianPillars.baseColor = v)} />
  <ParamColor label="Vein color" value={cfg.obsidianPillars.veinColor} onChange={(v) => (mut().obsidianPillars.veinColor = v)} />
  <ParamSlider label="Vein intensity" value={cfg.obsidianPillars.veinIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().obsidianPillars.veinIntensity = v)} />
  <ParamSlider label="Min height" value={cfg.obsidianPillars.heightRange[0]} min={0.5} max={5} step={0.25} unit="m" onChange={(v) => (mut().obsidianPillars.heightRange[0] = v)} />
  <ParamSlider label="Max height" value={cfg.obsidianPillars.heightRange[1]} min={1} max={12} step={0.25} unit="m" onChange={(v) => (mut().obsidianPillars.heightRange[1] = v)} />
  <ParamSlider label="Pulse speed" value={cfg.obsidianPillars.pulseSpeed} min={0} max={3} step={0.05} onChange={(v) => (mut().obsidianPillars.pulseSpeed = v)} />
  <ParamColor label="Pulse color" value={cfg.obsidianPillars.pulseColor} onChange={(v) => (mut().obsidianPillars.pulseColor = v)} />
  {#each cfg.obsidianPillars.rings as _, i}
    <div class="ring-group">
      <div class="ring-label">Ring {i + 1}</div>
      <ParamSlider label="Radius" value={cfg.obsidianPillars.rings[i]!.radius} min={4} max={30} step={0.5} unit="m" onChange={(v) => (mut().obsidianPillars.rings[i]!.radius = v)} />
      <ParamSlider label="Count" value={cfg.obsidianPillars.rings[i]!.count} min={0} max={30} step={1} onChange={(v) => (mut().obsidianPillars.rings[i]!.count = v)} />
      <ParamSlider label="Scale base" value={cfg.obsidianPillars.rings[i]!.scaleBase} min={0.3} max={2.5} step={0.05} onChange={(v) => (mut().obsidianPillars.rings[i]!.scaleBase = v)} />
    </div>
  {/each}
</ParamPanel>

{#if cfg.fireWisps}
  <ParamPanel title="Fire wisps" defaultOpen={false} enabled={cfg.fireWisps.enabled} onToggle={(v) => { if (mut().fireWisps) mut().fireWisps!.enabled = v; }}>
    <ParamSlider label="Count" value={cfg.fireWisps.count} min={0} max={20} step={1} onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.count = v; }} />
    <ParamSlider label="Spawn radius" value={cfg.fireWisps.spawnRadius} min={2} max={20} step={0.5} unit="m" onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.spawnRadius = v; }} />
    <ParamSlider label="Min height" value={cfg.fireWisps.heightRange[0]} min={0.5} max={8} step={0.25} unit="m" onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.heightRange[0] = v; }} />
    <ParamSlider label="Max height" value={cfg.fireWisps.heightRange[1]} min={1} max={12} step={0.25} unit="m" onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.heightRange[1] = v; }} />
    <ParamSlider label="Drift speed" value={cfg.fireWisps.driftSpeed} min={0} max={2} step={0.05} onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.driftSpeed = v; }} />
    <ParamSlider label="Pulse speed" value={cfg.fireWisps.pulseSpeed} min={0} max={3} step={0.05} onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.pulseSpeed = v; }} />
    <ParamSlider label="Light intensity" value={cfg.fireWisps.lightIntensity} min={0} max={50} step={1} onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.lightIntensity = v; }} />
    <ParamSlider label="Light distance" value={cfg.fireWisps.lightDistance} min={1} max={20} step={0.5} unit="m" onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.lightDistance = v; }} />
    {#each cfg.fireWisps.colors as _, i}
      <ParamColor label={`Color ${i + 1}`} value={cfg.fireWisps.colors[i]!} onChange={(v) => { if (mut().fireWisps) mut().fireWisps!.colors[i] = v; }} />
    {/each}
  </ParamPanel>
{/if}

{#if cfg.emberFountains}
  <ParamPanel title="Ember fountains" defaultOpen={false} enabled={cfg.emberFountains.enabled} onToggle={(v) => { if (mut().emberFountains) mut().emberFountains!.enabled = v; }}>
    <ParamSlider label="Count" value={cfg.emberFountains.count} min={0} max={200} step={5} onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.count = v; }} />
    <ParamSlider label="Rise speed" value={cfg.emberFountains.riseSpeed} min={0} max={3} step={0.05} onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.riseSpeed = v; }} />
    <ParamSlider label="Spawn radius" value={cfg.emberFountains.spawnRadius} min={1} max={15} step={0.5} unit="m" onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.spawnRadius = v; }} />
    <ParamSlider label="Max height" value={cfg.emberFountains.maxHeight} min={2} max={20} step={0.5} unit="m" onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.maxHeight = v; }} />
    <ParamSlider label="Gravity" value={cfg.emberFountains.gravity} min={0} max={2} step={0.05} onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.gravity = v; }} />
    <ParamSlider label="Burst interval" value={cfg.emberFountains.burstInterval} min={0.5} max={10} step={0.25} unit="s" onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.burstInterval = v; }} />
    <ParamSlider label="Burst count" value={cfg.emberFountains.burstCount} min={1} max={50} step={1} onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.burstCount = v; }} />
    <ParamSlider label="Min size" value={cfg.emberFountains.sizeRange[0]} min={0.01} max={0.2} step={0.005} unit="m" onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.sizeRange[0] = v; }} />
    <ParamSlider label="Max size" value={cfg.emberFountains.sizeRange[1]} min={0.02} max={0.3} step={0.005} unit="m" onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.sizeRange[1] = v; }} />
    {#each cfg.emberFountains.colors as _, i}
      <ParamColor label={`Color ${i + 1}`} value={cfg.emberFountains.colors[i]!} onChange={(v) => { if (mut().emberFountains) mut().emberFountains!.colors[i] = v; }} />
    {/each}
  </ParamPanel>
{/if}

{#if cfg.volcanicHaze}
  <ParamPanel title="Volcanic haze" defaultOpen={false} enabled={cfg.volcanicHaze.enabled} onToggle={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.enabled = v; }}>
    <ParamColor label="Color 1" value={cfg.volcanicHaze.color1} onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.color1 = v; }} />
    <ParamColor label="Color 2" value={cfg.volcanicHaze.color2} onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.color2 = v; }} />
    <ParamSlider label="Opacity" value={cfg.volcanicHaze.opacity} min={0} max={1} step={0.01} onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.opacity = v; }} />
    <ParamSlider label="Scale" value={cfg.volcanicHaze.scale} min={0.5} max={5} step={0.25} onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.scale = v; }} />
    <ParamSlider label="Animation speed" value={cfg.volcanicHaze.animationSpeed} min={0} max={0.1} step={0.002} onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.animationSpeed = v; }} />
    <ParamSlider label="Lightning interval" value={cfg.volcanicHaze.lightningInterval} min={1} max={20} step={0.5} unit="s" onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.lightningInterval = v; }} />
    <ParamSlider label="Lightning intensity" value={cfg.volcanicHaze.lightningIntensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().volcanicHaze) mut().volcanicHaze!.lightningIntensity = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Embers" defaultOpen={false}>
  <ParamSlider label="Count" value={cfg.embers.count} min={0} max={500} step={10} onChange={(v) => (mut().embers.count = v)} />
  <ParamSlider label="Speed" value={cfg.embers.speed} min={0} max={1} step={0.01} unit="m/s" onChange={(v) => (mut().embers.speed = v)} />
  <ParamSlider label="Min size" value={cfg.embers.sizeRange[0]} min={0.005} max={0.1} step={0.002} unit="m" onChange={(v) => (mut().embers.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.embers.sizeRange[1]} min={0.01} max={0.2} step={0.002} unit="m" onChange={(v) => (mut().embers.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.embers.area.width} min={5} max={50} step={1} unit="m" onChange={(v) => (mut().embers.area.width = v)} />
  {#each cfg.embers.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.embers.colors[i]!} onChange={(v) => (mut().embers.colors[i] = v)} />
  {/each}
</ParamPanel>

<ParamPanel title="Rocks" defaultOpen={false}>
  <ParamSlider label="Count" value={cfg.rockCount} min={0} max={20} step={1} onChange={(v) => (mut().rockCount = v)} />
  <ParamSlider label="Clearing radius" value={cfg.clearingRadius} min={4} max={25} step={0.5} unit="m" onChange={(v) => (mut().clearingRadius = v)} />
  <ParamColor label="Tint color" value={cfg.rockTintColor} onChange={(v) => (mut().rockTintColor = v)} />
  <ParamSlider label="Tint blend" value={cfg.rockTintBlend} min={0} max={1} step={0.01} onChange={(v) => (mut().rockTintBlend = v)} />
</ParamPanel>

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mut().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mut().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().hemisphereLight.intensity = v)} />
</ParamPanel>

{#if cfg.skyLight}
  <ParamPanel title="Sky light" defaultOpen={false} enabled={cfg.skyLight.enabled} onToggle={(v) => { if (mut().skyLight) mut().skyLight!.enabled = v; }}>
    <ParamColor label="Color" value={cfg.skyLight.color} onChange={(v) => { if (mut().skyLight) mut().skyLight!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.skyLight.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().skyLight) mut().skyLight!.intensity = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Obsidian platform" defaultOpen={false} enabled={cfg.platform.enabled} onToggle={(v) => (mut().platform.enabled = v)}>
  <ParamSlider label="Radius" value={cfg.platform.radius} min={2} max={12} step={0.5} unit="m" onChange={(v) => (mut().platform.radius = v)} />
  <ParamSlider label="Height" value={cfg.platform.height} min={0.1} max={1.5} step={0.05} unit="m" onChange={(v) => (mut().platform.height = v)} />
  <ParamColor label="Color" value={cfg.platform.primaryColor} onChange={(v) => (mut().platform.primaryColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.platform.glowIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.glowIntensity = v)} />
  <ParamSlider label="Crack intensity" value={cfg.platform.crackIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.crackIntensity = v)} />
  <ParamSlider label="Lava speed" value={cfg.platform.lavaSpeed} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.lavaSpeed = v)} />
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
