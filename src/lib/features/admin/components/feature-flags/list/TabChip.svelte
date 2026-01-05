<script lang="ts">
  import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/FeatureFlag";
  import { getFeatureIconAndColor, getRoleIcon, getRoleColor } from "../utils";

  interface Props {
    tab: FeatureFlagConfig;
    selected: boolean;
    elevated: boolean;
    onSelect: () => void;
  }

  let { tab, selected, elevated, onSelect }: Props = $props();

  const style = $derived(getFeatureIconAndColor(tab.id));
</script>

<button
  class="tab-chip"
  class:selected
  class:disabled={!tab.enabled}
  class:elevated
  onclick={onSelect}
  aria-label={`Edit ${tab.name} settings`}
  title={tab.description}
>
  <i class="fas {style.icon}" aria-hidden="true" style="color: {style.color}"
  ></i>
  <span class="tab-name">{tab.name.replace(" Tab", "")}</span>
  {#if elevated}
    <span
      class="tab-role"
      style="color: {getRoleColor(tab.minimumRole)}"
      title="Elevated: requires {tab.minimumRole}"
    >
      <i class="fas {getRoleIcon(tab.minimumRole)}" aria-hidden="true"></i>
    </span>
  {/if}
  {#if !tab.enabled}
    <i class="fas fa-ban disabled-icon" aria-hidden="true"></i>
  {/if}
</button>

<style>
  .tab-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--min-touch-target);
  }

  .tab-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .tab-chip.selected {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .tab-chip.disabled {
    opacity: 0.5;
  }

  .tab-chip.elevated {
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
  }

  .tab-chip i {
    font-size: var(--font-size-compact, 12px);
  }

  .tab-name {
    font-weight: 500;
  }

  .tab-role {
    font-size: var(--font-size-compact, 12px);
    margin-left: 2px;
  }

  .disabled-icon {
    color: var(--semantic-error);
    font-size: var(--font-size-compact, 12px);
    margin-left: 2px;
  }
</style>
