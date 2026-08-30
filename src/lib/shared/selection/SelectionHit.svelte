<script lang="ts">
  import { getSequenceSelection } from "./sequence-selection.svelte";

  let {
    groupId,
    isGroupStart = false,
    label = "",
    href,
    onselect,
  }: {
    /** Sequence identity; units sharing it hover/select together. */
    groupId: string;
    /** The single focusable/labelled unit per group (one per sequence). */
    isGroupStart?: boolean;
    /** aria-label for the focusable unit. */
    label?: string;
    /** Navigation destinations stay links instead of imitating one with onclick. */
    href?: string;
    /** Surface consequence — guide: emit+animate; choreo: toggle+reveal Remove. */
    onselect?: (groupId: string) => void;
  } = $props();

  // The host provides the scope (GuideReader / ChoreoSheetView). Null on /print,
  // /book, or any surface that opts out → this component renders nothing, and the
  // host's is-hovered/is-selected bindings resolve falsy, so no ring paints.
  const scope = getSequenceSelection();
</script>

{#if scope}
  {#if href}
    <a
      class="tka-seq-hit"
      {href}
      aria-label={isGroupStart ? label : undefined}
      aria-hidden={isGroupStart ? undefined : "true"}
      tabindex={isGroupStart ? undefined : -1}
      onpointerenter={() => scope.hover(groupId)}
      onpointerleave={() => scope.hover(null)}
    ></a>
  {:else}
    <button
      type="button"
      class="tka-seq-hit"
      aria-label={isGroupStart ? label : undefined}
      aria-hidden={isGroupStart ? undefined : "true"}
      aria-pressed={isGroupStart ? scope.isSelected(groupId) : undefined}
      tabindex={isGroupStart ? undefined : -1}
      onpointerenter={() => scope.hover(groupId)}
      onpointerleave={() => scope.hover(null)}
      onclick={() => onselect?.(groupId)}
    ></button>
  {/if}
{/if}
