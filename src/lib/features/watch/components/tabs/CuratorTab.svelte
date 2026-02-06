<!--
  CuratorTab.svelte

  Wraps the VideoCurator component for the Watch module.
  Admin-only tab for tagging and curating Instagram showcase videos.
-->
<script lang="ts">
  import VideoCurator from "$lib/features/landing-preview/components/VideoCurator.svelte";
</script>

<div class="curator-tab">
  <VideoCurator />
</div>

<style>
  .curator-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
  }
</style>
