<script lang="ts">
  /**
   * Promo Generator Module
   *
   * Full-screen immersive 3D device mockup promo video generator.
   */

  import PromoGenerator from "./components/PromoGenerator.svelte";
</script>

<div class="promo-module">
  <PromoGenerator initialModelPath="/models/iphone-16.glb" />
</div>

<style>
  .promo-module {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
</style>
