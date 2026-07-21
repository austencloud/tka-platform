<!--
  LastUsedBadge.svelte — "Last used" marker for a sign-in option.

  Pinned to the host control's top-right corner and taken OUT of flow, so
  showing it can never resize or shove the control it marks (no-layout-shift).
  The host only has to set `position: relative` and reserve the ~8px the badge
  overhangs by — the badge itself contributes nothing to layout.

  Display-only, never interactive: this is a *Badge, not a chip, so it stays
  out of the FilterChipBase/SegmentedControl routing (chip-primitives.md).

  aria-hidden because the same information is carried in the host control's
  aria-label ("Sign in with Google, last used") — announcing it twice makes
  the button read worse, not better.
-->
<script lang="ts">
  interface Props {
    /** Override the label. Defaults to "Last used". */
    label?: string;
  }

  let { label = "Last used" }: Props = $props();
</script>

<span class="last-used-badge" aria-hidden="true">{label}</span>

<style>
  .last-used-badge {
    position: absolute;
    top: 0;
    right: 0.625rem;
    z-index: 1;
    pointer-events: none;

    padding: 0.0625rem 0.5rem;
    border-radius: 999px;
    /* --font-size-compact is the project's 12px floor for supplementary text.
       This was 10px, which is under it. rem elsewhere so the 4K root ramp
       scales the pill with everything around it. */
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;

    /* Accent-tinted glass, not a solid accent block. This is an annotation,
       not a call to action — a saturated fill makes the badge shout louder
       than the button it points at, and it was the only solid block in a
       modal built entirely from card-bg + stroke surfaces.

       Mixing INTO panel-bg rather than into transparent matters: the pill
       straddles the top edge, so it lands half on the dark modal and half on
       the host — which is white for Google and #1877f2 for Facebook. An
       alpha fill would pick up whatever is behind it and read as three
       different colors across the row. */
    background: color-mix(in srgb, var(--theme-accent, #7c6af7) 26%, var(--theme-panel-bg, #12121c));
    color: color-mix(in srgb, var(--theme-accent, #7c6af7) 25%, #fff);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #7c6af7) 55%, transparent);
    /* A soft accent halo instead of the old dark border-punch. The punch was
       sized to cut the pill out of the dark modal, but half of it fell across
       the white Google button and muddied it. A glow reads on any host fill. */
    box-shadow:
      0 0 0 0.25rem color-mix(in srgb, var(--theme-panel-bg, #12121c) 70%, transparent),
      0 2px 8px color-mix(in srgb, var(--theme-accent, #7c6af7) 28%, transparent);

    /* Straddle the host's top edge. Out of flow + translate = the host's box
       is byte-identical whether or not this renders. `translate` (not
       `transform`) so the entrance animates the same axis without the two
       fighting over one property. */
    translate: 0 -50%;
    opacity: 1;
    transition:
      opacity var(--duration-normal, 200ms) ease,
      translate var(--duration-normal, 200ms) cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* Settles in rather than popping. Pure CSS — no mount hook, and it can't
     affect layout because the element is already out of flow. */
  @starting-style {
    .last-used-badge {
      opacity: 0;
      translate: 0 -20%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .last-used-badge {
      transition: none;
    }
  }
</style>
