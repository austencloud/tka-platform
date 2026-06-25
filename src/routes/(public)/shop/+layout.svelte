<script lang="ts">
  // The cosmic background, SiteHeader, and cosmic theme tokens for every /shop
  // route now come from the persistent MarketingChrome (root layout), shared with
  // the other marketing pages so navigating in/out of /shop never flashes the
  // body's saved-theme gradient. This layout just passes content through.
  let { children } = $props();
</script>

{@render children()}
