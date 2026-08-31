<script lang="ts">
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LabeledColorPairPicker from "$lib/shared/ui/components/LabeledColorPairPicker.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";
  import { changeArtSetting, reportArtSetting } from "./art-setting-change";
  import type {
    ArtSettingChangeHandler,
    ArtSettingValue,
  } from "./art-settings-types";
  import type { AnimationSettingsState } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

  interface Props {
    controller: TunnelViewController;
    dense: boolean;
    bpm: number;
    isPlaying: boolean;
    onBpmChange: (bpm: number) => void;
    onPlaybackToggle: () => void;
    onArtSettingChange?: ArtSettingChangeHandler;
    animationSettingsState: AnimationSettingsState;
  }

  let {
    controller,
    dense,
    bpm,
    isPlaying,
    onBpmChange,
    onPlaybackToggle,
    onArtSettingChange,
    animationSettingsState,
  }: Props = $props();

  function reportSetting(
    group: string,
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    coalesce = false
  ): void {
    reportArtSetting(
      onArtSettingChange,
      group,
      setting,
      previousValue,
      value,
      coalesce
    );
  }

  function changeSetting(
    group: string,
    setting: string,
    previousValue: ArtSettingValue,
    value: ArtSettingValue,
    mutate: () => void,
    coalesce = false
  ): void {
    changeArtSetting(
      onArtSettingChange,
      group,
      setting,
      previousValue,
      value,
      mutate,
      coalesce
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

<div class="section-pad">
  <!-- This is performed presentation state, so existing Spectrum saves reopen
       unchanged even though new creator sessions begin with hand colors. -->
  <div class="rt-section colors-row">
    <span class="rt-section-label">Colors</span>
    <SegmentedControl
      options={colorOptions}
      value={controller.colorMode}
      onchange={(v) =>
        changeSetting(
          "art_tunnel",
          "colors",
          controller.colorMode,
          v,
          () => (controller.colorMode = v as "hands" | "spectrum" | "custom")
        )}
      color="accent"
      size="sm"
    />
    <Crossfade key={controller.colorMode} animateHeight>
      {#if controller.colorMode === "custom"}
        <LabeledColorPairPicker
          blue={controller.customPropColors.blue}
          red={controller.customPropColors.red}
          onchange={(hand, value) => {
            const previous = controller.customPropColors[hand];
            controller.setCustomPropColor(hand, value);
            reportSetting(
              "art_tunnel",
              hand === "blue" ? "left_prop_color" : "right_prop_color",
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
  <EffectsPanel
    layout={dense ? "strip" : "sidebar"}
    showPlayback={false}
    {bpm}
    {onBpmChange}
    {isPlaying}
    {onPlaybackToggle}
    {animationSettingsState}
    onSettingChange={(setting, previousValue, value, coalesce) =>
      reportSetting("art_effects", setting, previousValue, value, coalesce)}
  />
</div>

<style>
  .section-pad {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 16px 20px;
  }
  .section-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    line-height: 1.4;
    margin: 0;
    padding: 0 8px;
  }
  .rt-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rt-section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  /* Mobile dock tray: tighten the shared section bodies. Buttons/inputs keep
     their var(--min-touch-target) floor — only gaps and outer paddings collapse
     so the tray stays compact floating over the art. */
  :global(.dock-dense) .section-pad {
    gap: 8px;
    padding: 2px 2px 6px;
  }
</style>
