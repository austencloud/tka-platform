<script lang="ts">
  import LazyMount from "./LazyMount.svelte";

  let attempts = 0;

  function loader() {
    attempts += 1;
    if (attempts === 1) {
      return Promise.reject(new Error("test chunk failure"));
    }
    return import("./LazyMountTestContent.svelte");
  }
</script>

<LazyMount {loader} active={true}>
  {#snippet placeholder()}
    <p>Loading test component</p>
  {/snippet}
  {#snippet error(_error, retry)}
    <div role="alert">
      <span>Test component did not load.</span>
      <button type="button" onclick={retry}>Try again</button>
    </div>
  {/snippet}
</LazyMount>
