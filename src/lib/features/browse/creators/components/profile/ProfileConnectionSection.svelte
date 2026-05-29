<script lang="ts">
  /**
   * ProfileConnectionSection - Your Connection with another user
   *
   * Shows private notes, mutual follow status, and shared sequences.
   * Collapsed by default on mobile, expanded on desktop.
   * Only visible when viewing someone else's profile.
   */

  import { onMount } from "svelte";
  import { getConnectionInfo } from "$lib/shared/community/services/connection-manager";
  import type { ConnectionInfo } from "$lib/shared/community/services/types";
  import ConnectionNotes from "./ConnectionNotes.svelte";
  import ConnectionMutualStatus from "./ConnectionMutualStatus.svelte";
  import ConnectionSharedSequences from "./ConnectionSharedSequences.svelte";

  interface Props {
    targetUserId: string;
    targetUserName: string;
  }

  let { targetUserId, targetUserName }: Props = $props();

  // State
  let connectionInfo = $state<ConnectionInfo | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isExpanded = $state(false);
  let isMobile = $state(false);

  // Check screen size
  function checkMobile() {
    isMobile = window.innerWidth < 768;
    // Auto-expand on desktop
    if (!isMobile) {
      isExpanded = true;
    }
  }

  onMount(() => {
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Load connection info
    loadConnectionInfo();

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  });

  async function loadConnectionInfo() {
    try {
      connectionInfo = await getConnectionInfo(targetUserId);
    } catch (err) {
      console.error("[ProfileConnectionSection] Error loading connection:", err);
      error = "Failed to load connection info";
    } finally {
      isLoading = false;
    }
  }

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  // Summary for collapsed state
  const summaryText = $derived(() => {
    if (!connectionInfo) return "";

    const parts: string[] = [];

    if (connectionInfo.mutualFollow.isMutual) {
      parts.push("Mutual");
    } else if (connectionInfo.mutualFollow.iFollowThem) {
      parts.push("Following");
    } else if (connectionInfo.mutualFollow.theyFollowMe) {
      parts.push("Follows you");
    }

    if (connectionInfo.sharedSequenceCount > 0) {
      parts.push(`${connectionInfo.sharedSequenceCount} shared`);
    }

    if (connectionInfo.notes) {
      parts.push("Has notes");
    }

    return parts.join(" • ") || "No connection yet";
  });
</script>

<section class="connection-section" class:expanded={isExpanded}>
  <!-- Header / Toggle -->
  <button
    class="section-header"
    onclick={toggleExpand}
    aria-expanded={isExpanded}
    aria-controls="connection-content"
    aria-label="Toggle connection details"
    disabled={!isMobile}
  >
    <div class="header-left">
      <i class="fas fa-user-circle" aria-hidden="true"></i>
      <span class="header-title">Your Connection</span>
    </div>

    {#if isMobile}
      <div class="header-right">
        {#if !isExpanded && connectionInfo}
          <span class="summary-text">{summaryText()}</span>
        {/if}
        <i
          class="fas fa-chevron-down expand-icon"
          class:rotated={isExpanded}
          aria-hidden="true"
        ></i>
      </div>
    {/if}
  </button>

  <!-- Content -->
  <div
    id="connection-content"
    class="section-content"
    class:collapsed={!isExpanded && isMobile}
  >
    {#if isLoading}
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Loading connections...</span>
      </div>
    {:else if error}
      <div class="error-state">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{error}</span>
      </div>
    {:else if connectionInfo}
      <div class="content-grid">
        <!-- Mutual Status -->
        <div class="content-block">
          <ConnectionMutualStatus
            mutualFollow={connectionInfo.mutualFollow}
            theirName={targetUserName}
          />
        </div>

        <!-- Shared Sequences -->
        <div class="content-block">
          <ConnectionSharedSequences
            sharedSequences={connectionInfo.sharedSequences}
            theirName={targetUserName}
          />
        </div>

        <!-- Notes -->
        <div class="content-block notes-block">
          <ConnectionNotes
            {targetUserId}
            initialNotes={connectionInfo.notes}
          />
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .connection-section {
    container-type: inline-size;
    container-name: connection;

    margin-top: 24px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 16px;
    background: transparent;
    border: none;
    color: var(--theme-text);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--duration-normal, 200ms) ease;
  }

  .section-header:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.02));
  }

  .section-header:disabled {
    cursor: default;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-left i {
    font-size: 18px;
    color: var(--theme-accent);
  }

  .header-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .summary-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .expand-icon {
    font-size: 12px;
    color: var(--theme-text-dim);
    transition: transform var(--duration-normal, 200ms) ease;
  }

  .expand-icon.rotated {
    transform: rotate(180deg);
  }

  .section-content {
    padding: 0 16px 16px 16px;
    transition: max-height var(--duration-normal, 200ms) ease,
      opacity var(--duration-normal, 200ms) ease;
  }

  .section-content.collapsed {
    max-height: 0;
    padding: 0 16px;
    opacity: 0;
    overflow: hidden;
  }

  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
  }

  .error-state {
    color: var(--semantic-error);
  }

  .content-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .content-block {
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .content-block:first-child {
    padding-top: 0;
    border-top: none;
  }

  /* Wide: side-by-side layout for status and sequences */
  @container connection (min-width: 550px) {
    .section-header {
      padding: 14px 20px;
    }

    .section-content {
      padding: 0 20px 20px 20px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 20px;
    }

    .content-block:first-child {
      grid-column: 1;
      padding-top: 0;
      border-top: none;
    }

    .content-block:nth-child(2) {
      grid-column: 2;
      padding-top: 0;
      border-top: none;
    }

    .notes-block {
      grid-column: 1 / -1;
    }
  }

  /* Narrow */
  @container connection (max-width: 400px) {
    .section-header {
      padding: 14px 12px;
    }

    .section-content {
      padding: 0 12px 12px 12px;
    }

    .summary-text {
      max-width: 100px;
    }

    .content-grid {
      gap: 16px;
    }
  }
</style>
