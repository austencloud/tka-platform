<script lang="ts">
  /**
   * GlobalSettings
   * Main container for global feature flag settings
   * Uses the Permission Matrix view
   */

  import PermissionMatrix from "./PermissionMatrix.svelte";

  interface Props {
    onError: (message: string) => void;
  }

  let { onError }: Props = $props();
</script>

<div class="global-settings">
  <PermissionMatrix {onError} />
</div>

<style>
  .global-settings {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
