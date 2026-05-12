<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  interface Props {
    variant: "night" | "aurora";
  }

  let { variant }: Props = $props();
  const { state } = getSceneLabContext();
  const cfg = $derived(
    variant === "night" ? state.cosmicNightConfig : state.cosmicAuroraConfig
  );

  function mut() {
    return variant === "night"
      ? state.cosmicNightConfig
      : state.cosmicAuroraConfig;
  }
</script>

<ParamPanel title="Sky">
  <ParamColor label="Top" value={cfg.sky.topColor} onChange={(v) => (mut().sky.topColor = v)} />
  <ParamColor label="Mid" value={cfg.sky.midColor ?? "#000000"} onChange={(v) => (mut().sky.midColor = v)} />
  <ParamColor label="Bottom" value={cfg.sky.bottomColor} onChange={(v) => (mut().sky.bottomColor = v)} />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor label="Color" value={cfg.fog.color} onChange={(v) => (mut().fog.color = v)} />
  <ParamSlider label="Density" value={cfg.fog.density} min={0} max={0.05} step={0.001} onChange={(v) => (mut().fog.density = v)} />
</ParamPanel>

<ParamPanel title="Ground">
  <ParamColor label="Color" value={cfg.ground.color} onChange={(v) => (mut().ground.color = v)} />
  <ParamSlider label="Size" value={cfg.ground.size} min={5} max={60} step={1} onChange={(v) => (mut().ground.size = v)} />
</ParamPanel>

<ParamPanel title="Station Platform">
  <ParamSlider label="Enabled" value={cfg.platform.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().platform.enabled = v > 0.5)} />
  <ParamSlider label="Radius" value={cfg.platform.radius} min={0.5} max={8} step={0.25} onChange={(v) => (mut().platform.radius = v)} />
  <ParamSlider label="Height" value={cfg.platform.height} min={0.02} max={0.5} step={0.01} onChange={(v) => (mut().platform.height = v)} />
  <ParamSlider label="Metallic" value={cfg.platform.metallic} min={0} max={1} step={0.05} onChange={(v) => (mut().platform.metallic = v)} />
  <ParamSlider label="Roughness" value={cfg.platform.roughness} min={0} max={1} step={0.05} onChange={(v) => (mut().platform.roughness = v)} />
  <ParamColor label="Base color" value={cfg.platform.baseColor} onChange={(v) => (mut().platform.baseColor = v)} />
  <ParamColor label="Emissive color" value={cfg.platform.emissiveColor} onChange={(v) => (mut().platform.emissiveColor = v)} />
  <ParamSlider label="Emissive intensity" value={cfg.platform.emissiveIntensity} min={0} max={3} step={0.05} onChange={(v) => (mut().platform.emissiveIntensity = v)} />
  <ParamSlider label="Edge glow width" value={cfg.platform.edgeGlowWidth} min={0} max={0.5} step={0.01} onChange={(v) => (mut().platform.edgeGlowWidth = v)} />
  <ParamSlider label="Pulse speed" value={cfg.platform.pulseSpeed} min={0} max={3} step={0.1} onChange={(v) => (mut().platform.pulseSpeed = v)} />
</ParamPanel>

<ParamPanel title="Earth" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.earth.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().earth.enabled = v > 0.5)} />
  <ParamSlider label="Pos X" value={cfg.earth.position[0]} min={-80} max={80} step={1} onChange={(v) => (mut().earth.position[0] = v)} />
  <ParamSlider label="Pos Y" value={cfg.earth.position[1]} min={-20} max={40} step={1} onChange={(v) => (mut().earth.position[1] = v)} />
  <ParamSlider label="Pos Z" value={cfg.earth.position[2]} min={-80} max={80} step={1} onChange={(v) => (mut().earth.position[2] = v)} />
  <ParamSlider label="Radius" value={cfg.earth.radius} min={1} max={20} step={0.5} onChange={(v) => (mut().earth.radius = v)} />
  <ParamColor label="Rim color" value={cfg.earth.rimColor} onChange={(v) => (mut().earth.rimColor = v)} />
  <ParamSlider label="Rim intensity" value={cfg.earth.rimIntensity} min={0} max={3} step={0.1} onChange={(v) => (mut().earth.rimIntensity = v)} />
  <ParamSlider label="Rotation speed" value={cfg.earth.rotationSpeed} min={0} max={0.2} step={0.005} onChange={(v) => (mut().earth.rotationSpeed = v)} />
</ParamPanel>

<ParamPanel title="Nebula" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.nebula.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().nebula.enabled = v > 0.5)} />
  <ParamColor label="Color 1" value={cfg.nebula.color1} onChange={(v) => (mut().nebula.color1 = v)} />
  <ParamColor label="Color 2" value={cfg.nebula.color2} onChange={(v) => (mut().nebula.color2 = v)} />
  <ParamSlider label="Opacity" value={cfg.nebula.opacity} min={0} max={0.5} step={0.01} onChange={(v) => (mut().nebula.opacity = v)} />
  <ParamSlider label="Scale" value={cfg.nebula.scale} min={0.2} max={3} step={0.1} onChange={(v) => (mut().nebula.scale = v)} />
  <ParamSlider label="Animation speed" value={cfg.nebula.animationSpeed} min={0} max={0.1} step={0.005} onChange={(v) => (mut().nebula.animationSpeed = v)} />
</ParamPanel>

