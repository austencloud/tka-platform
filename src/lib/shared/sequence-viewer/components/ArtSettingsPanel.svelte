<!--
  Stable public dispatcher for the two Art settings products. Tunnel and
  Mandala own their controls; the shared frame owns desktop card chrome.
-->
<script lang="ts">
  import MandalaArtSettings from "./art-settings/MandalaArtSettings.svelte";
  import TunnelArtSettings from "./art-settings/TunnelArtSettings.svelte";
  import type { ArtSettingsPanelProps } from "./art-settings/art-settings-types";

  let {
    controller,
    mandalaController,
    artType,
    layout = "sidebar",
    onExport,
    showExport = true,
    onSaveTunnel,
    bpm = $bindable(60),
    playbackMode = "continuous",
    isPlaying = false,
    onBpmChange = () => {},
    onPlaybackModeChange = () => {},
    onPlaybackToggle = () => {},
    bluePropType = null,
    onPropChange,
    onArtSettingChange,
    exporting = false,
  }: ArtSettingsPanelProps = $props();

  let reduceMotion = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onChange = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
</script>

{#if artType === "tunnel"}
  <TunnelArtSettings
    {controller}
    {layout}
    {onExport}
    {showExport}
    {onSaveTunnel}
    {bpm}
    {playbackMode}
    {isPlaying}
    {onBpmChange}
    {onPlaybackModeChange}
    {onPlaybackToggle}
    {bluePropType}
    {onPropChange}
    {onArtSettingChange}
    {exporting}
    {reduceMotion}
  />
{:else}
  <MandalaArtSettings
    {mandalaController}
    {layout}
    {onExport}
    {showExport}
    {onArtSettingChange}
    {exporting}
    {reduceMotion}
  />
{/if}
