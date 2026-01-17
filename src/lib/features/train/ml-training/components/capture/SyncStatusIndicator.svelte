<!--
  SyncStatusIndicator.svelte

  Displays cloud sync progress status.
-->
<script lang="ts">
  import type { SyncProgress } from "../../services/FirebaseMLStorage";

  interface Props {
    syncProgress: SyncProgress | null;
  }

  let { syncProgress }: Props = $props();

  const isSyncing = $derived(syncProgress?.status === "syncing");
</script>

{#if syncProgress}
  <div
    class="sync-status"
    class:syncing={isSyncing}
    class:error={syncProgress.status === "error"}
    class:synced={syncProgress.status === "synced"}
  >
    {#if isSyncing}
      <i class="fa fa-cloud-upload-alt" aria-hidden="true"></i>
      <span>Syncing to cloud... {syncProgress.progress}%</span>
      <div class="sync-progress-bar">
        <div
          class="sync-progress-fill"
          style="width: {syncProgress.progress}%"
        ></div>
      </div>
    {:else if syncProgress.status === "synced"}
      <i class="fa fa-cloud" aria-hidden="true"></i>
      <span>Synced to cloud</span>
    {:else if syncProgress.status === "error"}
      <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
      <span>Sync failed: {syncProgress.error}</span>
    {/if}
  </div>
{/if}

<style>
  .sync-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin: 0.5rem;
    border-radius: 10px;
    font-size: 0.85rem;
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 30%,
        transparent
      );
    color: #93c5fd;
  }

  .sync-status.syncing {
    background: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 30%,
      transparent
    );
    color: #93c5fd;
  }

  .sync-status.synced {
    background: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-success, var(--semantic-success)) 30%,
      transparent
    );
    color: #86efac;
  }

  .sync-status.error {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 30%,
      transparent
    );
    color: #fca5a5;
  }

  .sync-status i {
    font-size: 1rem;
  }

  .sync-progress-bar {
    flex: 1;
    height: 4px;
    background: var(--theme-stroke);
    border-radius: 2px;
    overflow: hidden;
    margin-left: 0.5rem;
  }

  .sync-progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--semantic-info, var(--semantic-info)),
      color-mix(in srgb, var(--semantic-info, var(--semantic-info)) 80%, white)
    );
    border-radius: 2px;
    transition: width var(--duration-emphasis) ease;
  }
</style>
