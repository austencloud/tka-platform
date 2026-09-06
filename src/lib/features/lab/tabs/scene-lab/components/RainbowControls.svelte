<script lang="ts">
  import ParamPanel from "./ParamPanel.svelte";
  import ParamSlider from "./ParamSlider.svelte";
  import ParamColor from "./ParamColor.svelte";
  import { getSceneLabContext } from "../context/scene-lab-context";

  const { state } = getSceneLabContext();
  const cfg = $derived(state.rainbowConfig);
  function mut() { return state.rainbowConfig; }
</script>

<ParamPanel title="Fog">
  <ParamColor label="Color" value={cfg.fog.color} onChange={(v) => (mut().fog.color = v)} />
  <ParamSlider label="Density" value={cfg.fog.density} min={0} max={0.05} step={0.001} onChange={(v) => (mut().fog.density = v)} />
</ParamPanel>

<ParamPanel title="Pavilion court" enabled={cfg.platform.enabled} onToggle={(v) => (mut().platform.enabled = v)}>
  <ParamSlider label="Radius" value={cfg.platform.radius} min={6} max={12} step={0.5} unit="m" onChange={(v) => (mut().platform.radius = v)} />
  <ParamSlider label="Height" value={cfg.platform.height} min={0.1} max={1.5} step={0.05} unit="m" onChange={(v) => (mut().platform.height = v)} />
  <ParamSlider label="Canopy glow" value={cfg.platform.glowIntensity} min={0} max={2} step={0.05} onChange={(v) => (mut().platform.glowIntensity = v)} />
  <ParamSlider label="Breeze speed" value={cfg.platform.spectrumSpeed} min={0} max={1} step={0.01} onChange={(v) => (mut().platform.spectrumSpeed = v)} />
</ParamPanel>

<ParamPanel title="Lighting">
  <ParamColor label="Sky" value={cfg.hemisphereLight.skyColor} onChange={(v) => (mut().hemisphereLight.skyColor = v)} />
  <ParamColor label="Ground" value={cfg.hemisphereLight.groundColor} onChange={(v) => (mut().hemisphereLight.groundColor = v)} />
  <ParamSlider label="Intensity" value={cfg.hemisphereLight.intensity} min={0} max={2} step={0.05} onChange={(v) => (mut().hemisphereLight.intensity = v)} />
</ParamPanel>
