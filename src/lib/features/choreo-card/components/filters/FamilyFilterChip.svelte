<!--
FamilyFilterChip.svelte - Multi-select filter chip for deck family filtering.
Shows motion type pills (parsed from typeCombo) in a dropdown popover.
Supports selecting multiple families simultaneously; "All Families" clears selection.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import type { CatalogFamily } from "$lib/features/choreo-card/domain/models/Catalog";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    families: readonly CatalogFamily[];
    selectedFamilyIds: string[];
    onFilterChange: (familyIds: string[]) => void;
  }

  let { families: rawFamilies, selectedFamilyIds, onFilterChange }: Props = $props();

  // Deduplicate families by ID to prevent Svelte keyed-each errors
  const families = $derived.by(() => {
    const seen = new Set<string>();
    return rawFamilies.filter(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  });

  let isOpen = $state(false);
  let hapticService: HapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  // ── Motion type metadata ─────────────────────────────────────────────────

  const MOTION_TYPE_INFO: Record<string, { abbrev: string; colors: [string, string] }> = {
    "Dual-Shift":  { abbrev: "DS", colors: ["#36c3ff", "#6F2DA8"] },
    "Shift":       { abbrev: "Sh", colors: ["#6F2DA8", "#6F2DA8"] },
    "Cross-Shift": { abbrev: "CS", colors: ["#26e600", "#6F2DA8"] },
    "Dash":        { abbrev: "D",  colors: ["#26e600", "#26e600"] },
    "Dual-Dash":   { abbrev: "DD", colors: ["#00b3ff", "#26e600"] },
    "Static":      { abbrev: "St", colors: ["#eb7d00", "#eb7d00"] },
  };

  interface PillData {
    abbrev: string;
    colors: [string, string];
    isDual: boolean;
  }

  function parsePills(typeCombo: string): PillData[] {
    return typeCombo.split("+").map((seg) => {
      const name = seg.trim();
      const info = MOTION_TYPE_INFO[name];
      const colors: [string, string] = info?.colors ?? ["#888", "#888"];
      return { abbrev: info?.abbrev ?? name, colors, isDual: colors[0] !== colors[1] };
    });
  }

  // ── Derived label ────────────────────────────────────────────────────────

  const chipLabel = $derived.by(() => {
    if (selectedFamilyIds.length === 0) return "Family";
    if (selectedFamilyIds.length === 1) {
      const match = families.find((f) => f.id === selectedFamilyIds[0]);
      return match?.label ?? "Family";
    }
    return `${selectedFamilyIds.length} families`;
  });

  const isActive = $derived(selectedFamilyIds.length > 0);
  const selectedCount = $derived(selectedFamilyIds.length > 0 ? selectedFamilyIds.length : null);

  // ── Interaction handlers ─────────────────────────────────────────────────

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelectAll() {
    hapticService?.trigger("selection");
    onFilterChange([]);
    isOpen = false;
  }

  function handleToggleFamily(familyId: string) {
    hapticService?.trigger("selection");
    const isSelected = selectedFamilyIds.includes(familyId);
    if (isSelected) {
      onFilterChange(selectedFamilyIds.filter((id) => id !== familyId));
    } else {
      onFilterChange([...selectedFamilyIds, familyId]);
    }
    // Keep dropdown open for multi-select - user closes explicitly or clicks outside
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".family-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

<div class="family-chip-wrapper">
  <FilterChipBase
    label={chipLabel}
    icon="fas fa-project-diagram"
    active={isActive}
    count={selectedCount}
    chipColor="#8b5cf6"
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
  >
    {#snippet children()}
      <!-- All Families (clear) -->
      <button
        class="popover-option all-option"
        class:selected={selectedFamilyIds.length === 0}
        type="button"
        role="option"
        aria-selected={selectedFamilyIds.length === 0}
        aria-label="All Families"
        onclick={handleSelectAll}
      >
        <span class="option-label">All Families</span>
        {#if selectedFamilyIds.length === 0}
          <i class="fas fa-check check-icon" aria-hidden="true"></i>
        {/if}
      </button>

      <div class="popover-separator" role="separator"></div>

      <!-- Individual families -->
      {#each families as family (family.id)}
        {@const isSelected = selectedFamilyIds.includes(family.id)}
        {@const pills = parsePills(family.typeCombo)}
        <button
          class="popover-option family-option"
          class:selected={isSelected}
          type="button"
          role="option"
          aria-selected={isSelected}
          aria-label="Filter by {family.typeCombo} family"
          onclick={() => handleToggleFamily(family.id)}
        >
          <span class="family-left">
            <span class="pills-row">
              {#each pills as pill (pill.abbrev)}
                <span
                  class="motion-pill"
                  class:dual={pill.isDual}
                  style="--c1: {pill.colors[0]}; --c2: {pill.colors[1]};"
                  aria-label={pill.abbrev}
                >
                  {pill.abbrev}
                </span>
              {/each}
            </span>
            <span class="family-label">{family.label}</span>
          </span>

          <span class="family-right">
            <span class="seq-count">{family.sequenceIds.length}</span>
            {#if isSelected}
              <i class="fas fa-check check-icon" aria-hidden="true"></i>
            {/if}
          </span>
        </button>
      {/each}
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .family-chip-wrapper {
    position: relative;
  }

  /* ── Popover options ──────────────────────────────────────────────────── */

  .popover-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .popover-option:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .popover-option.selected {
    color: var(--family-accent, #8b5cf6);
    font-weight: 600;
  }

  .all-option .option-label {
    font-size: var(--font-size-min, 14px);
  }

  /* ── Separator ────────────────────────────────────────────────────────── */

  .popover-separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* ── Family row internals ─────────────────────────────────────────────── */

  .family-option {
    gap: 8px;
  }

  .family-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .family-label {
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .family-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* ── Sequence count badge ─────────────────────────────────────────────── */

  .seq-count {
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    opacity: 0.55;
  }

  /* ── Check icon ───────────────────────────────────────────────────────── */

  .check-icon {
    font-size: 12px;
    color: var(--family-accent, #8b5cf6);
  }

  /* ── Pills row ────────────────────────────────────────────────────────── */

  .pills-row {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  /* ── Motion type pill ─────────────────────────────────────────────────── */

  .motion-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 3px;
    background: var(--c1);
    color: var(--theme-text, #fff);
    text-shadow: var(--shadow-text, 0 1px 2px rgba(0, 0, 0, 0.5));
    white-space: nowrap;
    line-height: 1.2;
  }

  .motion-pill.dual {
    background: linear-gradient(135deg, var(--c1), var(--c2));
  }

  /* ── Reduced motion ───────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .popover-option {
      transition: none;
    }
  }
</style>
