<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.voidConfig);
  function mut() { return state.voidConfig; }
</script>

<ParamPanel title="Void grid" enabled={cfg.platform.enabled} onToggle={(v) => (mut().platform.enabled = v)}>
  <ParamSlider label="Radius" value={cfg.platform.radius} min={2} max={12} step={0.5} unit="m" onChange={(v) => (mut().platform.radius = v)} />
  <ParamColor label="Grid color" value={cfg.platform.gridColor} onChange={(v) => (mut().platform.gridColor = v)} />
  <ParamSlider label="Glow intensity" value={cfg.platform.glowIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.glowIntensity = v)} />
  <ParamSlider label="Grid density" value={cfg.platform.gridDensity} min={0.2} max={3} step={0.1} onChange={(v) => (mut().platform.gridDensity = v)} />
</ParamPanel>

<ParamPanel title="Lighting">
  <ParamSlider label="Ambient" value={cfg.ambientIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().ambientIntensity = v)} />
</ParamPanel>
