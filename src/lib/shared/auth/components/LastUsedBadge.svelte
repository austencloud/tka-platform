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
    right: 0.5rem;
    /* Straddle the host's top edge. Out of flow + translate = the host's box
       is byte-identical whether or not this renders. */
    transform: translateY(-50%);
    z-index: 1;
    pointer-events: none;

    padding: 0.125rem 0.4rem;
    border-radius: 999px;
    /* rem, not px: the 4K root ramp scales this with everything around it. */
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: 0.02em;
    white-space: nowrap;

    background: var(--theme-accent, #7c6af7);
    color: #fff;
    border: 1px solid var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
</style>
