<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.oceanConfig);
  function mut() { return state.oceanConfig; }
</script>

<ParamPanel title="Quality">
  <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
    <span style="font-size:12px;color:#aaa">Tier</span>
    <select
      value={cfg.qualityTier ?? 'auto'}
      onchange={(e) => (mut().qualityTier = e.currentTarget.value as 'auto' | 'ultra' | 'medium' | 'low')}
      style="flex:1;background:#222;color:#eee;border:1px solid #444;border-radius:4px;padding:3px 6px;font-size:12px"
    >
      <option value="auto">Auto-detect</option>
      <option value="ultra">Ultra</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  </div>
</ParamPanel>

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
  <ParamSlider label="Normal scale" value={cfg.ground.normalScale ?? 1} min={0} max={3} step={0.1} onChange={(v) => (mut().ground.normalScale = v)} />
  <ParamSlider label="Texture repeat" value={cfg.ground.textureRepeat ?? 8} min={4} max={60} step={1} onChange={(v) => (mut().ground.textureRepeat = v)} />
</ParamPanel>

<ParamPanel title="Zone layout" defaultOpen={false}>
  <ParamSlider label="Stage radius" value={cfg.zones.stageRadius} min={1} max={10} step={0.5} unit="m" onChange={(v) => (mut().zones.stageRadius = v)} />
  <ParamSlider label="Clearing radius" value={cfg.zones.clearingRadius} min={2} max={15} step={0.5} unit="m" onChange={(v) => (mut().zones.clearingRadius = v)} />
  <ParamSlider label="Reef inner" value={cfg.zones.reefInner} min={3} max={20} step={0.5} unit="m" onChange={(v) => (mut().zones.reefInner = v)} />
  <ParamSlider label="Reef outer" value={cfg.zones.reefOuter} min={5} max={25} step={0.5} unit="m" onChange={(v) => (mut().zones.reefOuter = v)} />
  <ParamSlider label="Forest inner" value={cfg.zones.forestInner} min={8} max={30} step={0.5} unit="m" onChange={(v) => (mut().zones.forestInner = v)} />
  <ParamSlider label="Forest outer" value={cfg.zones.forestOuter} min={10} max={40} step={0.5} unit="m" onChange={(v) => (mut().zones.forestOuter = v)} />
  <ParamSlider label="Background radius" value={cfg.zones.backgroundRadius} min={15} max={60} step={1} unit="m" onChange={(v) => (mut().zones.backgroundRadius = v)} />
</ParamPanel>

<ParamPanel title="Coral" enabled={cfg.coral.enabled} onToggle={(v) => (mut().coral.enabled = v)}>
  <ParamSlider label="Count" value={cfg.coral.count} min={0} max={100} step={1} onChange={(v) => (mut().coral.count = v)} />
  <ParamColor label="Glow color" value={cfg.coral.glowColor} onChange={(v) => (mut().coral.glowColor = v)} />
  <ParamSlider label="Glow blend" value={cfg.coral.glowBlend} min={0} max={1} step={0.01} onChange={(v) => (mut().coral.glowBlend = v)} />
</ParamPanel>

<ParamPanel title="Kelp forest" defaultOpen={false} enabled={cfg.kelp.enabled} onToggle={(v) => (mut().kelp.enabled = v)}>
  <ParamSlider label="Count" value={cfg.kelp.count} min={0} max={150} step={1} onChange={(v) => (mut().kelp.count = v)} />
  <ParamSlider label="Sway speed" value={cfg.kelp.swaySpeed} min={0} max={3} step={0.1} onChange={(v) => (mut().kelp.swaySpeed = v)} />
  <ParamSlider label="Sway amplitude" value={cfg.kelp.swayAmplitude} min={0} max={0.5} step={0.01} unit="rad" onChange={(v) => (mut().kelp.swayAmplitude = v)} />
</ParamPanel>

