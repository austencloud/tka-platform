<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.blossomConfig);
  function mut() {
    return state.blossomConfig;
  }
</script>

<ParamPanel title="Fog">
  <ParamColor
    label="Color"
    value={cfg.fog.color}
    onChange={(v) => (mut().fog.color = v)}
  />
  <ParamSlider
    label="Density"
    value={cfg.fog.density}
    min={0}
    max={0.1}
    step={0.001}
    onChange={(v) => (mut().fog.density = v)}
  />
</ParamPanel>

<ParamPanel title="Petals">
  <ParamSlider
    label="Count"
    value={cfg.petals.count}
    min={0}
    max={500}
    step={10}
    onChange={(v) => (mut().petals.count = v)}
  />
  <ParamSlider
    label="Speed"
    value={cfg.petals.speed}
    min={0}
    max={0.5}
    step={0.005}
    unit="m/s"
    onChange={(v) => (mut().petals.speed = v)}
  />
  <ParamSlider
    label="Min size"
    value={cfg.petals.sizeRange[0]}
    min={0.01}
    max={0.2}
    step={0.005}
    unit="m"
    onChange={(v) => (mut().petals.sizeRange[0] = v)}
  />
  <ParamSlider
    label="Max size"
    value={cfg.petals.sizeRange[1]}
    min={0.02}
    max={0.3}
    step={0.005}
    unit="m"
    onChange={(v) => (mut().petals.sizeRange[1] = v)}
  />
  <ParamSlider
    label="Area width"
    value={cfg.petals.area.width}
    min={5}
    max={50}
    step={1}
    unit="m"
    onChange={(v) => (mut().petals.area.width = v)}
  />
  {#each cfg.petals.colors as _, i}
    <ParamColor
      label={`Color ${i + 1}`}
      value={cfg.petals.colors[i]!}
      onChange={(v) => (mut().petals.colors[i] = v)}
    />
  {/each}
</ParamPanel>

{#if cfg.distantPetals}
  <ParamPanel title="Distant petals" defaultOpen={false}>
    <ParamSlider
      label="Count"
      value={cfg.distantPetals.count}
      min={0}
      max={300}
      step={10}
      onChange={(v) => {
        if (mut().distantPetals) mut().distantPetals!.count = v;
      }}
    />
    <ParamSlider
      label="Speed"
      value={cfg.distantPetals.speed}
      min={0}
      max={0.3}
      step={0.005}
      unit="m/s"
      onChange={(v) => {
        if (mut().distantPetals) mut().distantPetals!.speed = v;
      }}
    />
    <ParamSlider
      label="Area width"
      value={cfg.distantPetals.area.width}
      min={10}
      max={80}
      step={1}
      unit="m"
      onChange={(v) => {
        if (mut().distantPetals) mut().distantPetals!.area.width = v;
      }}
    />
  </ParamPanel>
{/if}

{#if cfg.fireflies}
  <ParamPanel title="Fireflies" defaultOpen={false}>
    <ParamSlider
      label="Count"
      value={cfg.fireflies.count}
      min={0}
      max={200}
      step={5}
      onChange={(v) => {
        if (mut().fireflies) mut().fireflies!.count = v;
      }}
    />
    <ParamSlider
      label="Speed"
      value={cfg.fireflies.speed}
      min={0}
      max={0.05}
      step={0.001}
      onChange={(v) => {
        if (mut().fireflies) mut().fireflies!.speed = v;
      }}
    />
    <ParamColor
      label="Color"
      value={cfg.fireflies.colors[0] ?? "#ffddaa"}
      onChange={(v) => {
        if (mut().fireflies) mut().fireflies!.colors[0] = v;
      }}
    />
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor
    label="Sky"
    value={cfg.hemisphereLight.skyColor}
    onChange={(v) => (mut().hemisphereLight.skyColor = v)}
  />
  <ParamColor
    label="Ground"
    value={cfg.hemisphereLight.groundColor}
    onChange={(v) => (mut().hemisphereLight.groundColor = v)}
  />
  <ParamSlider
    label="Intensity"
    value={cfg.hemisphereLight.intensity}
    min={0}
    max={3}
    step={0.05}
    onChange={(v) => (mut().hemisphereLight.intensity = v)}
  />
</ParamPanel>

{#if cfg.moonLight}
  <ParamPanel
    title="Moon light"
    defaultOpen={false}
    enabled={cfg.moonLight.enabled}
    onToggle={(v) => {
      if (mut().moonLight) mut().moonLight!.enabled = v;
    }}
  >
    <ParamColor
      label="Color"
      value={cfg.moonLight.color}
      onChange={(v) => {
        if (mut().moonLight) mut().moonLight!.color = v;
      }}
    />
    <ParamSlider
      label="Intensity"
      value={cfg.moonLight.intensity}
      min={0}
      max={3}
      step={0.05}
      onChange={(v) => {
        if (mut().moonLight) mut().moonLight!.intensity = v;
      }}
    />
  </ParamPanel>
{/if}
