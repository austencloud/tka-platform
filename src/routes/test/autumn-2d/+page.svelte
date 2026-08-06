<script lang="ts">
  import AutumnLab from "$lib/features/background-builder/components/AutumnLab.svelte";
</script>

<svelte:head>
  <title>Autumn 2D verification</title>
</svelte:head>

<div class="harness">
  <AutumnLab />
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    background: #08070d;
  }

  .harness {
    box-sizing: border-box;
    width: 100vw;
    height: 100vh;
    padding: 20px;
    background: #08070d;
  }
</style>
