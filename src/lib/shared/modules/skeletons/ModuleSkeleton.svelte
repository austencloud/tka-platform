<!--
  Dispatcher: given the active module key, render its bespoke layout skeleton
  (or the shared shell fallback). Selection is synchronous from the key so the
  correct skeleton shows on the first frame of a reload.
-->
<script lang="ts">
  import { resolveSkeleton } from "./index";
  let { moduleKey }: { moduleKey: string | null } = $props();
  const Skeleton = $derived(resolveSkeleton(moduleKey));
</script>

<Skeleton />
