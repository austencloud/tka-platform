<!-- src/lib/features/store/components/StoreHeader.svelte -->
<script lang="ts">
</script>

<header class="store-header">
  <a href="/" class="logo-link">
    <span class="logo-text">The Kinetic Alphabet</span>
  </a>
  <nav class="store-nav">
    <span class="store-label">Store</span>
  </nav>
</header>

<style>
  .store-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .logo-link {
    text-decoration: none;
    color: inherit;
  }

  .logo-text {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .store-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
