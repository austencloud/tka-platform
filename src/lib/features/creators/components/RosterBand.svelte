<!--
  RosterBand — one recency band: a header, and its members at one density.

  The band owns the column count, and it computes it rather than delegating to
  `repeat(auto-fill, minmax(...))`. Auto-fill against a floor produces *more,
  thinner* cells as the viewport grows and strands the last one in a row by
  itself (4k-native-layout.md, "never a row of one"). `fitColumns` picks the
  widest count up to the tier cap that does not leave exactly one item in the
  final row — so a 7-person band at a 6-column cap renders 5 + 2, not 6 + 1.

  The header is deliberately not sticky. The page has a bottom and should feel
  finite; a stack of accumulating sticky headers on a 56-person directory
  reads as "there is more of this than there is."
-->
<script lang="ts">
  import CreatorCell from "./CreatorCell.svelte";
  import { fitColumns } from "../domain/fit-columns";
  import type { BandKey } from "../domain/creator-recency";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

  interface Props {
    band: BandKey;
    members: EnhancedUserProfile[];
    /**
     * Portrait density is a property of the BAND (people who are actually
     * around get more pixels), but the short-landscape branch overrides every
     * band to index — at ~400px tall there is no room for a stacked cell.
     */
    forceIndex?: boolean;
    /** Column caps for the current tier, set by the panel's container query. */
    portraitCap: number;
    indexCap: number;
    /** ids of creators who joined within 30 days */
    newCreatorIds: Set<string>;
    /** px-per-em from the panel ramp, so avatars scale with the type. */
    unitPx: number;
    /** Bands past the first defer avatar loading. */
    loading?: "lazy" | "eager";
    onselect: (creator: EnhancedUserProfile) => void;
  }

  let {
    band,
    members,
    forceIndex = false,
    portraitCap,
    indexCap,
    newCreatorIds,
    unitPx,
    loading = "lazy",
    onselect,
  }: Props = $props();

  const BAND_LABEL: Record<BandKey, string> = {
    week: "This week",
    month: "This month",
    quarter: "Last 90 days",
    earlier: "Earlier",
  };

  // "Earlier" is the long tail and always renders as an index, regardless of
  // tier — it is 35 of 56 people and portrait cells would make it the whole
  // page.
  const density = $derived<"portrait" | "index">(
    forceIndex || band === "earlier" ? "index" : "portrait"
  );

  // Cap the column count at the member count FIRST. Without this a band of 8
  // in a 10-column tier renders as 8 cells plus 2 empty tracks, and a band of
  // 7 in a 6-column tier renders 5 + 2 with four tracks of nothing beside it —
  // both read as an abandoned row rather than a designed one. Clamping first
  // means any band that fits on one line gets exactly one full line, and
  // `fitColumns` only does its orphan work on bands that genuinely wrap.
  const cap = $derived(density === "portrait" ? portraitCap : indexCap);
  const columns = $derived(
    fitColumns(members.length, Math.min(cap, Math.max(1, members.length)))
  );

  const headingId = $derived(`roster-band-${band}`);
</script>

{#if members.length > 0}
  <section class="band" aria-labelledby={headingId}>
    <header class="band-header">
      <h3 class="band-name" id={headingId}>{BAND_LABEL[band]}</h3>
      <span class="rule" aria-hidden="true"></span>
      <span class="count">{members.length}</span>
    </header>

    <div class="cells {density}" style:--cols={columns}>
      {#each members as creator (creator.id)}
        <CreatorCell
          {creator}
          {band}
          {density}
          isNew={newCreatorIds.has(creator.id)}
          {unitPx}
          {loading}
          {onselect}
        />
      {/each}
    </div>
  </section>
{/if}

<style>
  .band {
    display: flex;
    flex-direction: column;
    gap: 0.75em;
  }

  .band-header {
    display: flex;
    align-items: center;
    gap: 0.75em;
  }

  .band-name {
    margin: 0;
    font-size: 0.8125em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
  }

  .rule {
    /* The rule fills whatever is left, so the header reads as one line at
       every width instead of the count drifting away from the name. */
    flex: 1;
    height: 1px;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.12));
  }

  .count {
    font-size: 0.8125em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    /* The counts change as search narrows the roster; tabular figures keep
       the header from reflowing on every keystroke (no-layout-shift.md). */
    font-variant-numeric: tabular-nums;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    /* Tracks fill the band, but only up to a sane cell width. Without the cap
       a 6-person band on a 4K panel stretched its cells to 285px around a
       93px face — a scatter of dots in a field of gutter. The cap is on the
       GRID rather than the track (`minmax(0, 13em)`) because a fixed track max
       cannot shrink below its max and would overflow at 375px; a max-width
       simply stops binding once the container is narrower. */
    max-width: calc(var(--cols) * var(--cell-max) + (var(--cols) - 1) * 0.5em);
  }

  .cells.portrait {
    /* The ceiling on how wide a cell may stretch, which is what decides how
       much of the row a SHORT band covers. 12.5em left a six-person band at
       1306px inside a 1755px content area; 14em closes most of that without
       going back to the 285px cells that read as a scatter of dots. A band
       shorter than the row simply cannot fill it at a sane cell size — the
       wall above is what carries the full width. */
    --cell-max: 14em;
    gap: 0.5em;
  }

  .cells.index {
    --cell-max: 14em;
    gap: 0.125em 0.5em;
  }
</style>
