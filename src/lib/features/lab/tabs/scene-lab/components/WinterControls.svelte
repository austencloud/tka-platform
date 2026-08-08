<script lang="ts">
  /**
   * WinterControls
   *
   * Param sliders and color inputs bound to the live WinterSceneConfig.
   * Mutations propagate through Svelte 5's deep $state reactivity.
   */

  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.winterConfig);
  function mut() {
    return state.winterConfig;
  }
</script>

<ParamPanel title="Sky">
  <ParamColor
    label="Top"
    value={cfg.sky.topColor}
    onChange={(v) => (state.winterConfig.sky.topColor = v)}
  />
  <ParamColor
    label="Mid"
    value={cfg.sky.midColor ?? "#000000"}
    onChange={(v) => (state.winterConfig.sky.midColor = v)}
  />
  <ParamColor
    label="Bottom"
    value={cfg.sky.bottomColor}
    onChange={(v) => (state.winterConfig.sky.bottomColor = v)}
  />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor
    label="Color"
    value={cfg.fog.color}
    onChange={(v) => (state.winterConfig.fog.color = v)}
  />
  <ParamSlider
    label="Density"
    value={cfg.fog.density}
    min={0}
    max={0.1}
    step={0.001}
    onChange={(v) => (state.winterConfig.fog.density = v)}
  />
</ParamPanel>

<ParamPanel title="Authored forest">
  <ParamSlider
    label="Scenery detail"
    value={cfg.forestDetail}
    min={0}
    max={1}
    step={0.01}
    onChange={(v) => (state.winterConfig.forestDetail = v)}
  />
</ParamPanel>

