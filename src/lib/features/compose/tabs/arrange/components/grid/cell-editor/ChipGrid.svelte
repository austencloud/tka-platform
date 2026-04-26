<!--
  ChipGrid.svelte

  Renders a flex-wrap grid of 8 control chips for the cell editor panel.
  Each chip is a pill-shaped button that either toggles an expandable
  section or fires a direct action (visibility toggles).
-->
<script lang="ts">
  import type { GridCell } from "../../../state/arrange-grid-state.svelte";
  import type { CellEditorPanelState, ExpandableSection } from "./state/cell-editor-panel-state.svelte";
  import { EFFORTS } from '$lib/features/effort-lab/domain/effort-types';
  import { TUNNEL_LAYER_COLORS } from '$lib/features/compose/compose/domain/types';
  import { getAnimationVisibilityManager } from '$lib/shared/animation-engine/state/animation-visibility-state.svelte';

  let {
    cell,
    panelState,
    onToggleBlueVisibility,
    onToggleRedVisibility,
  }: {
    cell: GridCell;
    panelState: CellEditorPanelState;
    onToggleBlueVisibility: () => void;
    onToggleRedVisibility: () => void;
  } = $props();

  const blueVisible = $derived(cell.blueMotionVisible !== false);
  const redVisible = $derived(cell.redMotionVisible !== false);

  // Effort display: look up real label and color from EFFORTS
  const currentEffort = $derived(EFFORTS.find(e => e.id === cell.effort));
  const effortLabel = $derived(currentEffort?.label || "None");
  const effortColor = $derived(currentEffort?.color || "rgba(255,255,255,0.15)");
  const hasEffort = $derived(!!cell.effort);

  // Color combo display: find which pairing the primary layer uses
  const primaryColors = $derived(cell.layers[0]?.propColors);
  const colorComboIndex = $derived(
    primaryColors
      ? TUNNEL_LAYER_COLORS.findIndex(c => c.left === primaryColors.left && c.right === primaryColors.right)
      : 0
  );
  const colorComboLabels = ['Blue / Red', 'Purple / Orange', 'Emerald / Pink', 'Cyan / Yellow'];
  const colorLabel = $derived(colorComboLabels[colorComboIndex] ?? 'Blue / Red');

  // Effect display - check tipEffectMap first, then flat effect, then global
  const globalVM = getAnimationVisibilityManager();
  const activeEffect = $derived.by(() => {
    // Check tip effect map first for per-tip assignments
    if (cell.tipEffectMap) {
      const values = Object.values(cell.tipEffectMap);
      if (values.length > 0) {
        const effects = values.map(v => v.effect);
        const unique = [...new Set(effects)];
        if (unique.length === 1) return unique[0]!;
        return 'mixed' as const;
      }
    }
    // Fall back to flat effect field
    if (cell.effect && cell.effect !== 'none') return cell.effect;
    // Fall back to global effect
    return globalVM?.getActiveEffect() ?? 'none';
  });
  const effectName = $derived(
    activeEffect === 'mixed' ? 'Mixed'
    : activeEffect !== 'none'
      ? activeEffect.charAt(0).toUpperCase() + activeEffect.slice(1)
      : "None"
  );
  const hasEffect = $derived(activeEffect !== 'none');
  const isGlobalEffect = $derived(!cell.effect && !cell.tipEffectMap && activeEffect !== 'none');

  // Speed display
  const speedLabel = $derived(
    cell.speedMultiplier !== undefined ? `${cell.speedMultiplier}x` : "1.0x"
  );

  // Offset display
  const offsetLabel = $derived(`Offset: ${cell.beatOffset}`);

  // Media type display
  const mediaLabel = $derived(
    cell.mediaType === "choreo-card"
      ? "Card"
      : cell.mediaType === "animation"
        ? "Animation"
        : cell.mediaType
  );

  interface ChipDef {
    id: ExpandableSection | null;
    icon: string;
    label: string;
    action: () => void;
    activeColor?: string;
    isActive?: boolean;
    isMuted?: boolean;
    isExpandable: boolean;
  }

  interface ChipGroup {
    label: string;
    chips: ChipDef[];
  }

  const groups: ChipGroup[] = $derived([
    {
      label: "View",
      chips: [
        {
          id: "effects" as ExpandableSection,
          icon: "fa-wind",
          label: effectName,
          action: () => panelState.toggleSection("effects"),
          activeColor: hasEffect ? "#f97316" : undefined,
          isActive: hasEffect,
          isExpandable: true,
        },
        {
          id: null,
          icon: blueVisible ? "fa-eye" : "fa-eye-slash",
          label: "Blue",
          action: onToggleBlueVisibility,
          activeColor: blueVisible ? "#60a5fa" : undefined,
          isActive: blueVisible,
          isMuted: !blueVisible,
          isExpandable: false,
        },
        {
          id: null,
          icon: redVisible ? "fa-eye" : "fa-eye-slash",
          label: "Red",
          action: onToggleRedVisibility,
          activeColor: redVisible ? "#dc2626" : undefined,
          isActive: redVisible,
          isMuted: !redVisible,
          isExpandable: false,
        },
      ],
    },
    {
      label: "Timing",
      chips: [
        {
          id: "speed" as ExpandableSection,
          icon: "fa-gauge-high",
          label: speedLabel,
          action: () => panelState.toggleSection("speed"),
          isExpandable: true,
        },
        {
          id: "offset" as ExpandableSection,
          icon: "fa-drum",
          label: offsetLabel,
          action: () => panelState.toggleSection("offset"),
          isExpandable: true,
        },
      ],
    },
    {
      label: "Style",
      chips: [
        {
          id: "transform" as ExpandableSection,
          icon: "fa-rotate",
          label: "Transform",
          action: () => panelState.toggleSection("transform"),
          isExpandable: true,
        },
        {
          id: "colors" as ExpandableSection,
          icon: "fa-palette",
          label: colorLabel,
          action: () => panelState.toggleSection("colors"),
          isExpandable: true,
        },
        {
          id: "effort" as ExpandableSection,
          icon: "",
          label: effortLabel,
          action: () => panelState.toggleSection("effort"),
          activeColor: hasEffort ? effortColor : undefined,
          isActive: hasEffort,
          isExpandable: true,
        },
        {
          id: "display" as ExpandableSection,
          icon: "fa-film",
          label: mediaLabel,
          action: () => panelState.toggleSection("display"),
          isExpandable: true,
        },
      ],
    },
  ]);

  function isExpanded(chip: ChipDef): boolean {
    return chip.isExpandable && chip.id !== null && panelState.expandedSection === chip.id;
  }
