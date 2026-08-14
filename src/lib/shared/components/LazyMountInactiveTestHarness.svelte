<script lang="ts">
  import LazyMount from "./LazyMount.svelte";

  let active = $state(false);
</script>

<button type="button" onclick={() => (active = !active)}>
  {active ? "Deactivate preview" : "Activate preview"}
</button>

{#snippet placeholder()}
  <p>Inactive preview</p>
{/snippet}

<LazyMount
  loader={() => import("./LazyMountTestContent.svelte")}
  {active}
  keepAlive={false}
  {placeholder}
/>
