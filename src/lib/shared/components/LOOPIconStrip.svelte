<!--
LOOPIconStrip.svelte - Horizontal strip of Font Awesome icons for LOOP visualization

Shows only the active LOOP primitives as a compact icon strip.
Uses the user's chosen icons from the Design Lab (2026-01-21):
- Rotated: fa-rotate (halved / 180°) or fa-arrows-spin (quartered / 90°)
- Mirrored: fa-left-right
- Flipped: fa-up-down
- Swapped: fa-shuffle
- Inverted: fa-adjust
- Rewound: fa-backward
- Freeform: fa-infinity

The rotated icon swaps based on rotationPeriod so a performer can tell
at a glance whether the sequence rotates every half (2 reps, 180° each) or
every quarter (4 reps, 90° each) without reading the label.

Used in:
1. Sequence cards (badge overlay)
2. Export headers (choreo card image)
3. Layered sequence preview
-->
<script lang="ts">
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { LOOP_ICON_GAP_SCALE } from "@tka/render-composition";
  import CheckerboardCircleIcon from "$lib/shared/icons/CheckerboardCircleIcon.svelte";

  interface Props {
    activeComponents: Set<LOOPComponent>;
    /**
     * When the ROTATED component is active, this decides between fa-rotate
     * (halved / 180°) and fa-arrows-spin (quartered / 90°). Undefined keeps
     * the legacy fa-rotate default, so any caller that hasn't been updated
     * continues to look the same as before.
     */
    rotationPeriod?: Period;
    inversionPeriod?: Period;
    size?: number;
    darkMode?: boolean;
    showFreeformWhenEmpty?: boolean;
  }

  let {
    activeComponents,
    rotationPeriod,
    inversionPeriod,
    size = 16,
    darkMode = true,
    showFreeformWhenEmpty = true,
  }: Props = $props();

  // Icon configuration - matches Design Lab choices.
  // Rotated's icon + label gets overridden at render time based on
  // rotationPeriod (quartered → fa-arrows-spin). Keeping the map entry
  // as the halved-default means every non-rotated primitive stays driven
  // from a single source of truth.
  // Reserved orientation primitives (ZONE_HOLD_INVERT / FLIP / CROSS) are
  // intentionally absent - see primitive-discovery rule and Phase 2 filter.
  const primitiveIcons: Partial<Record<LOOPComponent, {
    faClass: string;
    color: string;
    label: string;
  }>> & {
    freeform: { faClass: string; color: string; label: string };
  } = {
    [LOOPComponent.ROTATED]: {
      faClass: "fas fa-rotate",
      color: "#36c3ff",
      label: "Rotated",
    },
    [LOOPComponent.MIRRORED]: {
      faClass: "fas fa-left-right",
      color: "#6F2DA8",
      label: "Mirrored",
    },
    [LOOPComponent.FLIPPED]: {
      faClass: "fas fa-up-down",
      color: "#e91e63",
      label: "Flipped",
    },
    [LOOPComponent.SWAPPED]: {
      faClass: "fas fa-shuffle",
      color: "#2ecc71",
      label: "Swapped",
    },
    [LOOPComponent.INVERTED]: {
      faClass: "fas fa-adjust",
      color: "#eb7d00",
      label: "Inverted",
    },
    [LOOPComponent.REWOUND]: {
      faClass: "fas fa-backward",
      color: "#00bcd4",
      label: "Rewound",
    },
    freeform: {
      faClass: "fas fa-infinity",
      color: "#9e9e9e",
      label: "Freeform",
    },
  };

  // Display order for icons (consistent ordering)
  const displayOrder: LOOPComponent[] = [
    LOOPComponent.ROTATED,
    LOOPComponent.MIRRORED,
    LOOPComponent.FLIPPED,
    LOOPComponent.SWAPPED,
    LOOPComponent.INVERTED,
    LOOPComponent.REWOUND,
  ];

  // Filter to only active components, maintaining display order
  const activeList = $derived(
    displayOrder.filter(comp => activeComponents.has(comp))
  );

  // Show freeform icon if no components active and flag is set
  const showFreeform = $derived(
    showFreeformWhenEmpty && activeList.length === 0
  );

  const isQuarteredRotation = $derived(
    rotationPeriod === Period.QUARTERED
  );

  const isQuarteredInversion = $derived(
    inversionPeriod === Period.QUARTERED
  );

  function iconFor(component: LOOPComponent): {
    faClass: string;
    color: string;
    label: string;
    customSvg?: "checkerboard";
  } | null {
    const base = primitiveIcons[component];
    if (!base) return null;
    if (component === LOOPComponent.ROTATED && isQuarteredRotation) {
      return {
        faClass: "fas fa-arrows-spin",
        color: base.color,
        label: "Rotated (quartered)",
      };
    }
    if (component === LOOPComponent.INVERTED && isQuarteredInversion) {
      return {
        ...base,
        label: "Inverted (quartered)",
        customSvg: "checkerboard",
      };
    }
    return base;
  }

  // Generate aria label. When rotation is quartered the label reads
  // "Rotated (quartered)" so screen readers pick up the 90° vs 180°
  // distinction, matching what the icon now communicates visually.
  const ariaLabel = $derived(
    activeList.length > 0
      ? `LOOP: ${activeList
          .map((c) => iconFor(c)?.label)
          .filter((l): l is string => typeof l === "string")
          .join(", ")}`
      : "Freeform LOOP"
  );

  // Gap uses shared constant from @tka/render-composition
  const gap = $derived(Math.max(2, Math.round(size * LOOP_ICON_GAP_SCALE)));
</script>

<div
  class="loop-icon-strip"
  class:dark={darkMode}
  role="img"
  aria-label={ariaLabel}
  style="gap: {gap}px;"
>
  {#if showFreeform}
    <i
      class={primitiveIcons.freeform.faClass}
      style="font-size: {size}px; color: {primitiveIcons.freeform.color};"
      aria-hidden="true"
      title="Freeform"
    ></i>
  {:else}
    {#each activeList as component}
      {@const icon = iconFor(component)}
      {#if icon}
        <span class="icon-cell" style="width: {size}px; height: {size}px;" title={icon.label}>
          {#if icon.customSvg === "checkerboard"}
            <span class="custom-icon" style="filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));">
              <CheckerboardCircleIcon size="{size}px" color={icon.color} />
            </span>
          {:else}
            <i
              class={icon.faClass}
              style="font-size: {size}px; color: {icon.color};"
              aria-hidden="true"
            ></i>
          {/if}
        </span>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .loop-icon-strip {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .loop-icon-strip i {
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .loop-icon-strip.dark i {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .icon-cell {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .custom-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
</style>
