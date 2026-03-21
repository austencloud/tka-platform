<!--
PresetCard - Shows active favorite name or opens drawer to browse favorites
-->
<script lang="ts">
  import BaseCard from "./BaseCard.svelte";

  let {
    activeFavoriteId = null,
    activeFavoriteName = null,
    onOpenDrawer,
    color = "",
    shadowColor = "",
    cardIndex = 0,
  } = $props<{
    activeFavoriteId?: string | null;
    activeFavoriteName?: string | null;
    onOpenDrawer?: () => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
  }>();

  const displayValue = $derived(
    activeFavoriteName ? activeFavoriteName : "Browse"
  );
</script>

<BaseCard
  title="Favorite"
  currentValue={displayValue}
  {color}
  {shadowColor}
  {cardIndex}
  clickable
  onClick={onOpenDrawer}
/>
