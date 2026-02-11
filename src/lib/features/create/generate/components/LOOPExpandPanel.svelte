<!--
LOOPExpandPanel.svelte - LOOP type selection panel for the compact toolbar.

Manages internal toggle selection state and validates combinations
before committing to the parent config via updateConfig callback.
-->
<script lang="ts">
  import {
    LOOPComponent,
  } from "../shared/domain/models/generate-models";
  import type { LOOPType } from "../shared/domain/models/generate-models";
  import {
    LOOP_TYPE_LABELS,
  } from "../circular/domain/models/circular-models";
  import { LOOP_COMPONENTS } from "../shared/domain/constants/loop-constants";
  import { loopTypeResolver } from "../shared/services/implementations/LOOPTypeResolver";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  let {
    loopType,
    isFreeformMode,
    haptic,
    updateLoopType,
  }: {
    loopType: string | null;
    isFreeformMode: boolean;
    haptic: IHapticFeedback | null;
    updateLoopType: (type: string) => void;
  } = $props();

  // ============================================================================
  // LOCAL SELECTION STATE
  // ============================================================================
  let localLoopSelection = $state<Set<LOOPComponent>>(new Set());
  let isValidLoopCombo = $state(true);

  // Sync from parent config when loopType changes
  $effect(() => {
    if (!isFreeformMode && loopType) {
      localLoopSelection = loopTypeResolver.parseComponents(loopType as LOOPType);
      isValidLoopCombo = true;
    }
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================
  function isRoundTripValid(components: Set<LOOPComponent>): boolean {
    if (components.size === 0) return true;
    const type = loopTypeResolver.generateLOOPType(components);
    const parsed = loopTypeResolver.parseComponents(type);
    if (parsed.size !== components.size) return false;
    for (const c of components) {
      if (!parsed.has(c)) return false;
    }
    return true;
  }

  // ============================================================================
  // TOGGLE HANDLER
  // ============================================================================
  function handleLoopToggle(component: LOOPComponent) {
    haptic?.trigger("selection");
    const newSet = new Set(localLoopSelection);
    if (newSet.has(component)) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }
    localLoopSelection = newSet;
    if (newSet.size === 0) {
      isValidLoopCombo = true;
    } else {
      const valid = isRoundTripValid(newSet);
      isValidLoopCombo = valid;
      if (valid) {
        updateLoopType(loopTypeResolver.generateLOOPType(newSet));
      }
    }
  }
</script>

<div class="loop-panel">
  <div class="loop-toggle-grid">
    {#each LOOP_COMPONENTS as info}
      {@const isActive = localLoopSelection.has(info.component)}
      <button
        class="loop-toggle-chip"
        class:active={isActive}
        onclick={() => handleLoopToggle(info.component)}
        style:--chip-color={info.color}
        aria-pressed={isActive}
        aria-label="{info.label}: {isActive ? 'on' : 'off'}"
      >
        <i class="fas fa-{info.icon}" aria-hidden="true"></i>
        <span>{info.label}</span>
      </button>
    {/each}
  </div>
  {#if !isValidLoopCombo}
    <div class="combo-hint" role="status">
      <i class="fas fa-flask" aria-hidden="true"></i>
      Invalid combination
    </div>
  {/if}
</div>

<style>
  .loop-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .loop-toggle-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
  }

  .loop-toggle-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    min-height: 48px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.25);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .loop-toggle-chip:active {
    transform: scale(0.96);
  }

  .loop-toggle-chip.active {
    background: rgba(255, 255, 255, 0.2);
    border-color: var(--chip-color, rgba(255, 255, 255, 0.5));
    color: #fff;
  }

  .loop-toggle-chip.active i {
    color: var(--chip-color, var(--theme-accent));
  }

  .loop-toggle-chip i {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    transition: color 100ms ease;
  }

  .combo-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--semantic-warning, #f59e0b);
    padding: 2px 6px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 6px;
  }

  .combo-hint i {
    font-size: 10px;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .loop-toggle-chip {
      transition: none;
    }
  }
</style>
