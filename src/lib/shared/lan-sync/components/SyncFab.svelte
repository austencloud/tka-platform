<!--
  SyncFab.svelte

  Circular button to toggle LAN sync panel.
  Shows connection status via icon and color.
  Placed in the SequenceViewer mode-switch-row.
-->
<script lang="ts">
	import type { PeerConnectionStatus } from '../domain/models/lan-sync-models';

	interface Props {
		status?: PeerConnectionStatus;
		onclick?: () => void;
	}

	let { status = 'disconnected', onclick }: Props = $props();

	const isActive = $derived(status === 'connected' || status === 'waiting-for-peer');
	const isConnecting = $derived(
		status === 'creating-room' || status === 'joining-room' || status === 'reconnecting'
	);

	function handleClick() {
		onclick?.();
	}
</script>

<button
	type="button"
	class="sync-fab"
	class:active={isActive}
	class:connecting={isConnecting}
	class:error={status === 'error'}
	onclick={handleClick}
	aria-label={isActive ? 'LAN Sync active - tap to manage' : 'Open LAN Sync'}
	title="LAN Sync"
>
	{#if isConnecting}
		<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
	{:else if isActive}
		<i class="fas fa-link" aria-hidden="true"></i>
	{:else}
		<i class="fas fa-broadcast-tower" aria-hidden="true"></i>
	{/if}
</button>

<style>
	.sync-fab {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		transition: all var(--duration-normal) ease;
		position: relative;
	}

	.sync-fab i {
		font-size: 20px;
		transition: all var(--duration-normal) ease;
	}

	/* Hover state */
	.sync-fab:hover {
		transform: scale(1.08);
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.sync-fab:active {
		transform: scale(0.95);
	}

	.sync-fab:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	/* Active/connected state - green glow */
	.sync-fab.active {
		background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
		border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
		color: var(--semantic-success, #22c55e);
	}

	.sync-fab.active::after {
		content: '';
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 2px solid color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
		animation: pulse-ring 2s infinite;
	}

	.sync-fab.active:hover {
		background: color-mix(in srgb, var(--semantic-success, #22c55e) 25%, transparent);
		border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent);
	}

	/* Connecting state - blue */
	.sync-fab.connecting {
		background: color-mix(in srgb, var(--semantic-info, #3b82f6) 15%, transparent);
		border-color: color-mix(in srgb, var(--semantic-info, #3b82f6) 40%, transparent);
		color: var(--semantic-info, #3b82f6);
	}

	/* Error state - red */
	.sync-fab.error {
		background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
		border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
		color: var(--semantic-error, #ef4444);
	}

	@keyframes pulse-ring {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.5;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sync-fab.active::after {
			animation: none;
		}
	}
</style>
