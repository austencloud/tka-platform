<script lang="ts">
  import { setFuseContext } from "../context/fuse-context";
  import type { FuseState } from "../state/fuse-state.svelte";
  import FuseRelationshipComposer from "./FuseRelationshipComposer.svelte";

  let { state }: { state: FuseState } = $props();

  setFuseContext({ state });
</script>

<FuseRelationshipComposer />
