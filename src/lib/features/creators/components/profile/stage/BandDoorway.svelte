<!--
  BandDoorway — a band that shows a taste of its contents and a way in.

  The alternative it replaces is a wall: every item rendered, which for the
  Archive is 505 tiles and roughly a dozen screens. A doorway is not a button on
  empty space — it still shows real work, through the same ArtifactTile the
  grids use, so the band keeps its character. It just stops being exhaustive.

  Routing lives entirely in the parent. This component knows a count, some
  items, and one callback.
-->
<script lang="ts">
  import ArtifactTile from "./ArtifactTile.svelte";
  import { sampleCount } from "./doorway-policy";
  import type { LiveSlots, Medium } from "./live-slots.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  /** Mirrors ArtifactTile's own prop types exactly. `unknown` here would fail
   *  to assign to the tile's `sequence: SequenceData | null`. */
  type SampleItem = {
    key: string;
    medium: Medium;
    title: string;
    sequence?: SequenceData | null;
    poster?: string | null;
    tunnel?: unknown | null;
    scene?: unknown | null;
    mandala?: {
      steps: unknown[];
      variant: "blue" | "red" | "both";
      bluePropType?: string;
      redPropType?: string;
      pathShape?: "arc" | "linear" | "concave" | "hybrid";
    } | null;
  };

  let {
    slots,
    items,
    total,
    columns,
    actionLabel,
    onenter,
    size = "sm",
  }: {
    slots: LiveSlots;
    /** Newest-first. Only the first row is rendered. */
    items: SampleItem[];
    /** The REAL total, which is what the doorway promises. It must come from
     *  the same pool `onenter` lands in, or the doorway lies about itself. */
    total: number;
    /** Column count for this tier, from the caller's capFor(). */
    columns: number;
    actionLabel: string;
    onenter: () => void;
    size?: "sm" | "md" | "lg";
  } = $props();

  const shown = $derived(items.slice(0, sampleCount(items.length, columns)));
</script>

<div class="doorway">
  {#if shown.length > 0}
    <div class="sample" style:--cols={shown.length}>
      {#each shown as item (item.key)}
        <ArtifactTile
          {slots}
          {size}
          medium={item.medium}
          title={item.title}
          sequence={item.sequence ?? null}
          poster={item.poster ?? null}
          tunnel={item.tunnel ?? null}
          scene={item.scene ?? null}
          mandala={item.mandala ?? null}
        />
      {/each}
    </div>
  {/if}

  <!-- A button, not a text link: this is a standalone action
       (clickables-look-like-buttons.md). -->
  <button class="enter" type="button" onclick={onenter}>
    <span class="enter-label">{actionLabel}</span>
    <span class="enter-count">{total.toLocaleString()}</span>
  </button>
</div>

<style>
  /* Every measure in `em` — the stage rides a container-query font ramp, and a
     `rem` here would freeze at 1080p while its neighbours grew
     (4k-native-layout.md). */
  .doorway {
    display: flex;
    flex-direction: column;
    gap: 0.85em;
  }

  /* Exactly the rendered count, so the sample is always one full row with no
     stranded track — never auto-fill (4k-native-layout.md). */
  .sample {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: clamp(0.75em, 1.2cqw, 1.25em);
    align-items: start;
  }

  .enter {
    /* inline-flex + align-self so the button sizes to its label. A stretched
       `display: flex` here is the 1765px-control failure
       (visual-verification-mandatory.md). */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75em;
    align-self: center;
    width: max-content;
    max-width: 100%;
    min-height: 44px; /* touch-target floor: px on purpose, must not scale */
    padding: 0.6em 1.5em;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.75em;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font: inherit;
    font-size: 0.9375em;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-normal, 250ms) ease;
  }

  .enter:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .enter:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .enter-count {
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  @media (prefers-reduced-motion: reduce) {
    .enter {
      transition: none;
    }
  }
</style>
