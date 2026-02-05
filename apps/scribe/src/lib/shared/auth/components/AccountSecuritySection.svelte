<script lang="ts">
  import type { IHapticFeedback } from "../../application/services/contracts/IHapticFeedback";
  import PasskeysSection from "./PasskeysSection.svelte";

  interface Props {
    hapticService?: IHapticFeedback | null;
  }

  let { hapticService = null }: Props = $props();
</script>

<div class="stack">
  <PasskeysSection {hapticService} />
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 100%;
    overflow-x: hidden;
  }
</style>