<ParamPanel title="Fish" defaultOpen={false} enabled={cfg.fish.enabled} onToggle={(v) => (mut().fish.enabled = v)}>
  <ParamSlider label="Count" value={cfg.fish.count} min={0} max={30} step={1} onChange={(v) => (mut().fish.count = v)} />
  <ParamSlider label="Target size" value={cfg.fish.targetSize} min={0.05} max={1} step={0.01} unit="m" onChange={(v) => (mut().fish.targetSize = v)} />
  <ParamSlider label="Min height" value={cfg.fish.swimHeight[0]} min={0.5} max={8} step={0.25} unit="m" onChange={(v) => (mut().fish.swimHeight[0] = v)} />
  <ParamSlider label="Max height" value={cfg.fish.swimHeight[1]} min={1} max={12} step={0.25} unit="m" onChange={(v) => (mut().fish.swimHeight[1] = v)} />
  <ParamSlider label="Min speed" value={cfg.fish.speed[0]} min={0.05} max={2} step={0.05} onChange={(v) => (mut().fish.speed[0] = v)} />
  <ParamSlider label="Max speed" value={cfg.fish.speed[1]} min={0.1} max={3} step={0.05} onChange={(v) => (mut().fish.speed[1] = v)} />
</ParamPanel>

<ParamPanel title="Decorations" defaultOpen={false} enabled={cfg.decorations.enabled} onToggle={(v) => (mut().decorations.enabled = v)}>
  <ParamSlider label="Count" value={cfg.decorations.count} min={0} max={24} step={1} onChange={(v) => (mut().decorations.count = v)} />
  <ParamSlider label="Target size" value={cfg.decorations.targetSize} min={0.05} max={1} step={0.01} unit="m" onChange={(v) => (mut().decorations.targetSize = v)} />
</ParamPanel>

<ParamPanel title="Rocks" defaultOpen={false} enabled={cfg.rocks.enabled} onToggle={(v) => (mut().rocks.enabled = v)}>
  <ParamSlider label="Count" value={cfg.rocks.count} min={0} max={100} step={1} onChange={(v) => (mut().rocks.count = v)} />
  <ParamColor label="Tint color" value={cfg.rocks.tintColor} onChange={(v) => (mut().rocks.tintColor = v)} />
  <ParamSlider label="Tint blend" value={cfg.rocks.tintBlend} min={0} max={1} step={0.01} onChange={(v) => (mut().rocks.tintBlend = v)} />
</ParamPanel>

