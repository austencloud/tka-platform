# LOOP Filter Chip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a color-coded LOOP dropdown filter chip to the browse filter bar, filtering by the 6 LOOP primitives with halved/quartered Rotated distinction.

**Architecture:** New `LOOPFilterChip.svelte` wired into `BrowseFilterBar`. Backend `filterByLOOPType` extended to match `seq.components` array + `seq.period`. Engine `loopTypeCounts` extended with per-component counts. Dead `PatternFilterChip` deleted.

**Tech Stack:** Svelte 5 ($state/$derived), FilterChipBase, LOOPComponent enum, LOOP_COMPONENT_MAP constants

---

### Task 1: Extend BrowseFilter to handle component-based LOOP filtering

**Files:**
- Modify: `src/lib/features/browse/sequences/display/services/implementations/BrowseFilter.ts:401-434`

- [ ] **Step 1: Add component-based filter branch to `filterByLOOPType`**

Add handling for `component:*` prefixed values at the top of `filterByLOOPType`, before the existing logic. This checks `seq.components` array membership and, for rotated, cross-references `seq.period`.

In `BrowseFilter.ts`, add this import at the top of the file alongside the existing LOOPType import:

```typescript
import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
```

Then replace the `filterByLOOPType` method (lines ~401-434) with:

```typescript
  private filterByLOOPType(
    sequences: SequenceData[],
    filterValue: BrowseFilterValue
  ): SequenceData[] {
    if (!filterValue) {
      return sequences;
    }

    const filterStr = String(filterValue);

    // Component-based filtering (new): "component:rotated_halved", "component:mirrored", etc.
    if (filterStr.startsWith("component:")) {
      return this.filterByLOOPComponent(sequences, filterStr.slice("component:".length));
    }

    // Special case: filter all circular sequences
    if (filterStr === "circular" || filterStr === "all_circular") {
      return sequences.filter((seq) => seq.isCircular === true);
    }

    // Special case: filter all non-circular sequences
    if (filterStr === "non_circular") {
      return sequences.filter((seq) => !seq.isCircular);
    }

    // Special case: circular but no specific LOOP type detected
    if (filterStr === "circular_untyped") {
      return sequences.filter((seq) => seq.isCircular && !seq.loopType);
    }

    // Filter by specific LOOP type
    return sequences.filter((seq) => {
      if (!seq.isCircular) return false;
      return seq.loopType === filterStr;
    });
  }

  private filterByLOOPComponent(
    sequences: SequenceData[],
    componentKey: string
  ): SequenceData[] {
    if (componentKey === "rotated_halved") {
      return sequences.filter(
        (seq) =>
          seq.components?.includes(LOOPComponent.ROTATED) &&
          (seq.period ?? 2) <= 2
      );
    }
    if (componentKey === "rotated_quartered") {
      return sequences.filter(
        (seq) =>
          seq.components?.includes(LOOPComponent.ROTATED) &&
          (seq.period ?? 2) === 4
      );
    }

    const componentEnum = componentKey as LOOPComponent;
    return sequences.filter(
      (seq) => seq.components?.includes(componentEnum)
    );
  }
```

- [ ] **Step 2: Verify build passes**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/sequences/display/services/implementations/BrowseFilter.ts
git commit -m "feat(browse): extend LOOP filter to support component-based filtering"
```

---

### Task 2: Extend engine loopTypeCounts with per-component counts

**Files:**
- Modify: `src/lib/shared/browse/engine/createBrowseEngine.svelte.ts:240-258`

- [ ] **Step 1: Add LOOPComponent import**

At the top of `createBrowseEngine.svelte.ts`, add:

```typescript
import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
```

- [ ] **Step 2: Extend the `loopTypeCounts` derived block**

Replace the `loopTypeCounts` derived (lines ~240-258) with:

```typescript
	const loopTypeCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		let circularCount = 0;
		const total = allSequences.length;

		// Per-component counters
		let rotatedHalvedCount = 0;
		let rotatedQuarteredCount = 0;
		const componentCounts = new Map<LOOPComponent, number>();

		for (const seq of allSequences) {
			if (seq.isCircular) {
				circularCount++;
				if (seq.loopType) {
					counts[seq.loopType] = (counts[seq.loopType] ?? 0) + 1;
				}
			}

			if (seq.components) {
				for (const comp of seq.components) {
					componentCounts.set(comp, (componentCounts.get(comp) ?? 0) + 1);
				}
				if (seq.components.includes(LOOPComponent.ROTATED)) {
					if ((seq.period ?? 2) === 4) {
						rotatedQuarteredCount++;
					} else {
						rotatedHalvedCount++;
					}
				}
			}
		}

		counts["_total"] = total;
		counts["_circular"] = circularCount;
		counts["_non_circular"] = total - circularCount;

		// Component counts keyed as "component:<name>"
		counts["component:rotated_halved"] = rotatedHalvedCount;
		counts["component:rotated_quartered"] = rotatedQuarteredCount;
		for (const comp of [
			LOOPComponent.MIRRORED,
			LOOPComponent.FLIPPED,
			LOOPComponent.SWAPPED,
			LOOPComponent.INVERTED,
			LOOPComponent.REWOUND,
		]) {
			counts[`component:${comp}`] = componentCounts.get(comp) ?? 0;
		}

		return counts;
	});
