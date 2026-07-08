<script lang="ts">
  import { getSequenceSelection } from "./sequence-selection.svelte";

  let {
    groupId,
    isGroupStart = false,
    label = "",
    onselect,
  }: {
    /** Sequence identity; units sharing it hover/select together. */
    groupId: string;
    /** The single focusable/labelled unit per group (one per sequence). */
    isGroupStart?: boolean;
    /** aria-label for the focusable unit. */
    label?: string;
    /** Surface consequence — guide: emit+animate; choreo: toggle+reveal Remove. */
    onselect?: (groupId: string) => void;
  } = $props();

  // The host provides the scope (GuideReader / ChoreoSheetView). Null on /print,
  // /book, or any surface that opts out → this component renders nothing, and the
  // host's is-hovered/is-selected bindings resolve falsy, so no ring paints.
  const scope = getSequenceSelection();
</script>

{#if scope}
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
