<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.autumnConfig);
  function mut() {
    return state.autumnConfig;
  }
</script>

<ParamPanel title="Sky">
  <ParamColor
    label="Top"
    value={cfg.sky.topColor}
    onChange={(value) => (mut().sky.topColor = value)}
  />
  <ParamColor
    label="Middle"
    value={cfg.sky.midColor ?? "#000000"}
    onChange={(value) => (mut().sky.midColor = value)}
  />
  <ParamColor
    label="Horizon"
    value={cfg.sky.bottomColor}
    onChange={(value) => (mut().sky.bottomColor = value)}
  />
</ParamPanel>

<ParamPanel title="Fog">
  <ParamColor
    label="Color"
    value={cfg.fog.color}
    onChange={(value) => (mut().fog.color = value)}
  />
  <ParamSlider
    label="Density"
    value={cfg.fog.density}
    min={0.004}
    max={0.035}
    step={0.001}
    onChange={(value) => (mut().fog.density = value)}
  />
</ParamPanel>

<ParamPanel
  title="Stars"
  enabled={cfg.stars.enabled}
  onToggle={(value) => (mut().stars.enabled = value)}
>
  <ParamSlider
    label="Count"
    value={cfg.stars.countScale}
    min={0.25}
    max={1.5}
    step={0.05}
    onChange={(value) => (mut().stars.countScale = value)}
  />
  <ParamSlider
    label="Size"
    value={cfg.stars.sizeScale}
    min={0.5}
    max={1.5}
    step={0.05}
    onChange={(value) => (mut().stars.sizeScale = value)}
  />
  <ParamSlider
    label="Intensity"
    value={cfg.stars.intensity}
    min={0.3}
    max={2.5}
    step={0.05}
    onChange={(value) => (mut().stars.intensity = value)}
  />
</ParamPanel>

<ParamPanel title="Forest floor">
  <ParamSlider
    label="Leaf detail"
    value={cfg.groundDetailStrength}
    min={0}
    max={1.4}
    step={0.05}
    onChange={(value) => (mut().groundDetailStrength = value)}
  />
  <ParamSlider
    label="Magic"
    value={cfg.magicIntensity}
    min={0}
    max={2}
    step={0.05}
    onChange={(value) => (mut().magicIntensity = value)}
  />
</ParamPanel>
