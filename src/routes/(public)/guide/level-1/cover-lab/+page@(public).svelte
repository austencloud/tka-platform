<script lang="ts">
  /**
   * Cover lab - design source/preview for the Level 1 cover. The cover itself
   * lives in _components/GuideCover.svelte (shared with the print route). Shows
   * both editions: navy (digital / pro / foil) and light (cheap home printer).
   */
  import GuideCover from "../_components/GuideCover.svelte";
</script>

<svelte:head>
  <title>Cover Lab: Level 1</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="stage">
  <div class="row">
    <div class="col">
      <div class="cap">Navy: digital / pro print (foil edition)</div>
      <div class="sheet"><GuideCover theme="navy" /></div>
    </div>
    <div class="col">
      <div class="cap">Light: home printer (minimal ink)</div>
      <div class="sheet"><GuideCover theme="light" /></div>
    </div>
  </div>
</div>

<style>
  .stage { min-height: 100vh; background: #2b2b33; color: #eaeaf2; font-family: system-ui, sans-serif; padding: 24px; }
  .row { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap; }
  .col { display: flex; flex-direction: column; gap: 10px; }
  .cap { font-size: 13px; color: #b9b9cc; text-align: center; }
  .sheet { width: 540px; aspect-ratio: 8.5 / 11; border-radius: 3px; box-shadow: 0 10px 40px rgba(0,0,0,.5); overflow: hidden; }
</style>
