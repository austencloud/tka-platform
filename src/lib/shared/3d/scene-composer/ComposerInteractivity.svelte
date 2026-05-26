<script lang="ts">
  import { interactivity } from "@threlte/extras";
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();

  interactivity();
</script>

{@render children()}
