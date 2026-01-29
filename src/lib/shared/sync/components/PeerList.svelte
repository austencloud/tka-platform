<!--
  PeerList.svelte

  Displays all connected peers in a sync room with their view mode
  and connection quality. Animates peer join/leave events.

  Features:
  - Shows all connected peers
  - Indicates which peer is "you"
  - Shows peer view mode (animation/grid/both)
  - Shows connection quality indicator
  - Animates peer join/leave

  Accessibility:
  - Proper ARIA labels for peer status
  - Screen reader announcements for join/leave
  - Keyboard accessible
-->
<script lang="ts">
  import { deviceSyncState, getQualityIndicator } from '../state/device-sync-state.svelte';
  import type { ViewMode, PeerInfo, ConnectionQuality } from '../domain/sync-types';

  interface Props {
    /** Compact display mode */
    compact?: boolean;
    /** Show view mode icons */
    showViewMode?: boolean;
    /** Show connection quality */
    showQuality?: boolean;
    /** Maximum peers to display before collapsing */
    maxVisible?: number;
  }

  let {
    compact = false,
    showViewMode = true,
    showQuality = true,
    maxVisible = 10,
  }: Props = $props();

  // Internal state for tracking peer join/leave animations
  let recentlyJoined = $state<Set<string>>(new Set());
  let recentlyLeft = $state<Set<string>>(new Set());
  let previousPeerIds = $state<Set<string>>(new Set());

  // Get current state from deviceSyncState
  const roomState = $derived(deviceSyncState.roomState);
  const myNodeId = $derived(deviceSyncState.connectionState.nodeId);
  const isConnected = $derived(deviceSyncState.isConnected);

  // Convert Map to array and sort (self first, then by name)
  const peerList = $derived.by(() => {
    if (!roomState?.peers) return [];

    const peers = Array.from(roomState.peers.values());

    // Sort: self first, then alphabetically by display name
    return peers.sort((a, b) => {
      if (a.nodeId === myNodeId) return -1;
      if (b.nodeId === myNodeId) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  });

  // Track peer changes for animations
  $effect(() => {
    const currentPeerIds = new Set(peerList.map((p) => p.nodeId));

    // Find newly joined peers
    for (const id of currentPeerIds) {
      if (!previousPeerIds.has(id)) {
        recentlyJoined.add(id);
        // Clear animation state after animation completes
        setTimeout(() => {
          recentlyJoined = new Set([...recentlyJoined].filter((i) => i !== id));
        }, 500);
      }
    }

    // Find recently left peers
    for (const id of previousPeerIds) {
      if (!currentPeerIds.has(id)) {
        recentlyLeft.add(id);
        // Clear animation state after animation completes
        setTimeout(() => {
          recentlyLeft = new Set([...recentlyLeft].filter((i) => i !== id));
        }, 500);
      }
    }

    previousPeerIds = currentPeerIds;
  });

  // Determine how many peers to show
  const visiblePeers = $derived(peerList.slice(0, maxVisible));
  const hiddenCount = $derived(Math.max(0, peerList.length - maxVisible));

  // Get view mode icon
  function getViewModeIcon(mode: ViewMode): string {
    switch (mode) {
      case 'animation':
        return 'fa-play-circle';
      case 'grid':
        return 'fa-th';
      case 'both':
        return 'fa-columns';
      default:
        return 'fa-question-circle';
    }
  }

  // Get view mode label
  function getViewModeLabel(mode: ViewMode): string {
    switch (mode) {
      case 'animation':
        return 'Animation view';
      case 'grid':
        return 'Grid view';
      case 'both':
        return 'Split view';
      default:
        return 'Unknown view';
    }
  }

  // Get quality for a peer (simplified - we don't track per-peer quality)
  function getPeerQuality(peer: PeerInfo): ConnectionQuality {
    // For self, use the actual connection quality
    if (peer.nodeId === myNodeId) {
      return deviceSyncState.quality;
    }
    // For other peers, assume good quality if we're receiving their updates
    const timeSinceLastSeen = Date.now() - peer.lastSeen.wallTime;
    if (timeSinceLastSeen < 5000) return 'excellent';
    if (timeSinceLastSeen < 10000) return 'good';
    if (timeSinceLastSeen < 20000) return 'degraded';
    return 'poor';
  }
</script>

{#if isConnected && peerList.length > 0}
  <div
    class="peer-list"
    class:compact
    role="list"
    aria-label="Connected peers"
  >
    {#each visiblePeers as peer (peer.nodeId)}
      {@const isMe = peer.nodeId === myNodeId}
      {@const isJoining = recentlyJoined.has(peer.nodeId)}
      {@const quality = getPeerQuality(peer)}
      {@const qualityInfo = getQualityIndicator(quality)}

      <div
        class="peer-item"
        class:is-me={isMe}
        class:joining={isJoining}
        role="listitem"
        aria-label="{peer.displayName}{isMe ? ' (you)' : ''}, {getViewModeLabel(peer.viewMode)}, connection quality: {qualityInfo.label}"
      >
        <!-- Avatar/Initial -->
        <div class="peer-avatar" aria-hidden="true">
          <span class="peer-initial">
            {peer.displayName.charAt(0).toUpperCase()}
          </span>
          {#if showQuality}
            <span
              class="quality-dot"
              style:background={qualityInfo.color}
              title="{qualityInfo.label} connection"
            ></span>
          {/if}
        </div>

        <!-- Peer info -->
        <div class="peer-info">
          <span class="peer-name">
            {peer.displayName}
            {#if isMe}
              <span class="you-badge">(you)</span>
            {/if}
          </span>

          {#if showViewMode && !compact}
            <span class="peer-view-mode">
              <i class="fas {getViewModeIcon(peer.viewMode)}" aria-hidden="true"></i>
              <span class="view-mode-label">{getViewModeLabel(peer.viewMode)}</span>
            </span>
          {/if}
        </div>

        <!-- View mode icon (compact mode) -->
        {#if showViewMode && compact}
          <div
            class="peer-view-icon"
            title={getViewModeLabel(peer.viewMode)}
            aria-label={getViewModeLabel(peer.viewMode)}
          >
            <i class="fas {getViewModeIcon(peer.viewMode)}" aria-hidden="true"></i>
          </div>
        {/if}
      </div>
    {/each}

    {#if hiddenCount > 0}
      <div class="peer-overflow" role="listitem" aria-label="{hiddenCount} more peers">
        <span class="overflow-badge">+{hiddenCount} more</span>
      </div>
    {/if}
  </div>

  <!-- Screen reader announcement for peer changes -->
  <div class="visually-hidden" aria-live="polite" aria-atomic="true">
    {#if recentlyJoined.size > 0}
      {#each [...recentlyJoined] as joinedId}
        {@const peer = peerList.find((p) => p.nodeId === joinedId)}
        {#if peer}
          {peer.displayName} joined the room
        {/if}
      {/each}
    {/if}
  </div>
{:else if !isConnected}
  <div class="no-peers" role="status">
    <i class="fas fa-user-slash" aria-hidden="true"></i>
    <span>Not connected</span>
  </div>
{:else}
  <div class="no-peers" role="status">
    <i class="fas fa-users" aria-hidden="true"></i>
    <span>No peers connected</span>
  </div>
{/if}

<style>
  .peer-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
  }

  .peer-list.compact {
    padding: 8px;
    gap: 6px;
  }

  /* Peer item */
  .peer-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    border-radius: 10px;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .compact .peer-item {
    padding: 8px 10px;
    gap: 10px;
  }

  .peer-item.is-me {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.2);
  }

  .peer-item.joining {
    animation: slideIn var(--duration-emphasis, 300ms) ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Avatar */
  .peer-avatar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .compact .peer-avatar {
    width: 32px;
    height: 32px;
    min-width: 32px;
    font-size: var(--font-size-compact, 12px);
  }

  .peer-initial {
    text-transform: uppercase;
  }

  .is-me .peer-avatar {
    background: rgba(139, 92, 246, 0.3);
  }

  .quality-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    transition: background var(--duration-normal, 200ms) ease;
  }

  .compact .quality-dot {
    width: 8px;
    height: 8px;
  }

  /* Peer info */
  .peer-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .peer-name {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact .peer-name {
    font-size: var(--font-size-compact, 12px);
  }

  .you-badge {
    font-weight: 400;
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-compact, 12px);
    margin-left: 4px;
  }

  .peer-view-mode {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .peer-view-mode i {
    font-size: 10px;
  }

  .view-mode-label {
    white-space: nowrap;
  }

  /* Compact view mode icon */
  .peer-view-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  /* Overflow indicator */
  .peer-overflow {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }

  .overflow-badge {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  /* No peers state */
  .no-peers {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
  }

  .no-peers i {
    font-size: 1.5rem;
    opacity: 0.6;
  }

  /* Visually hidden for screen readers */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .peer-item.joining {
      animation: none;
    }

    .peer-item,
    .quality-dot {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .peer-list {
      border-width: 2px;
    }

    .peer-item {
      border-width: 2px;
    }

    .peer-item.is-me {
      border-color: var(--theme-accent, #8b5cf6);
    }

    .quality-dot {
      border-width: 3px;
    }
  }
</style>
