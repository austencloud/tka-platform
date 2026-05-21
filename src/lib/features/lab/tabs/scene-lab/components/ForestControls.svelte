<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();

  const cfg = $derived(state.forestConfig);

  function mutable() {
    return state.forestConfig;
  }
</script>

<ParamPanel title="Sky">
  <ParamColor
    label="Top"
    value={cfg.sky.topColor}
    onChange={(v) => (mutable().sky.topColor = v)}
  />
  <ParamColor
    label="Mid"
    value={cfg.sky.midColor ?? "#000000"}
    onChange={(v) => (mutable().sky.midColor = v)}
  />
  <ParamColor
    label="Bottom"
    value={cfg.sky.bottomColor}
    onChange={(v) => (mutable().sky.bottomColor = v)}
  />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor
    label="Color"
    value={cfg.fog.color}
    onChange={(v) => (mutable().fog.color = v)}
  />
  <ParamSlider
    label="Density"
    value={cfg.fog.density}
    min={0}
    max={0.1}
    step={0.001}
    onChange={(v) => (mutable().fog.density = v)}
  />
</ParamPanel>

<ParamPanel title="Leaves">
  <ParamSlider
    label="Count"
    value={cfg.leaves.count}
    min={0}
    max={1500}
    step={10}
    onChange={(v) => (mutable().leaves.count = v)}
  />
  <ParamSlider
    label="Speed"
    value={cfg.leaves.speed}
    min={0}
    max={1}
    step={0.01}
    unit="m/s"
    onChange={(v) => (mutable().leaves.speed = v)}
  />
</ParamPanel>

{#if cfg.fireflies}
  <ParamPanel title="Fireflies" defaultOpen={false}>
    <ParamSlider
      label="Count"
      value={cfg.fireflies.count}
      min={0}
      max={400}
      step={5}
      onChange={(v) => {
        const m = mutable();
        if (m.fireflies) m.fireflies.count = v;
      }}
    />
    <ParamColor
      label="Color"
      value={cfg.fireflies.colors[0] ?? "#d4e157"}
      onChange={(v) => {
        const m = mutable();
        if (m.fireflies) m.fireflies.colors[0] = v;
      }}
    />
  </ParamPanel>
{/if}

{#if cfg.campfire}
  <ParamPanel title="Campfire" defaultOpen={false}>
    <ParamSlider
      label="Primary intensity"
      value={cfg.campfire.primaryLight.intensity}
      min={0}
      max={150}
      step={1}
      onChange={(v) => {
        const m = mutable();
        if (m.campfire) m.campfire.primaryLight.intensity = v;
      }}
    />
    <ParamSlider
      label="Fill intensity"
      value={cfg.campfire.fillLight.intensity}
      min={0}
      max={100}
      step={1}
      onChange={(v) => {
        const m = mutable();
        if (m.campfire) m.campfire.fillLight.intensity = v;
      }}
    />
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor
    label="Sky"
    value={cfg.hemisphereLight.skyColor}
    onChange={(v) => (mutable().hemisphereLight.skyColor = v)}
  />
  <ParamColor
    label="Ground"
    value={cfg.hemisphereLight.groundColor}
    onChange={(v) => (mutable().hemisphereLight.groundColor = v)}
  />
  <ParamSlider
    label="Intensity"
    value={cfg.hemisphereLight.intensity}
    min={0}
    max={3}
    step={0.05}
    onChange={(v) => (mutable().hemisphereLight.intensity = v)}
  />
</ParamPanel>
