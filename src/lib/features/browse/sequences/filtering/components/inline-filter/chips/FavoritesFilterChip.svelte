<!--
FavoritesFilterChip.svelte - Toggle chip for favorites filter.
Turns pink when active.
-->
<script lang="ts">
  import FilterChipBase from "../FilterChipBase.svelte";

  interface Props {
    active: boolean;
    onToggle: (active: boolean) => void;
  }

  let { active, onToggle }: Props = $props();

  function handleClick() {
    onToggle(!active);
  }
</script>

<FilterChipBase
  label="Favorites"
  icon="fas fa-heart"
  {active}
  chipColor="#ec4899"
  mode="toggle"
  onclick={handleClick}
/>
