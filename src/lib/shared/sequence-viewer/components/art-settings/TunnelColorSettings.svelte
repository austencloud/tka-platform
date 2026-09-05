<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import LabeledColorPairPicker from "$lib/shared/ui/components/LabeledColorPairPicker.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";
  import { changeArtSetting, reportArtSetting } from "./art-setting-change";
  import type {
    ArtSettingChangeHandler,
    ArtSettingValue,
  } from "./art-settings-types";

  interface Props {
    controller: TunnelViewController;
    dense: boolean;
    onArtSettingChange?: ArtSettingChangeHandler;
  }

  let { controller, dense, onArtSettingChange }: Props = $props();

  function reportSetting(
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    coalesce = false
  ): void {
    reportArtSetting(
      onArtSettingChange,
      "art_tunnel",
      setting,
      previousValue,
      value,
      coalesce
    );
  }

  function changeSetting(
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    mutate: () => void
  ): void {
    changeArtSetting(
      onArtSettingChange,
      "art_tunnel",
      setting,
      previousValue,
      value,
      mutate
    );
  }

  // Hand colors match the choreography cards. Spectrum remains an explicit
  // instance-coloring appearance for saved tunnels that already authored it.
  const colorOptions = [
    { value: "hands", label: "Hand colors" },
    { value: "spectrum", label: "Spectrum" },
    { value: "custom", label: "Custom pair" },
  ];
</script>

<div class="tunnel-colors">
  <span class="section-label">Tunnel colors</span>
  <SegmentedControl
    options={colorOptions}
    value={controller.colorMode}
    onchange={(value) =>
      changeSetting("colors", controller.colorMode, value, () => {
        controller.colorMode = value as "hands" | "spectrum" | "custom";
      })}
    color="accent"
    size="sm"
  />
  <Crossfade key={controller.colorMode} animateHeight>
    {#if controller.colorMode === "custom"}
      <LabeledColorPairPicker
        left={controller.customPropColors.left}
        right={controller.customPropColors.right}
        onchange={(hand, value) => {
          const previous = controller.customPropColors[hand];
          controller.setCustomPropColor(hand, value);
          reportSetting(
            hand === "left" ? "left_prop_color" : "right_prop_color",
            previous,
            value,
            true
          );
        }}
      />
    {:else if !dense}
      <p class="section-hint">
        {controller.colorMode === "spectrum"
          ? "Generated copies use distinct hues; Left and Right stay labeled throughout the editor."
          : "Stage props match the pictograph Left and Right hand colors."}
      </p>
    {/if}
  </Crossfade>
</div>

<style>
  .tunnel-colors {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .section-hint {
    margin: 0;
    padding: 0 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
    text-align: center;
  }

  :global(.dock-dense) .tunnel-colors {
    padding-top: 8px;
  }
</style>