<ParamPanel title="Winter">
  <ParamSlider
    label="Density"
    value={cfg.snow.count}
    min={0}
    max={2000}
    step={10}
    unit="flakes"
    onChange={(v) => (state.winterConfig.snow.count = v)}
  />
  <ParamSlider
    label="Fall speed"
    value={cfg.snow.speed}
    min={0}
    max={1.5}
    step={0.01}
    unit="m/s"
    onChange={(v) => (state.winterConfig.snow.speed = v)}
  />
  <ParamSlider
    label="Min size"
    value={cfg.snow.sizeRange[0]}
    min={0.01}
    max={0.3}
    step={0.005}
    unit="m"
    onChange={(v) => (state.winterConfig.snow.sizeRange[0] = v)}
  />
  <ParamSlider
    label="Max size"
    value={cfg.snow.sizeRange[1]}
    min={0.02}
    max={0.5}
    step={0.005}
    unit="m"
    onChange={(v) => (state.winterConfig.snow.sizeRange[1] = v)}
  />
  <ParamSlider
    label="Area width"
    value={cfg.snow.area.width}
    min={5}
    max={80}
    step={1}
    unit="m"
    onChange={(v) => (state.winterConfig.snow.area.width = v)}
  />
  <ParamSlider
    label="Area height"
    value={cfg.snow.area.height}
    min={2}
    max={30}
    step={1}
    unit="m"
    onChange={(v) => (state.winterConfig.snow.area.height = v)}
  />
  <ParamSlider
    label="Area depth"
    value={cfg.snow.area.depth}
    min={5}
    max={80}
    step={1}
    unit="m"
    onChange={(v) => (state.winterConfig.snow.area.depth = v)}
  />
  {#each cfg.snow.colors as _, i}
    <ParamColor
      label={`Flake ${i + 1}`}
      value={cfg.snow.colors[i]!}
      onChange={(v) => (state.winterConfig.snow.colors[i] = v)}
    />
  {/each}
</ParamPanel>

{#if cfg.pond}
  <ParamPanel
    title="Frozen pond"
    defaultOpen={false}
    enabled={cfg.pond.enabled}
    onToggle={(v) => {
      if (state.winterConfig.pond) state.winterConfig.pond.enabled = v;
    }}
  >
    <ParamColor
      label="Ice color"
      value={cfg.pond.color}
      onChange={(v) => {
        if (state.winterConfig.pond) state.winterConfig.pond.color = v;
      }}
    />
    <ParamSlider
      label="Roughness"
      value={cfg.pond.roughness}
      min={0}
      max={1}
      step={0.01}
      onChange={(v) => {
        if (state.winterConfig.pond) state.winterConfig.pond.roughness = v;
      }}
    />
  </ParamPanel>
{/if}

{#if cfg.campfire}
  <ParamPanel
    title="Campfire"
    defaultOpen={false}
    enabled={cfg.campfire.enabled}
    onToggle={(v) => {
      if (state.winterConfig.campfire) state.winterConfig.campfire.enabled = v;
    }}
  >
    <ParamSlider
      label="Fire scale"
      value={cfg.campfire.fireScale}
      min={0.3}
      max={2}
      step={0.05}
      onChange={(v) => {
        if (state.winterConfig.campfire)
          state.winterConfig.campfire.fireScale = v;
      }}
    />
    <ParamSlider
      label="Primary light intensity"
      value={cfg.campfire.primaryLight.intensity}
      min={0}
      max={150}
      step={1}
      onChange={(v) => {
        if (state.winterConfig.campfire)
          state.winterConfig.campfire.primaryLight.intensity = v;
      }}
    />
    <ParamSlider
      label="Fill light intensity"
      value={cfg.campfire.fillLight.intensity}
      min={0}
      max={100}
      step={1}
      onChange={(v) => {
        if (state.winterConfig.campfire)
          state.winterConfig.campfire.fillLight.intensity = v;
      }}
    />
    <ParamColor
      label="Primary color"
      value={cfg.campfire.primaryLight.color}
      onChange={(v) => {
        if (state.winterConfig.campfire)
          state.winterConfig.campfire.primaryLight.color = v;
      }}
    />
  </ParamPanel>
{/if}

<ParamPanel title="Hemisphere light" defaultOpen={false}>
  <ParamColor
    label="Sky"
    value={cfg.hemisphereLight.skyColor}
    onChange={(v) => (state.winterConfig.hemisphereLight.skyColor = v)}
  />
  <ParamColor
    label="Ground"
    value={cfg.hemisphereLight.groundColor}
    onChange={(v) => (state.winterConfig.hemisphereLight.groundColor = v)}
  />
  <ParamSlider
    label="Intensity"
    value={cfg.hemisphereLight.intensity}
    min={0}
    max={3}
    step={0.05}
    onChange={(v) => (state.winterConfig.hemisphereLight.intensity = v)}
  />
</ParamPanel>

{#if cfg.moonLight}
  <ParamPanel
    title="Moon (directional light)"
    defaultOpen={false}
    enabled={cfg.moonLight.enabled}
    onToggle={(v) => {
      if (state.winterConfig.moonLight)
        state.winterConfig.moonLight.enabled = v;
    }}
  >
    <ParamColor
      label="Color"
      value={cfg.moonLight.color}
      onChange={(v) => {
        if (state.winterConfig.moonLight)
          state.winterConfig.moonLight.color = v;
      }}
    />
    <ParamSlider
      label="Intensity"
      value={cfg.moonLight.intensity}
      min={0}
      max={3}
      step={0.05}
      onChange={(v) => {
        if (state.winterConfig.moonLight)
          state.winterConfig.moonLight.intensity = v;
      }}
    />
  </ParamPanel>
{/if}

<ParamPanel
  title="Ice platform"
  defaultOpen={false}
  enabled={cfg.platform.enabled}
  onToggle={(v) => (mut().platform.enabled = v)}
>
  <ParamSlider
    label="Radius"
    value={cfg.platform.radius}
    min={2}
    max={12}
    step={0.5}
    unit="m"
    onChange={(v) => (mut().platform.radius = v)}
  />
  <ParamSlider
    label="Height"
    value={cfg.platform.height}
    min={0.1}
    max={1.5}
    step={0.05}
    unit="m"
    onChange={(v) => (mut().platform.height = v)}
  />
  <ParamColor
    label="Color"
    value={cfg.platform.primaryColor}
    onChange={(v) => (mut().platform.primaryColor = v)}
  />
  <ParamSlider
    label="Glow intensity"
    value={cfg.platform.glowIntensity}
    min={0}
    max={2}
    step={0.05}
    onChange={(v) => (mut().platform.glowIntensity = v)}
  />
  <ParamSlider
    label="Frost density"
    value={cfg.platform.frostDensity}
    min={0.2}
    max={3}
    step={0.1}
    onChange={(v) => (mut().platform.frostDensity = v)}
  />
</ParamPanel>