```

- [ ] **Step 3: Verify build passes**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/browse/engine/createBrowseEngine.svelte.ts
git commit -m "feat(browse): add per-component LOOP counts to engine"
```

---

### Task 3: Create LOOPFilterChip component

**Files:**
- Create: `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/LOOPFilterChip.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
LOOPFilterChip.svelte - Dropdown chip for LOOP component filtering.
Color-coded icons per primitive. Rotated splits into halved/quartered.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import FilterChipBase from "../FilterChipBase.svelte";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { LOOP_COMPONENT_MAP } from "$lib/features/create/generate/shared/domain/constants/loop-constants";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";

  interface Props {
    activeValue: string | null;
    loopTypeCounts: Readonly<Record<string, number>>;
    onSelect: (value: string | null) => void;
  }

  let { activeValue, loopTypeCounts, onSelect }: Props = $props();

  let isOpen = $state(false);
  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = getHapticFeedback() ?? null;
  });

  interface LOOPFilterOption {
    value: string | null;
    label: string;
    icon: string;
    color: string;
    count?: number;
  }

  const rotatedInfo = LOOP_COMPONENT_MAP.get(LOOPComponent.ROTATED)!;

  const filterOptions: LOOPFilterOption[] = [
    { value: null, label: "All", icon: "", color: "" },
    {
      value: "component:rotated_halved",
      label: "Rotated (halved)",
      icon: "fas fa-rotate",
      color: rotatedInfo.color,
    },
    {
      value: "component:rotated_quartered",
      label: "Rotated (quartered)",
      icon: "fas fa-arrows-spin",
      color: rotatedInfo.color,
    },
    ...[
      LOOPComponent.MIRRORED,
      LOOPComponent.FLIPPED,
      LOOPComponent.SWAPPED,
      LOOPComponent.INVERTED,
      LOOPComponent.REWOUND,
    ].map((comp) => {
      const info = LOOP_COMPONENT_MAP.get(comp)!;
      return {
        value: `component:${comp}`,
        label: info.label,
        icon: `fas fa-${info.icon}`,
        color: info.color,
      };
    }),
  ];

  const selectedOption = $derived(
    filterOptions.find((o) => o.value === activeValue) ?? filterOptions[0]
  );

  const chipLabel = $derived(
    activeValue ? selectedOption.label : "LOOP"
  );

  const chipColor = $derived(
    activeValue ? selectedOption.color : "#8b5cf6"
  );

  const isActive = $derived(activeValue !== null);

  const optionsWithCounts = $derived.by(() => {
    if (!isOpen) return filterOptions;
    return filterOptions.map((opt) => ({
      ...opt,
      count: opt.value ? (loopTypeCounts[opt.value] ?? 0) : undefined,
    }));
  });

  function handleToggle() {
    isOpen = !isOpen;
  }

  function handleSelect(value: string | null) {
    hapticService?.trigger("selection");
    onSelect(value);
    isOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".loop-chip-wrapper")) {
      isOpen = false;
    }
  }

  $effect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside, true);
  });
</script>

<div class="loop-chip-wrapper">
  <FilterChipBase
    label={chipLabel}
    icon="fas fa-sync-alt"
    active={isActive}
    chipColor={chipColor}
    mode="dropdown"
    expanded={isOpen}
    onclick={handleToggle}
  >
    {#snippet children()}
      {#each optionsWithCounts as option}
        <button
          class="popover-option"
          class:selected={activeValue === option.value}
          style={option.value === activeValue && option.color
            ? `color: ${option.color};`
            : ""}
          type="button"
          role="option"
          aria-selected={activeValue === option.value}
          onclick={() => handleSelect(option.value)}
        >
          <span class="option-content">
            {#if option.icon}
              <i
                class={option.icon}
                style="color: {option.color};"
                aria-hidden="true"
              ></i>
            {/if}
            <span>
              {option.label}
              {#if option.count != null}
                <span class="option-count">({option.count})</span>
              {/if}
            </span>
          </span>
          {#if activeValue === option.value}
            <i class="fas fa-check" aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    {/snippet}
  </FilterChipBase>
</div>

<style>
  .loop-chip-wrapper {
    position: relative;
  }

  .popover-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .popover-option:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .popover-option.selected {
    font-weight: 600;
  }

  .popover-option > i {
    font-size: 10px;
  }

  .option-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .option-content > i {
    width: 16px;
    text-align: center;
    font-size: 13px;
    flex-shrink: 0;
  }

  .option-count {
    opacity: 0.6;
    font-weight: 400;
    margin-left: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .popover-option {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/sequences/filtering/components/inline-filter/chips/LOOPFilterChip.svelte
git commit -m "feat(browse): add LOOPFilterChip with color-coded component icons"
```

