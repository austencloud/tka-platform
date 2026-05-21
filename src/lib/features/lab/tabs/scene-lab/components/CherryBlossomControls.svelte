<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.cherryBlossomConfig);
  function mut() { return state.cherryBlossomConfig; }
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

<ParamPanel title="Petals">
  <ParamSlider label="Count" value={cfg.petals.count} min={0} max={500} step={10} onChange={(v) => (mut().petals.count = v)} />
  <ParamSlider label="Speed" value={cfg.petals.speed} min={0} max={0.5} step={0.005} unit="m/s" onChange={(v) => (mut().petals.speed = v)} />
  <ParamSlider label="Min size" value={cfg.petals.sizeRange[0]} min={0.01} max={0.2} step={0.005} unit="m" onChange={(v) => (mut().petals.sizeRange[0] = v)} />
  <ParamSlider label="Max size" value={cfg.petals.sizeRange[1]} min={0.02} max={0.3} step={0.005} unit="m" onChange={(v) => (mut().petals.sizeRange[1] = v)} />
  <ParamSlider label="Area width" value={cfg.petals.area.width} min={5} max={50} step={1} unit="m" onChange={(v) => (mut().petals.area.width = v)} />
  {#each cfg.petals.colors as _, i}
    <ParamColor label={`Color ${i + 1}`} value={cfg.petals.colors[i]!} onChange={(v) => (mut().petals.colors[i] = v)} />
  {/each}
</ParamPanel>

{#if cfg.distantPetals}
  <ParamPanel title="Distant petals" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.distantPetals.count} min={0} max={300} step={10} onChange={(v) => { if (mut().distantPetals) mut().distantPetals!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.distantPetals.speed} min={0} max={0.3} step={0.005} unit="m/s" onChange={(v) => { if (mut().distantPetals) mut().distantPetals!.speed = v; }} />
    <ParamSlider label="Area width" value={cfg.distantPetals.area.width} min={10} max={80} step={1} unit="m" onChange={(v) => { if (mut().distantPetals) mut().distantPetals!.area.width = v; }} />
  </ParamPanel>
{/if}

{#if cfg.fireflies}
  <ParamPanel title="Fireflies" defaultOpen={false}>
    <ParamSlider label="Count" value={cfg.fireflies.count} min={0} max={200} step={5} onChange={(v) => { if (mut().fireflies) mut().fireflies!.count = v; }} />
    <ParamSlider label="Speed" value={cfg.fireflies.speed} min={0} max={0.05} step={0.001} onChange={(v) => { if (mut().fireflies) mut().fireflies!.speed = v; }} />
    <ParamColor label="Color" value={cfg.fireflies.colors[0] ?? "#ffddaa"} onChange={(v) => { if (mut().fireflies) mut().fireflies!.colors[0] = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Trees (rings)">
  <ParamSlider label="Clearing radius" value={cfg.clearingRadius} min={4} max={20} step={0.5} unit="m" onChange={(v) => (mut().clearingRadius = v)} />
  {#each cfg.treeRings as _, i}
    <div class="ring-group">
      <div class="ring-label">Ring {i + 1}</div>
      <ParamSlider label="Radius" value={cfg.treeRings[i]!.radius} min={4} max={40} step={0.5} unit="m" onChange={(v) => (mut().treeRings[i]!.radius = v)} />
      <ParamSlider label="Count" value={cfg.treeRings[i]!.count} min={0} max={40} step={1} onChange={(v) => (mut().treeRings[i]!.count = v)} />
      <ParamSlider label="Scale base" value={cfg.treeRings[i]!.scaleBase} min={0.3} max={2.5} step={0.05} onChange={(v) => (mut().treeRings[i]!.scaleBase = v)} />
    </div>
  {/each}
</ParamPanel>

{#if cfg.pond}
  <ParamPanel title="Pond" defaultOpen={false} enabled={cfg.pond.enabled} onToggle={(v) => { if (mut().pond) mut().pond!.enabled = v; }}>
    <ParamColor label="Color" value={cfg.pond.color} onChange={(v) => { if (mut().pond) mut().pond!.color = v; }} />
    <ParamSlider label="Radius" value={cfg.pond.radius} min={1} max={15} step={0.25} unit="m" onChange={(v) => { if (mut().pond) mut().pond!.radius = v; }} />
    <ParamSlider label="Roughness" value={cfg.pond.roughness} min={0} max={1} step={0.01} onChange={(v) => { if (mut().pond) mut().pond!.roughness = v; }} />
    <ParamSlider label="Pos X" value={cfg.pond.position.x} min={-20} max={20} step={0.25} unit="m" onChange={(v) => { if (mut().pond) mut().pond!.position.x = v; }} />
    <ParamSlider label="Pos Z" value={cfg.pond.position.z} min={-20} max={20} step={0.25} unit="m" onChange={(v) => { if (mut().pond) mut().pond!.position.z = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Torii gate" defaultOpen={false} enabled={cfg.toriiGate.enabled} onToggle={(v) => (mut().toriiGate.enabled = v)}>
  <ParamColor label="Color" value={cfg.toriiGate.color} onChange={(v) => (mut().toriiGate.color = v)} />
  <ParamSlider label="Scale" value={cfg.toriiGate.scale} min={0.3} max={3} step={0.05} onChange={(v) => (mut().toriiGate.scale = v)} />
  <ParamSlider label="Rotation Y" value={cfg.toriiGate.rotationY} min={-3.14} max={3.14} step={0.05} unit="rad" onChange={(v) => (mut().toriiGate.rotationY = v)} />
  <ParamSlider label="Pos X" value={cfg.toriiGate.position.x} min={-20} max={20} step={0.25} unit="m" onChange={(v) => (mut().toriiGate.position.x = v)} />
  <ParamSlider label="Pos Z" value={cfg.toriiGate.position.z} min={-20} max={20} step={0.25} unit="m" onChange={(v) => (mut().toriiGate.position.z = v)} />
</ParamPanel>

<ParamPanel title="Hanging lanterns" defaultOpen={false} enabled={cfg.hangingLanterns.enabled} onToggle={(v) => (mut().hangingLanterns.enabled = v)}>
  <ParamColor label="Body color" value={cfg.hangingLanterns.bodyColor} onChange={(v) => (mut().hangingLanterns.bodyColor = v)} />
  <ParamColor label="Glow color" value={cfg.hangingLanterns.glowColor} onChange={(v) => (mut().hangingLanterns.glowColor = v)} />
  <ParamSlider label="Light intensity" value={cfg.hangingLanterns.lightIntensity} min={0} max={30} step={0.5} onChange={(v) => (mut().hangingLanterns.lightIntensity = v)} />
  <ParamSlider label="Light distance" value={cfg.hangingLanterns.lightDistance} min={1} max={20} step={0.5} unit="m" onChange={(v) => (mut().hangingLanterns.lightDistance = v)} />
</ParamPanel>

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mut().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mut().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={3} step={0.05} onChange={(v) => (mut().hemisphereLight.intensity = v)} />
</ParamPanel>

{#if cfg.moonLight}
  <ParamPanel title="Moon light" defaultOpen={false} enabled={cfg.moonLight.enabled} onToggle={(v) => { if (mut().moonLight) mut().moonLight!.enabled = v; }}>
    <ParamColor label="Color" value={cfg.moonLight.color} onChange={(v) => { if (mut().moonLight) mut().moonLight!.color = v; }} />
    <ParamSlider label="Intensity" value={cfg.moonLight.intensity} min={0} max={3} step={0.05} onChange={(v) => { if (mut().moonLight) mut().moonLight!.intensity = v; }} />
  </ParamPanel>
{/if}

<ParamPanel title="Engawa platform" defaultOpen={false} enabled={cfg.platform.enabled} onToggle={(v) => (mut().platform.enabled = v)}>
  <ParamSlider label="Radius" value={cfg.platform.radius} min={2} max={12} step={0.5} unit="m" onChange={(v) => (mut().platform.radius = v)} />
  <ParamSlider label="Height" value={cfg.platform.height} min={0.1} max={1.5} step={0.05} unit="m" onChange={(v) => (mut().platform.height = v)} />
  <ParamColor label="Wood color" value={cfg.platform.primaryColor} onChange={(v) => (mut().platform.primaryColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.platform.glowIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.glowIntensity = v)} />
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
