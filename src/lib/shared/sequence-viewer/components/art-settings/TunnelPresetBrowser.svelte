<script lang="ts">
  import PerformerRing from "../../tunnel/PerformerRing.svelte";
  import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";
  import { TUNNEL_PRESETS } from "../../tunnel/tunnel-config";
  import { tunnelUserPresets } from "../../tunnel/tunnel-user-presets.svelte";
  import { changeArtSetting, reportArtSetting } from "./art-setting-change";
  import type {
    ArtSettingChangeHandler,
    ArtSettingValue,
  } from "./art-settings-types";

  interface Props {
    controller: TunnelViewController;
    dense: boolean;
    onSaveTunnel?: () => void;
    saveTunnelLabel?: string;
    onCustomize: (source: "custom_card" | "customize_button") => void;
    onArtSettingChange?: ArtSettingChangeHandler;
  }

  let {
    controller,
    dense,
    onSaveTunnel,
    saveTunnelLabel = "Save tunnel",
    onCustomize,
    onArtSettingChange,
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

  const selectedBuiltInId = $derived(
    controller.presetRecipe?.kind === "built-in"
      ? controller.presetRecipe.id
      : null
  );
  const selectedUserId = $derived(
    controller.presetRecipe?.kind === "saved" ? controller.presetRecipe.id : null
  );
  const isCustom = $derived(controller.presetRecipe === null);
</script>

{#if !dense}<span class="rt-section-label">Choose a tunnel preset</span>{/if}
<div class="preset-grid" role="radiogroup" aria-label="Tunnel preset">
  {#each TUNNEL_PRESETS as p (p.id)}
    <button
      class="preset-card"
      class:active={selectedBuiltInId === p.id}
      type="button"
      role="radio"
      aria-checked={selectedBuiltInId === p.id}
      onclick={() =>
        changeSetting(
          "art_tunnel",
          "preset",
          controller.presetRecipe?.id ?? "custom",
          p.id,
          () => controller.applyPreset(p.id)
        )}
    >
      <PerformerRing config={p.config} size={30} animate={false} />
      <span>{p.name}</span>
    </button>
  {/each}
  <!-- Saved user presets: your personal library, each deletable. -->
  {#each tunnelUserPresets.presets as up (up.id)}
    <div class="preset-card-wrap">
      <button
        class="preset-card user"
        class:active={selectedUserId === up.id}
        type="button"
        role="radio"
          aria-checked={selectedUserId === up.id}
        onclick={() =>
          changeSetting(
            "art_tunnel",
            "preset_source",
            controller.presetRecipe?.kind ?? "custom",
            "saved",
            () => controller.applyUserPreset(up.id, up.name, up.config)
          )}
      >
        <PerformerRing config={up.config} size={30} animate={false} />
        <span>{up.name}</span>
      </button>
      <button
        class="preset-del"
        type="button"
        aria-label={`Delete preset ${up.name}`}
        title="Delete preset"
        onclick={() => {
          const previousCount = tunnelUserPresets.presets.length;
          tunnelUserPresets.remove(up.id);
          reportSetting(
            "art_tunnel",
            "saved_preset_count",
            previousCount,
            Math.max(0, previousCount - 1)
          );
        }}
      >
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  {/each}
  <!-- Custom card: lit when the config matches no preset; opens the tuner. -->
  <button
    class="preset-card"
    class:active={isCustom}
    type="button"
    role="radio"
    aria-checked={isCustom}
    onclick={() => onCustomize("custom_card")}
  >
    <i class="fas fa-sliders" aria-hidden="true"></i>
    <span>Custom</span>
  </button>
</div>

<div class="prim-row">
  <span class="row-lbl">Grid</span>
  <button
    class="grid-toggle"
    class:active={controller.gridVisible}
    type="button"
    aria-pressed={controller.gridVisible}
    aria-label="Toggle grid"
    data-ghost="safe"
    data-ghost-kind="view-toggle"
    data-ghost-label="Toggle grid"
    title="Grid"
    onclick={() =>
      changeSetting(
        "art_tunnel",
        "grid_visible",
        controller.gridVisible,
        !controller.gridVisible,
        () => (controller.gridVisible = !controller.gridVisible)
      )}
  >
    <i class="fas fa-border-all" aria-hidden="true"></i>
  </button>
  <span class="prim-count">{controller.propCount} props</span>
</div>

<button
  class="customize-btn"
  type="button"
  onclick={() => onCustomize("customize_button")}
>
  <i class="fas fa-sliders" aria-hidden="true"></i>
  {controller.presetRecipe ? `Edit ${controller.presetRecipe.name}` : "Edit configuration"}
</button>
{#if onSaveTunnel}
  <button
    data-save-shortcut
    class="customize-btn"
    type="button"
    onclick={() => onSaveTunnel?.()}
  >
    <i class="fas fa-bookmark" aria-hidden="true"></i>
    {saveTunnelLabel}
  </button>
{/if}

<style>
  .rt-section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
  }

  .prim-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
  }
  .prim-row .row-lbl {
    flex: 0 0 52px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
    gap: 6px;
  }
  .preset-card {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    cursor: pointer;
    transition:
      border-color 0.12s ease,
      background 0.12s ease;
  }
  .preset-card i {
    font-size: 14px;
    width: 1.1em;
    text-align: center;
    flex-shrink: 0;
  }
  .preset-card > span {
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preset-card.active {
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-text, #fff);
  }
  .preset-card:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }
  /* Preset-card mini performer-ring keeps its intrinsic size in the flex row. */
  .preset-card :global(svg) {
    flex-shrink: 0;
  }

  .customize-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 10px 16px;
    border: 1.5px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }
  .customize-btn:hover {
    background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
  }
  .customize-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Saved user preset: the select card + a full-height delete column on the
     right (44px tall touch target). */
  .preset-card-wrap {
    position: relative;
    display: flex;
  }
  .preset-card-wrap .preset-card {
    flex: 1;
    min-width: 0;
    padding-right: 34px;
  }
  .preset-del {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 0 10px 10px 0;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    cursor: pointer;
    transition:
      background 0.12s ease,
      color 0.12s ease;
  }
  .preset-del:hover,
  .preset-del:focus-visible {
    background: color-mix(
      in srgb,
      var(--semantic-danger, #ef4444) 18%,
      transparent
    );
    color: var(--semantic-danger, #ef4444);
  }
  .preset-del:focus-visible {
    outline: 2px solid var(--semantic-danger, #ef4444);
    outline-offset: -2px;
  }
  .preset-del i {
    font-size: 11px;
  }

  /* Compact icon toggle for the grid — a small square, keeping the 44px floor. */
  .grid-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: inherit;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .grid-toggle.active {
    background: var(--theme-accent, #8b5cf6);
    border-color: transparent;
    color: #fff;
  }

  .prim-count {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-variant-numeric: tabular-nums;
  }

  /* Dock composition preserves the shared touch floor while tightening gaps. */
  :global(.dock-dense) .preset-grid {
    gap: 4px;
  }
  :global(.dock-dense) .prim-row {
    min-height: 40px;
    gap: 6px;
  }
</style>
