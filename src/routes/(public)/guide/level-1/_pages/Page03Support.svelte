<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage pageNumber={3} title="Support the author!">
  {#snippet intro()}
    <p class="lead">
      I hope the information within this book gives you a thorough understanding
      and greater confidence in forging your own choreographed sequences!
    </p>
    <p class="center">
      Your support plays an essential role in this system's development.
    </p>
    <p class="center">A donation of any amount is deeply appreciated.</p>
  {/snippet}

  <div class="qr-grid">
    <div class="qr">
      <img src="/guide/level-1/artboards/Support the Author.png" alt="QR codes for PayPal, Venmo, Cash App" class="qr-block" />
    </div>
  </div>
</HybridPage>

<style>
  .qr-grid { display: flex; justify-content: center; margin-top: 2rem; }
  .qr { width: 100%; }
  .qr-block {
    width: 100%;
    height: auto;
    object-fit: contain;
    /* Crop to bottom 45% which is where the QR codes live in the artboard */
    clip-path: inset(58% 0 0 0);
    margin-top: -55%;
  }
</style>
