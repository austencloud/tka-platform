<!--
  TurnsDrawer.svelte - the turn configuration in a drawer.
  Same shell as CustomizeDrawer: right-side panel on desktop, full-screen sheet
  on mobile.
-->
<script lang="ts">
  import TurnsExpandedOverlay from "../cards/TurnsExpandedOverlay.svelte";
  import type { TurnsOverlayProps } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import GenerationSettingsDrawer from "./GenerationSettingsDrawer.svelte";

  let {
    isOpen,
    overlayProps,
    onClose,
  }: {
    isOpen: boolean;
    overlayProps: TurnsOverlayProps | null;
    onClose: () => void;
  } = $props();
</script>

<GenerationSettingsDrawer {isOpen} ariaLabel="Turns" {onClose}>
  {#snippet children()}
    {#if overlayProps}
      <TurnsExpandedOverlay
        turnPattern={overlayProps.turnPattern}
        level={overlayProps.level}
        maxTurnIntensity={overlayProps.maxTurnIntensity}
        allowedValues={overlayProps.allowedValues}
        onIntensityChange={overlayProps.onIntensityChange}
        blueStartOrientation={overlayProps.blueStartOrientation}
        redStartOrientation={overlayProps.redStartOrientation}
        sequenceLength={overlayProps.sequenceLength}
        loopPeriod={overlayProps.loopPeriod}
        onTurnPatternChange={overlayProps.onTurnPatternChange}
        {onClose}
      />
    {/if}
  {/snippet}
</GenerationSettingsDrawer>