</script>

<div class="chip-groups">
  {#each groups as group}
    <div class="chip-group">
      <span class="group-label">{group.label}</span>
      <div class="chip-row">
        {#each group.chips as chip}
          <button
            class="chip"
            class:active={chip.isActive && chip.activeColor}
            class:muted={chip.isMuted}
            class:expanded={isExpanded(chip)}
            style:--chip-color={chip.activeColor || "transparent"}
            onclick={chip.action}
            aria-label={chip.label}
          >
            {#if chip.icon}
              <i class="fas {chip.icon} chip-icon" aria-hidden="true"></i>
            {:else}
              <span
                class="effort-dot"
                class:has-effort={hasEffort}
                style:background={hasEffort ? effortColor : undefined}
                style:border-color={hasEffort ? effortColor : undefined}
              ></span>
            {/if}
            <span class="chip-label">{chip.label}</span>
            {#if chip.isExpandable}
              <i
                class="fas fa-chevron-right chevron"
                class:rotated={isExpanded(chip)}
                aria-hidden="true"
              ></i>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .chip-groups {
    display: flex;
    flex-direction: column;
    gap: var(--group-gap, clamp(10px, 2.5cqi, 14px));
  }

  .chip-group {
    display: flex;
    flex-direction: column;
    gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  }

  .group-label {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: clamp(4px, 1cqi, 6px);
    min-height: 44px;
    padding: 8px clamp(12px, 3cqi, 14px);
    border-radius: var(--chip-radius, 22px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
    font-size: clamp(0.75rem, 2.5cqi, 0.85rem);
    cursor: pointer;
    transition:
      background 150ms ease,
      border-color 150ms ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: var(--stroke-hover, rgba(255, 255, 255, 0.15));
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color) var(--surface-active-pct, 12%), transparent);
    border-color: color-mix(in srgb, var(--chip-color) var(--stroke-active-pct, 35%), transparent);
  }

  .chip.active:hover {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
  }

  .chip.expanded {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
  }

  .chip.muted {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .chip.muted:hover {
    background: var(--surface-idle, rgba(255, 255, 255, 0.05));
    border-color: var(--stroke-idle, rgba(255, 255, 255, 0.08));
  }

  .chip-icon {
    font-size: clamp(11px, 3cqi, 13px);
    flex-shrink: 0;
  }

  .chip-label {
    line-height: 1;
  }

  .effort-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .effort-dot.has-effort {
    background: #a855f7;
    border-color: rgba(168, 85, 247, 0.6);
  }

  .chevron {
    font-size: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    transition: transform 150ms ease;
    margin-left: 2px;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  @container celleditorpanel (max-width: 280px) {
    .chip {
      flex: 1 0 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .chevron {
      transition: none;
    }
  }
</style>
