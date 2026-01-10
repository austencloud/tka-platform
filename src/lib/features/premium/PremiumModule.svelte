<!--
  PremiumModule - Premium subscription as a full module

  Shown to non-premium users in the main navigation.
  Disappears after user subscribes.
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import PremiumShowcase from "./components/PremiumShowcase.svelte";

  let hapticService = $state<IHapticFeedback | null>(null);

  $effect(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div class="premium-module">
  <PremiumShowcase {hapticService} />
</div>

<style>
  .premium-module {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
