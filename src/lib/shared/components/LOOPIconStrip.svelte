<!--
LOOPIconStrip.svelte - Horizontal strip of Font Awesome icons for LOOP visualization

Shows only the active LOOP primitives as a compact icon strip.
Uses the user's chosen icons from the Design Lab (2026-01-21):
- Rotated: fa-rotate
- Mirrored: fa-left-right
- Flipped: fa-up-down
- Swapped: fa-shuffle
- Inverted: fa-adjust
- Rewound: fa-backward
- Freeform: fa-infinity

Used in:
1. Sequence cards (badge overlay)
2. Export headers (choreo card image)
3. Layered sequence preview
-->
<script lang="ts">
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { LOOP_ICON_GAP_SCALE } from "@tka/render-composition";

  interface Props {
    activeComponents: Set<LOOPComponent>;
    size?: number;
    darkMode?: boolean;
    showFreeformWhenEmpty?: boolean;
  }

  let {
    activeComponents,
    size = 16,
    darkMode = true,
    showFreeformWhenEmpty = true,
  }: Props = $props();

  // Icon configuration - matches Design Lab choices
  const primitiveIcons: Record<LOOPComponent | "freeform", {
    faClass: string;
    color: string;
    label: string;
  }> = {
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
      color: "#26e600",
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

  // Generate aria label
  const ariaLabel = $derived(
    activeList.length > 0
      ? `LOOP: ${activeList.map(c => primitiveIcons[c].label).join(", ")}`
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
      {@const icon = primitiveIcons[component]}
      <i
        class={icon.faClass}
        style="font-size: {size}px; color: {icon.color};"
        aria-hidden="true"
        title={icon.label}
      ></i>
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
</style>
