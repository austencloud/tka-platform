<!--
  /test/shop — preview harness for the Shop spin-up UI. Mounts the REAL
  components (no mockups): the public Coming Soon page and the admin Products
  editor. Lets Austen feel the controls before the rename + route wiring lands.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import ShopComingSoon from "$lib/features/store/components/ShopComingSoon.svelte";
  import ProductManagement from "$lib/features/store/components/admin/ProductManagement.svelte";

  type View = "coming-soon" | "products";
  let view = $state<View>("coming-soon");

  const views: { value: View; label: string }[] = [
    { value: "coming-soon", label: "Coming Soon (public)" },
    { value: "products", label: "Products editor (admin)" },
  ];
</script>

<svelte:head><title>Shop preview | TKA test</title></svelte:head>

<div class="harness">
  <div class="toolbar">
    <span class="title"><i class="fas fa-bag-shopping" aria-hidden="true"></i> Shop preview</span>
    <div class="switch">
      <SegmentedControl options={views} value={view} onchange={(v) => (view = v)} color="accent" size="sm" />
    </div>
  </div>

  <div class="stage">
    {#if view === "coming-soon"}
      <ShopComingSoon />
    {:else}
      <div class="admin-wrap">
        <ProductManagement />
      </div>
    {/if}
  </div>
</div>

<style>
  .harness {
    min-height: 100vh;
    background: #0f0f22;
    color: #fff;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 20px;
    background: rgba(13, 13, 28, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: #b8a6ff;
  }
  .switch {
    width: min(380px, 60vw);
  }
  .admin-wrap {
    padding: 32px 20px 80px;
  }
</style>
