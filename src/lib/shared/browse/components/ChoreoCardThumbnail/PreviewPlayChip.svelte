<!--
PreviewPlayChip.svelte

Toggles the animated preview for a browse card.

A tap rather than a hover, deliberately: the animation covers the card's
pictograph sheet, so starting it is a decision the reader makes, not something
that happens to them while the pointer passes through. It also gives touch and
desktop the same gesture instead of long-press-versus-hover.
-->
<script lang="ts">
  import CardChip from "./CardChip.svelte";

  const {
    playing,
    onToggle,
  }: {
    playing: boolean;
    onToggle: () => void;
  } = $props();
</script>

<CardChip
  label={playing ? "Stop animation" : "Play animation"}
  title={playing ? "Stop animation" : "Play this sequence"}
  pressed={playing}
  onActivate={onToggle}
>
  <i class={playing ? "fas fa-stop" : "fas fa-play"} aria-hidden="true"></i>
</CardChip>
