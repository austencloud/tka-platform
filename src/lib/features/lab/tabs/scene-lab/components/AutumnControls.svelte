<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.autumnConfig);
  function mut() { return state.autumnConfig; }
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

<ParamPanel title="Leaves">
  <ParamSlider label="Count" value={cfg.leaves.count} min={0} max={1000} step={10} onChange={(v) => (mut().leaves.count = v)} />
  <ParamSlider label="Speed" value={cfg.leaves.speed} min={0} max={1} step={0.01} unit="m/s" onChange={(v) => (mut().leaves.speed = v)} />
  <ParamSlider label="Min size" value={cfg.leaves.sizeRange[0]} min={0.01} max={0.3} step={0.005} unit="m" onChange={(v) => (mut().leaves.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.leaves.sizeRange[1]} min={0.02} max={0.5} step={0.005} unit="m" onChange={(v) => (mut().leaves.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.leaves.area.width} min={5} max={80} step={1} unit="m" onChange={(v) => (mut().leaves.area.width = v)} />
  {#each cfg.leaves.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.leaves.colors[i]!} onChange={(v) => (mut().leaves.colors[i] = v)} />
  {/each}
</ParamPanel>

{#if cfg.distantLeaves}
  <ParamPanel title="Distant leaves" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.distantLeaves.count} min={0} max={500} step={10} onChange={(v) => { if (mut().distantLeaves) mut().distantLeaves!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.distantLeaves.speed} min={0} max={0.5} step={0.01} unit="m/s" onChange={(v) => { if (mut().distantLeaves) mut().distantLeaves!.speed = v; }} />
    <ParamSlider label="Area width" value={cfg.distantLeaves.area.width} min={10} max={100} step={1} unit="m" onChange={(v) => { if (mut().distantLeaves) mut().distantLeaves!.area.width = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Trees (rings)">
  <ParamSlider label="Clearing radius" value={cfg.clearingRadius} min={4} max={25} step={0.5} unit="m" onChange={(v) => (mut().clearingRadius = v)} />
  {#each cfg.treeRings as _, i}
    <div class="ring-group">
      <div class="ring-label">Ring {i + 1}</div>
      <ParamSlider label="Radius" value={cfg.treeRings[i]!.radius} min={8} max={40} step={0.5} unit="m" onChange={(v) => (mut().treeRings[i]!.radius = v)} />
      <ParamSlider label="Count" value={cfg.treeRings[i]!.count} min={0} max={80} step={1} onChange={(v) => (mut().treeRings[i]!.count = v)} />
      <ParamSlider label="Scale base" value={cfg.treeRings[i]!.scaleBase} min={0.3} max={2.5} step={0.05} onChange={(v) => (mut().treeRings[i]!.scaleBase = v)} />
    </div>
  {/each}
</ParamPanel>

<ParamPanel title="Stream" enabled={cfg.stream.enabled} onToggle={(v) => (mut().stream.enabled = v)}>
  <ParamColor label="Color" value={cfg.stream.color} onChange={(v) => (mut().stream.color = v)} />
  <ParamSlider label="Width" value={cfg.stream.width} min={0.5} max={5} step={0.1} unit="m" onChange={(v) => (mut().stream.width = v)} />
</ParamPanel>

<ParamPanel title="Mushrooms" defaultOpen={false} enabled={cfg.mushrooms.enabled} onToggle={(v) => (mut().mushrooms.enabled = v)}>
  <ParamSlider label="Count" value={cfg.mushrooms.count} min={0} max={30} step={1} onChange={(v) => (mut().mushrooms.count = v)} />
  <ParamSlider label="Ring radius" value={cfg.mushrooms.ringRadius} min={3} max={20} step={0.5} unit="m" onChange={(v) => (mut().mushrooms.ringRadius = v)} />
  <ParamColor label="Stem" value={cfg.mushrooms.stemColor} onChange={(v) => (mut().mushrooms.stemColor = v)} />
  <ParamColor label="Glow" value={cfg.mushrooms.glowColor} onChange={(v) => (mut().mushrooms.glowColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.mushrooms.glowIntensity} min={0} max={1} step={0.01} onChange={(v) => (mut().mushrooms.glowIntensity = v)} />
  {#each cfg.mushrooms.capColors as _, i}
    <ParamColor label={`Cap ${i + 1}`} value={cfg.mushrooms.capColors[i]!} onChange={(v) => (mut().mushrooms.capColors[i] = v)} />
  {/each}
</ParamPanel>

<ParamPanel title="Mist" defaultOpen={false} enabled={cfg.mist.enabled} onToggle={(v) => (mut().mist.enabled = v)}>
  <ParamSlider label="Count" value={cfg.mist.count} min={0} max={100} step={1} onChange={(v) => (mut().mist.count = v)} />
  <ParamSlider label="Area" value={cfg.mist.area} min={5} max={60} step={1} unit="m" onChange={(v) => (mut().mist.area = v)} />
  <ParamColor label="Color" value={cfg.mist.color} onChange={(v) => (mut().mist.color = v)} />
  <ParamSlider label="Opacity" value={cfg.mist.opacity} min={0} max={1} step={0.01} onChange={(v) => (mut().mist.opacity = v)} />
  <ParamSlider label="Speed" value={cfg.mist.speed} min={0} max={1} step={0.01} onChange={(v) => (mut().mist.speed = v)} />
</ParamPanel>

{#if cfg.sunLight}
  <ParamPanel title="Sun light" defaultOpen={false} enabled={cfg.sunLight.enabled} onToggle={(v) => { if (mut().sunLight) mut().sunLight!.enabled = v; }}>
    <ParamColor label="Color" value={cfg.sunLight.color} onChange={(v) => { if (mut().sunLight) mut().sunLight!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.sunLight.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().sunLight) mut().sunLight!.intensity = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mut().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mut().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().hemisphereLight.intensity = v)} />
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