---

### Task 4: Wire LOOPFilterChip into BrowseFilterBar

**Files:**
- Modify: `src/lib/shared/browse/components/BrowseFilterBar.svelte`

- [ ] **Step 1: Add import and derived state**

Add the import alongside the existing chip imports (after line 13):

```typescript
  import LOOPFilterChip from "$lib/features/browse/sequences/filtering/components/inline-filter/chips/LOOPFilterChip.svelte";
```

Add derived state for the active LOOP value (after the `hasLengthConstraint` derived, ~line 48):

```typescript
  const activeLoopComponent = $derived.by(() => {
    const f = engine.activeFilters.get("cap_type");
    return f ? (f.value as string) : null;
  });
```

- [ ] **Step 2: Add handler**

Add the handler (after `handleLengthSelect`, ~line 70):

```typescript
  function handleLoopSelect(value: string | null) {
    hapticService?.trigger("selection");
    if (value == null) engine.removeFilter("cap_type");
    else {
      const label = value.startsWith("component:")
        ? value.slice("component:".length).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : value;
      const info = LOOP_FILTER_COLORS[value];
      engine.addFilter(BrowseFilterType.LOOP_TYPE, value, label, info ?? "#8b5cf6");
    }
  }
```

Add the color lookup map in the `<script>` block (after the imports):

```typescript
  const LOOP_FILTER_COLORS: Record<string, string> = {
    "component:rotated_halved": "#36c3ff",
    "component:rotated_quartered": "#36c3ff",
    "component:mirrored": "#6F2DA8",
    "component:flipped": "#e91e63",
    "component:swapped": "#26e600",
    "component:inverted": "#eb7d00",
    "component:rewound": "#00bcd4",
  };
```

- [ ] **Step 3: Add chip to template**

After the `LengthFilterChip` block (after the `{/if}` on ~line 104), add:

```svelte
    <LOOPFilterChip
      activeValue={activeLoopComponent}
      loopTypeCounts={engine.loopTypeCounts}
      onSelect={handleLoopSelect}
    />
```

- [ ] **Step 4: Verify build passes**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/browse/components/BrowseFilterBar.svelte
git commit -m "feat(browse): wire LOOPFilterChip into filter bar"
```

---

### Task 5: Delete dead PatternFilterChip

**Files:**
- Delete: `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/PatternFilterChip.svelte`

- [ ] **Step 1: Verify PatternFilterChip is not imported anywhere**

Run: `grep -r "PatternFilterChip" src/ --include="*.svelte" --include="*.ts" -l`
Expected: Only the file itself (no consumers)

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/features/browse/sequences/filtering/components/inline-filter/chips/PatternFilterChip.svelte
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/sequences/filtering/components/inline-filter/chips/PatternFilterChip.svelte
git commit -m "chore: remove dead PatternFilterChip (replaced by LOOPFilterChip)"
```

---

### Task 6: Visual verification

- [ ] **Step 1: Open browse tab in browser and verify the LOOP chip appears in the filter row**

Navigate to the browse sequences view. Confirm:
- LOOP chip shows in the filter chip row after the Length chip
- Chip displays "LOOP" label with `fa-sync-alt` icon when inactive
- Chip uses purple (`#8b5cf6`) border tint when inactive

- [ ] **Step 2: Open the dropdown and verify all 7 options render**

Click the LOOP chip. Confirm:
- "All" option at top (no icon)
- "Rotated (halved)" with blue `fa-rotate` icon
- "Rotated (quartered)" with blue `fa-arrows-spin` icon
- "Mirrored" with purple `fa-left-right` icon
- "Flipped" with pink `fa-up-down` icon
- "Swapped" with green `fa-shuffle` icon
- "Inverted" with orange `fa-adjust` icon
- "Rewound" with cyan `fa-backward` icon
- Each shows count in parentheses
- Icons render in their component colors

- [ ] **Step 3: Select a LOOP type and verify filtering works**

Click "Rotated (halved)". Confirm:
- Chip label changes to "Rotated (halved)"
- Chip accent color changes to `#36c3ff` (blue)
- Browse gallery filters to only sequences containing ROTATED component with period ≤ 2
- Active filter chip appears in the active bar below with dismiss button
- Clicking dismiss clears the filter

- [ ] **Step 4: Verify "All" clears the filter**

With a LOOP filter active, open dropdown and click "All". Confirm the filter clears and all sequences return.
