<script lang="ts">
  import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/FeatureFlag";
  import { getFeatureIconAndColor, getRoleColor, getRoleIcon } from "../utils";

  interface Props {
    capability: FeatureFlagConfig;
    selected: boolean;
    onSelect: () => void;
  }

  let { capability, selected, onSelect }: Props = $props();

  const style = $derived(getFeatureIconAndColor(capability.id));
</script>

<button
  class="capability-chip"
  class:selected
  class:disabled={!capability.enabled}
  onclick={onSelect}
  aria-label={`Edit ${capability.name} settings`}
  title={capability.description}
>
  <i class="fas {style.icon}" aria-hidden="true" style="color: {style.color}"
  ></i>
  <span class="capability-name">{capability.name}</span>
  <span
    class="role-badge"
    style="background: {getRoleColor(
      capability.minimumRole
    )}20; color: {getRoleColor(capability.minimumRole)}"
  >
    <i class="fas {getRoleIcon(capability.minimumRole)}" aria-hidden="true"></i>
  </span>
  {#if !capability.enabled}
    <i class="fas fa-ban disabled-icon" aria-hidden="true"></i>
  {/if}
</button>

<style>
  .capability-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--min-touch-target);
  }

  .capability-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .capability-chip.selected {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, transparent);
    color: var(--theme-accent, #6366f1);
  }

  .capability-chip.disabled {
    opacity: 0.5;
  }

  .capability-chip i {
    font-size: var(--font-size-sm, 14px);
  }

  .capability-name {
    font-weight: 500;
  }

  .role-badge {
    display: flex;
    align-items: center;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: var(--font-size-compact, 12px);
  }

  .role-badge i {
    font-size: var(--font-size-compact, 12px);
  }

  .disabled-icon {
    color: var(--semantic-error);
    font-size: var(--font-size-compact, 12px);
    margin-left: 2px;
  }
</style>