<ParamPanel title="Bubbles">
  <ParamSlider label="Count" value={cfg.bubbles.count} min={0} max={500} step={10} onChange={(v) => (mut().bubbles.count = v)} />
  <ParamSlider label="Speed" value={cfg.bubbles.speed} min={0} max={0.5} step={0.005} unit="m/s" onChange={(v) => (mut().bubbles.speed = v)} />
  <ParamSlider label="Min size" value={cfg.bubbles.sizeRange[0]} min={0.01} max={0.2} step={0.005} unit="m" onChange={(v) => (mut().bubbles.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.bubbles.sizeRange[1]} min={0.02} max={0.3} step={0.005} unit="m" onChange={(v) => (mut().bubbles.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.bubbles.area.width} min={2} max={30} step={1} unit="m" onChange={(v) => (mut().bubbles.area.width = v)} />
  {#each cfg.bubbles.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.bubbles.colors[i]!} onChange={(v) => (mut().bubbles.colors[i] = v)} />
  {/each}
</ParamPanel>

{#if cfg.dust}
  <ParamPanel title="Dust motes" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.dust.count} min={0} max={500} step={10} onChange={(v) => { if (mut().dust) mut().dust!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.dust.speed} min={0} max={0.1} step={0.001} onChange={(v) => { if (mut().dust) mut().dust!.speed = v; }} />
    <ParamSlider label="Area width" value={cfg.dust.area.width} min={2} max={30} step={1} unit="m" onChange={(v) => { if (mut().dust) mut().dust!.area.width = v; }} />
  </ParamPanel>
{/if}

{#if cfg.plankton}
  <ParamPanel title="Bioluminescent plankton" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.plankton.count} min={0} max={200} step={5} onChange={(v) => { if (mut().plankton) mut().plankton!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.plankton.speed} min={0} max={0.05} step={0.001} onChange={(v) => { if (mut().plankton) mut().plankton!.speed = v; }} />
    {#each cfg.plankton.colors as _, i}
      <ParamColor label={`Color ${i + 1}`} value={cfg.plankton.colors[i]!} onChange={(v) => { if (mut().plankton) mut().plankton!.colors[i] = v; }} />
    {/each}
  </ParamPanel>
{/if}

{#if cfg.jellyfish}
  <ParamPanel title="Jellyfish" defaultOpen={false} enabled={cfg.jellyfish.enabled} onToggle={(v) => { if (mut().jellyfish) mut().jellyfish!.enabled = v; }}>
    <ParamSlider label="Count" value={cfg.jellyfish.count} min={0} max={8} step={1} onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.count = v; }} />
    <ParamColor label="Glow color" value={cfg.jellyfish.glowColor} onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.glowColor = v; }} />
    <ParamSlider label="Drift speed" value={cfg.jellyfish.driftSpeed} min={0} max={2} step={0.05} onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.driftSpeed = v; }} />
    <ParamSlider label="Pulse rate" value={cfg.jellyfish.pulseRate} min={0} max={2} step={0.05} unit="Hz" onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.pulseRate = v; }} />
    <ParamSlider label="Light intensity" value={cfg.jellyfish.lightIntensity} min={0} max={30} step={1} onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.lightIntensity = v; }} />
    <ParamSlider label="Light distance" value={cfg.jellyfish.lightDistance} min={1} max={20} step={0.5} unit="m" onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.lightDistance = v; }} />
    <ParamSlider label="Spawn radius" value={cfg.jellyfish.spawnRadius} min={3} max={20} step={0.5} unit="m" onChange={(v) => { if (mut().jellyfish) mut().jellyfish!.spawnRadius = v; }} />
  </ParamPanel>
{/if}

{#if cfg.caustics}
  <ParamPanel title="Caustic ripples" defaultOpen={false} enabled={cfg.caustics.enabled} onToggle={(v) => { if (mut().caustics) mut().caustics!.enabled = v; }}>
    <ParamSlider label="Intensity" value={cfg.caustics.intensity} min={0} max={1} step={0.01} onChange={(v) => { if (mut().caustics) mut().caustics!.intensity = v; }} />
    <ParamSlider label="Speed" value={cfg.caustics.speed} min={0} max={0.1} step={0.002} onChange={(v) => { if (mut().caustics) mut().caustics!.speed = v; }} />
    <ParamSlider label="Scale" value={cfg.caustics.scale} min={1} max={10} step={0.5} onChange={(v) => { if (mut().caustics) mut().caustics!.scale = v; }} />
    <ParamColor label="Color" value={cfg.caustics.color} onChange={(v) => { if (mut().caustics) mut().caustics!.color = v; }} />
  </ParamPanel>
{/if}

{#if cfg.godRays}
  <ParamPanel title="God rays" defaultOpen={false} enabled={cfg.godRays.enabled} onToggle={(v) => { if (mut().godRays) mut().godRays!.enabled = v; }}>
    <ParamColor label="Color" value={cfg.godRays.color} onChange={(v) => { if (mut().godRays) mut().godRays!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.godRays.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().godRays) mut().godRays!.intensity = v; }} />
  </ParamPanel>
{/if}

{#if cfg.godRayShafts}
  <ParamPanel title="God ray shafts" defaultOpen={false} enabled={cfg.godRayShafts.enabled} onToggle={(v) => { if (mut().godRayShafts) mut().godRayShafts!.enabled = v; }}>
    <ParamSlider label="Count" value={cfg.godRayShafts.count} min={0} max={20} step={1} onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.count = v; }} />
    <ParamColor label="Color" value={cfg.godRayShafts.color} onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.godRayShafts.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.intensity = v; }} />
    <ParamSlider label="Width" value={cfg.godRayShafts.width} min={0.1} max={5} step={0.1} unit="m" onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.width = v; }} />
    <ParamSlider label="Height" value={cfg.godRayShafts.height} min={1} max={30} step={0.5} unit="m" onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.height = v; }} />
    <ParamSlider label="Speed" value={cfg.godRayShafts.speed} min={0} max={2} step={0.05} onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.speed = v; }} />
    <ParamSlider label="Sway amount" value={cfg.godRayShafts.swayAmount} min={0} max={3} step={0.1} onChange={(v) => { if (mut().godRayShafts) mut().godRayShafts!.swayAmount = v; }} />
  </ParamPanel>
{/if}

