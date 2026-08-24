<!-- Look coordinates the preset browser and the primitive tuner. -->
<script lang="ts">
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";
  import TunnelPresetBrowser from "./TunnelPresetBrowser.svelte";
  import TunnelPrimitiveTuner from "./TunnelPrimitiveTuner.svelte";
  import type { ArtSettingChangeHandler } from "./art-settings-types";

  interface Props {
    controller: TunnelViewController;
    dense: boolean;
    onSaveTunnel?: () => void;
    saveTunnelLabel?: string;
    onArtSettingChange?: ArtSettingChangeHandler;
  }

  let {
    controller,
    dense,
    onSaveTunnel,
    saveTunnelLabel = "Save tunnel",
    onArtSettingChange,
  }: Props = $props();

  let tuneOpen = $state(false);

  function openTuner(source: "custom_card" | "customize_button"): void {
    if (tuneOpen) return;
    tuneOpen = true;
    onArtSettingChange?.(
      "art_navigation",
      "tunnel_drill",
      "presets",
      "customize",
      false,
      source
    );
  }

  function closeTuner(): void {
    if (!tuneOpen) return;
    tuneOpen = false;
    onArtSettingChange?.(
      "art_navigation",
      "tunnel_drill",
      "customize",
      "presets",
      false,
      "back_button"
    );
  }
</script>

<div class="section-pad">
  {#if tuneOpen}
    <TunnelPrimitiveTuner
      {controller}
      onBack={closeTuner}
      {onArtSettingChange}
    />
  {:else}
    <TunnelPresetBrowser
      {controller}
      {dense}
      {onSaveTunnel}
      {saveTunnelLabel}
      onCustomize={openTuner}
      {onArtSettingChange}
    />
  {/if}

  {#if controller.heavyLoad}
    <p class="warn">
      Dense stack ({controller.propCount} props): a heavy effect may drop frames on
      weaker devices.
    </p>
  {/if}
</div>

<style>
  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 16px 20px;
  }
  .warn {
    margin: 0;
    font-size: 0.72rem;
    color: var(--semantic-warning, #fbbf24);
  }

  /* Mobile dock tray: tighten the shared section bodies. Buttons/inputs keep
     their var(--min-touch-target) floor — only gaps and outer paddings collapse
     so the tray stays compact floating over the art. */
  :global(.dock-dense) .section-pad {
    gap: 8px;
    padding: 2px 2px 6px;
  }
</style>