<ParamPanel title="Star Drift">
  <ParamSlider label="Count" value={cfg.particles.starDrift.count} min={0} max={500} step={10} onChange={(v) => (mut().particles.starDrift.count = v)} />
  <ParamSlider label="Speed" value={cfg.particles.starDrift.speed} min={0} max={0.2} step={0.005} onChange={(v) => (mut().particles.starDrift.speed = v)} />
  {#each cfg.particles.starDrift.colors as _, i}
    <ParamColor label={`Star ${i + 1}`} value={cfg.particles.starDrift.colors[i]!} onChange={(v) => (mut().particles.starDrift.colors[i] = v)} />
  {/each}
</ParamPanel>

<ParamPanel title="Cosmic Dust" defaultOpen={false}>
  {#if cfg.particles.cosmicDust}
    <ParamSlider label="Count" value={cfg.particles.cosmicDust.count} min={0} max={300} step={10} onChange={(v) => { const p = mut().particles.cosmicDust; if (p) p.count = v; }} />
    <ParamSlider label="Speed" value={cfg.particles.cosmicDust.speed} min={0} max={0.1} step={0.005} onChange={(v) => { const p = mut().particles.cosmicDust; if (p) p.speed = v; }} />
  {/if}
</ParamPanel>

<ParamPanel title="Energy Particles" defaultOpen={false}>
  {#if cfg.particles.energyParticles}
    <ParamSlider label="Enabled" value={cfg.particles.energyParticles.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { const p = mut().particles.energyParticles; if (p) p.enabled = v > 0.5; }} />
    <ParamSlider label="Count" value={cfg.particles.energyParticles.count} min={0} max={200} step={5} onChange={(v) => { const p = mut().particles.energyParticles; if (p) p.count = v; }} />
    <ParamSlider label="Rise speed" value={cfg.particles.energyParticles.riseSpeed} min={0} max={2} step={0.05} onChange={(v) => { const p = mut().particles.energyParticles; if (p) p.riseSpeed = v; }} />
    <ParamSlider label="Max height" value={cfg.particles.energyParticles.maxHeight} min={1} max={10} step={0.5} onChange={(v) => { const p = mut().particles.energyParticles; if (p) p.maxHeight = v; }} />
    {#each cfg.particles.energyParticles.colors as _, i}
      <ParamColor label={`Glow ${i + 1}`} value={cfg.particles.energyParticles.colors[i]!} onChange={(v) => { const p = mut().particles.energyParticles; if (p) p.colors[i] = v; }} />
    {/each}
  {/if}
</ParamPanel>

<ParamPanel title="Meteor Streaks" defaultOpen={false}>
  {#if cfg.particles.meteorStreaks}
    <ParamSlider label="Enabled" value={cfg.particles.meteorStreaks.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => { const p = mut().particles.meteorStreaks; if (p) p.enabled = v > 0.5; }} />
    <ParamSlider label="Frequency" value={cfg.particles.meteorStreaks.frequency} min={1} max={30} step={1} onChange={(v) => { const p = mut().particles.meteorStreaks; if (p) p.frequency = v; }} />
    <ParamSlider label="Speed" value={cfg.particles.meteorStreaks.speed} min={5} max={40} step={1} onChange={(v) => { const p = mut().particles.meteorStreaks; if (p) p.speed = v; }} />
    <ParamSlider label="Trail length" value={cfg.particles.meteorStreaks.trailLength} min={0.5} max={10} step={0.5} onChange={(v) => { const p = mut().particles.meteorStreaks; if (p) p.trailLength = v; }} />
  {/if}
</ParamPanel>

<ParamPanel title="Hemisphere Light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.lighting.ambient.skyColor} onChange={(v) => (mut().lighting.ambient.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.lighting.ambient.groundColor} onChange={(v) => (mut().lighting.ambient.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.ambient.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().lighting.ambient.intensity = v)} />
</ParamPanel>

<ParamPanel title="Cold Directional Light" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.lighting.coldDirectional.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().lighting.coldDirectional.enabled = v > 0.5)} />
  <ParamColor label="Color" value={cfg.lighting.coldDirectional.color} onChange={(v) => (mut().lighting.coldDirectional.color = v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.coldDirectional.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().lighting.coldDirectional.intensity = v)} />
</ParamPanel>

<ParamPanel title="Warm Station Glow" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.lighting.warmStation.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().lighting.warmStation.enabled = v > 0.5)} />
  <ParamColor label="Color" value={cfg.lighting.warmStation.color} onChange={(v) => (mut().lighting.warmStation.color = v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.warmStation.intensity} min={0} max={50} step={1} onChange={(v) => (mut().lighting.warmStation.intensity = v)} />
  <ParamSlider label="Distance" value={cfg.lighting.warmStation.distance} min={1} max={30} step={1} onChange={(v) => (mut().lighting.warmStation.distance = v)} />
  <ParamSlider label="Height" value={cfg.lighting.warmStation.heightOffset} min={0} max={3} step={0.1} onChange={(v) => (mut().lighting.warmStation.heightOffset = v)} />
</ParamPanel>

<ParamPanel title="Accent Emissive" defaultOpen={false}>
  <ParamSlider label="Enabled" value={cfg.lighting.accentEmissive.enabled ? 1 : 0} min={0} max={1} step={1} onChange={(v) => (mut().lighting.accentEmissive.enabled = v > 0.5)} />
  <ParamColor label="Color" value={cfg.lighting.accentEmissive.color} onChange={(v) => (mut().lighting.accentEmissive.color = v)} />
  <ParamSlider label="Intensity" value={cfg.lighting.accentEmissive.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().lighting.accentEmissive.intensity = v)} />
  <ParamSlider label="Pulse speed" value={cfg.lighting.accentEmissive.pulseSpeed} min={0} max={3} step={0.1} onChange={(v) => (mut().lighting.accentEmissive.pulseSpeed = v)} />
</ParamPanel>
