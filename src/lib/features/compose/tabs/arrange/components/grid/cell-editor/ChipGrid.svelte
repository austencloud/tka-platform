<!--
  ChipGrid.svelte

  Renders a flex-wrap grid of 8 control chips for the cell editor panel.
  Each chip is a pill-shaped button that either toggles an expandable
  section or fires a direct action (visibility toggles).
-->
<script lang="ts">
  import type { GridCell } from "../../../state/arrange-grid-state.svelte";
  import type { CellEditorPanelState, ExpandableSection } from "./state/cell-editor-panel-state.svelte";

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

  // Effort display: colored dot when set
  const effortLabel = $derived(cell.effort || "None");
  const hasEffort = $derived(!!cell.effort);

  // Effect display
  const effectName = $derived(
    cell.effect && cell.effect !== "none"
      ? cell.effect.charAt(0).toUpperCase() + cell.effect.slice(1)
      : "None"
  );
  const hasEffect = $derived(cell.effect !== undefined && cell.effect !== "none");

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
    id: ExpandableSection;
    icon: string;
    label: string;
    action: () => void;
    activeColor?: string;
    isActive?: boolean;
    isMuted?: boolean;
    isExpandable: boolean;
  }

  const chips: ChipDef[] = $derived([
    {
      id: "transform" as ExpandableSection,
      icon: "fa-rotate",
      label: "Transform",
      action: () => panelState.toggleSection("transform"),
      isExpandable: true,
    },
    {
      id: "speed" as ExpandableSection,
      icon: "fa-gauge-high",
      label: speedLabel,
      action: () => panelState.toggleSection("speed"),
      isExpandable: true,
    },
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
      activeColor: blueVisible ? "#2563eb" : undefined,
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
    {
      id: "effort" as ExpandableSection,
      icon: "",
      label: effortLabel,
      action: () => panelState.toggleSection("effort"),
      activeColor: hasEffort ? "#a855f7" : undefined,
      isActive: hasEffort,
      isExpandable: true,
    },
    {
      id: "offset" as ExpandableSection,
      icon: "fa-drum",
      label: offsetLabel,
      action: () => panelState.toggleSection("offset"),
      isExpandable: true,
    },
    {
      id: "display" as ExpandableSection,
      icon: "fa-film",
      label: mediaLabel,
      action: () => panelState.toggleSection("display"),
      isExpandable: true,
    },
  ]);

  function isExpanded(chip: ChipDef): boolean {
    return chip.isExpandable && chip.id !== null && panelState.expandedSection === chip.id;
  }
</script>

<div class="chip-grid">
  {#each chips as chip}
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
        <!-- Effort dot indicator -->
        <span
          class="effort-dot"
          class:has-effort={hasEffort}
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

<style>
  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 1.5cqi, 8px);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: clamp(4px, 1cqi, 6px);
    min-height: 44px;
    padding: 8px 14px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--theme-text, white);
    font-size: clamp(0.75rem, 2.5cqi, 0.85rem);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  /* Active state: tinted by chip color */
  .chip.active {
    background: color-mix(in srgb, var(--chip-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 35%, transparent);
  }

  .chip.active:hover {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
  }

  /* Expanded state: highlighted border to show which section is open */
  .chip.expanded {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--theme-accent, #8b5cf6);
  }

  /* Muted state: dimmed for visibility-off chips */
  .chip.muted {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .chip.muted:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
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
    transition: transform var(--duration-fast, 150ms) ease;
    margin-left: 2px;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .chevron {
      transition: none;
    }
  }
</style>