{#if cfg.waterSurface}
  <ParamPanel title="Water surface" defaultOpen={false} enabled={cfg.waterSurface.enabled} onToggle={(v) => { if (mut().waterSurface) mut().waterSurface!.enabled = v; }}>
    <ParamSlider label="Height" value={cfg.waterSurface.height} min={5} max={25} step={0.5} unit="m" onChange={(v) => { if (mut().waterSurface) mut().waterSurface!.height = v; }} />
    <ParamColor label="Color" value={cfg.waterSurface.color} onChange={(v) => { if (mut().waterSurface) mut().waterSurface!.color = v; }} />
    <ParamSlider label="Opacity" value={cfg.waterSurface.opacity} min={0} max={1} step={0.01} onChange={(v) => { if (mut().waterSurface) mut().waterSurface!.opacity = v; }} />
    <ParamSlider label="Wave scale" value={cfg.waterSurface.waveScale} min={1} max={20} step={0.5} onChange={(v) => { if (mut().waterSurface) mut().waterSurface!.waveScale = v; }} />
    <ParamSlider label="Wave speed" value={cfg.waterSurface.waveSpeed} min={0} max={2} step={0.05} onChange={(v) => { if (mut().waterSurface) mut().waterSurface!.waveSpeed = v; }} />
    <ParamSlider label="Wave amplitude" value={cfg.waterSurface.waveAmplitude} min={0} max={1} step={0.01} unit="m" onChange={(v) => { if (mut().waterSurface) mut().waterSurface!.waveAmplitude = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Sunken ruins platform" defaultOpen={false} enabled={cfg.platform.enabled} onToggle={(v) => (mut().platform.enabled = v)}>
  <ParamSlider label="Width" value={cfg.platform.width} min={4} max={14} step={0.5} unit="m" onChange={(v) => (mut().platform.width = v)} />
  <ParamSlider label="Depth" value={cfg.platform.depth} min={3} max={12} step={0.5} unit="m" onChange={(v) => (mut().platform.depth = v)} />
  <ParamSlider label="Height" value={cfg.platform.height} min={0.1} max={1.5} step={0.05} unit="m" onChange={(v) => (mut().platform.height = v)} />
  <ParamColor label="Stone color" value={cfg.platform.stoneColor} onChange={(v) => (mut().platform.stoneColor = v)} />
  <ParamColor label="Rune glow" value={cfg.platform.runeGlowColor} onChange={(v) => (mut().platform.runeGlowColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.platform.glowIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.glowIntensity = v)} />
  <ParamSlider label="Moss intensity" value={cfg.platform.mossIntensity} min={0} max={1} step={0.05} onChange={(v) => (mut().platform.mossIntensity = v)} />
  <ParamSlider label="Columns" value={cfg.platform.columnCount} min={0} max={12} step={1} onChange={(v) => (mut().platform.columnCount = v)} />
</ParamPanel>

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mut().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mut().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().hemisphereLight.intensity = v)} />
</ParamPanel>

