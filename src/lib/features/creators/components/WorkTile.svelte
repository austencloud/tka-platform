<!--
  WorkTile — one published sequence on the Wall, credited to its creator.

  The tile exists to do something the roster cannot: show that these people
  MAKE things. A directory of 56 faces is a list; a wall of their work is a
  reason to scroll. The attribution strip is the load-bearing half — an
  uncredited thumbnail is browse, not creators.

  Thumbnail rendering, caching and lazy loading all belong to
  PropAwareThumbnail (the same component ProfileTabs, BrowseGrid and the
  watch feed use). Nothing about pictograph rendering is reimplemented here.
-->
<script lang="ts">
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

  interface Props {
    sequence: SequenceData;
    creator: EnhancedUserProfile;
    /** px-per-em from the panel ramp; RobustAvatar sizes in px. */
    unitPx: number;
    onselect: (sequence: SequenceData) => void;
    /** Jump to the maker's profile rather than opening the work. */
    oncreator: (creator: EnhancedUserProfile) => void;
  }

  let { sequence, creator, unitPx, onselect, oncreator }: Props = $props();

  const avatarSize = $derived(Math.round(1.5 * unitPx));
</script>

<div class="tile">
  <button
    class="art"
    type="button"
    onclick={() => onselect(sequence)}
    aria-label="Open {creator.displayName}'s sequence"
  >
    <!--
      allowQR defaults to TRUE on PropAwareThumbnail, and the component's own
      docs say grids and peeks must turn it off: a QR at tile size is
      unscannable, and it eats a step cell that would otherwise show the work.
      The first render of this wall had a QR block in every tile.
    -->
    <PropAwareThumbnail {sequence} allowQR={false} />
  </button>

  <!--
    A separate control, not a nested button: the thumbnail opens the work and
    the credit opens the maker, and nesting them would make one unreachable
    by keyboard and invalid HTML besides.
  -->
  <button
    class="credit"
    type="button"
    onclick={() => oncreator(creator)}
    aria-label="View {creator.displayName}'s profile"
  >
    <RobustAvatar
      src={creator.avatar}
      name={creator.displayName}
      alt=""
      customSize={avatarSize}
      loading="lazy"
    />
    <span class="credit-name">{creator.displayName}</span>
  </button>
</div>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 0.85em;
    overflow: hidden;
    transition:
      border-color var(--duration-quick, 120ms) ease,
      transform var(--duration-quick, 120ms) ease;
  }

  .tile:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .art {
    display: block;
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    /* Establishes the query container PropAwareThumbnail sizes against — same
       contract as ProfileTabs' `.card-thumbnail`. */
    container-type: inline-size;
    container-name: sequence-card;

    /* A sequence sheet's height scales with its step count, so left alone the
       tiles ranged 429px to 950px and the wall read as rubble. A fixed window
       onto the top of each sheet — title glyph and opening steps — makes the
       row uniform. This is a wall of samples, not a reader; the whole sheet is
       one click away. */
    aspect-ratio: 4 / 3;
    overflow: hidden;
    /* Fades the cut edge instead of slicing a row of pictographs in half, so
       the crop reads as a deliberate window rather than a rendering accident. */
    -webkit-mask-image: linear-gradient(
      to bottom,
      #000 72%,
      rgba(0, 0, 0, 0.25) 100%
    );
    mask-image: linear-gradient(to bottom, #000 72%, rgba(0, 0, 0, 0.25) 100%);
  }

  .credit {
    display: flex;
    align-items: center;
    gap: 0.45em;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 0.4em 0.6em;
    background: none;
    border: none;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font: inherit;
    font-size: 0.8em;
    text-align: left;
    cursor: pointer;
    transition: color var(--duration-quick, 120ms) ease;
  }

  .credit:hover,
  .credit:focus-visible {
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
  }

  .art:focus-visible,
  .credit:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .credit-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .tile,
    .tile:hover {
      transition: none;
      transform: none;
    }
  }
</style>
