<script lang="ts">
  /**
   * ThreeStateToggle
   * A 3-state selector: Inherit | Grant | Deny
   * Core primitive for feature override management
   */

  import type { OverrideState } from "./feature-utils";

  interface Props {
    value: OverrideState;
    inheritLabel?: string;
    inheritResolvesTo?: boolean; // What "inherit" resolves to for visual hint
    disabled?: boolean;
    compact?: boolean;
    onchange: (state: OverrideState) => void;
  }

  let {
    value,
    inheritLabel = "Inherit",
    inheritResolvesTo,
    disabled = false,
    compact = false,
    onchange,
  }: Props = $props();

  const states: { id: OverrideState; icon: string; label: string }[] = [
    { id: "inherit", icon: "fa-link", label: inheritLabel },
    { id: "grant", icon: "fa-check", label: "Grant" },
    { id: "deny", icon: "fa-ban", label: "Deny" },
  ];
</script>

<div class="three-state-toggle" class:compact class:disabled>
  {#each states as state}
    <button
      type="button"
      class="toggle-option"
      class:selected={value === state.id}
      class:inherit={state.id === "inherit"}
      class:grant={state.id === "grant"}
      class:deny={state.id === "deny"}
      class:resolves-granted={state.id === "inherit" && inheritResolvesTo === true}
      class:resolves-denied={state.id === "inherit" && inheritResolvesTo === false}
      {disabled}
      onclick={() => onchange(state.id)}
      aria-pressed={value === state.id}
      aria-label={compact ? state.label : undefined}
    >
      <i class="fas {state.icon}" aria-hidden="true"></i>
      {#if !compact}
        <span class="label">{state.label}</span>
      {/if}
      {#if state.id === "inherit" && inheritResolvesTo !== undefined && !compact}
        <span class="resolve-hint" class:granted={inheritResolvesTo} class:denied={!inheritResolvesTo}>
          {inheritResolvesTo ? "✓" : "✗"}
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .three-state-toggle {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .three-state-toggle.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .toggle-option {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    min-height: 44px; /* Accessibility: touch target */
  }

  .compact .toggle-option {
    padding: 8px 10px;
    min-height: 40px; /* Compact but still accessible */
    gap: 4px;
  }

  .toggle-option:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .toggle-option:active:not(:disabled) {
    transform: scale(0.97);
  }

  /* Selected states */
  .toggle-option.selected.inherit {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
  }

  .toggle-option.selected.inherit.resolves-granted {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .toggle-option.selected.inherit.resolves-denied {
    background: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
  }

  .toggle-option.selected.grant {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.3);
  }

  .toggle-option.selected.deny {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3);
  }

  .toggle-option i {
    font-size: var(--font-size-sm, 14px);
  }

  .label {
    white-space: nowrap;
  }

  .resolve-hint {
    font-size: var(--font-size-compact, 12px);
    padding: 2px 5px;
    border-radius: 4px;
    font-weight: 600;
  }

  .resolve-hint.granted {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .resolve-hint.denied {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  /* Responsive - stack vertically on very small screens */
  @media (max-width: 360px) {
    .three-state-toggle:not(.compact) {
      flex-direction: column;
    }

    .toggle-option {
      justify-content: flex-start;
    }
  }
</style>
