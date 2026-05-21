<script lang="ts">
  import { interactivity } from "@threlte/extras";
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();

  const ctx = interactivity();
  console.log('[ComposerInteractivity] initialized', { interactiveObjects: ctx.interactiveObjects, enabled: ctx.enabled.current });
</script>

{@render children()}
