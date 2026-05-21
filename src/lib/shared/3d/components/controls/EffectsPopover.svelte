<script lang="ts">
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
</script>

<div class="effects-content">
  <MobileEffectsPanel layout="grid" />
</div>

<style>
  .effects-content {
    max-height: 70vh;
    overflow-y: auto;
  }
</style>
