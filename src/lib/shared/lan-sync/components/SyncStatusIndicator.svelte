<!--
  SyncStatusIndicator.svelte

  Small badge showing LAN sync connection status.
  Displays different icons/colors based on connection state.
-->
<script lang="ts">
	import type { PeerConnectionStatus } from '../domain/models/lan-sync-models';

	let {
		status,
		peerCount = 0,
		compact = false
	}: {
		status: PeerConnectionStatus;
		peerCount?: number;
		compact?: boolean;
	} = $props();

	const statusConfig = $derived.by(() => {
		switch (status) {
			case 'connected':
				return {
					icon: 'fa-link',
					label: compact ? '' : `${peerCount} connected`,
					class: 'connected',
					pulse: true
				};
			case 'waiting-for-peer':
				return {
					icon: 'fa-clock',
					label: compact ? '' : 'Waiting...',
					class: 'waiting',
					pulse: true
				};
			case 'creating-room':
			case 'joining-room':
				return {
					icon: 'fa-spinner fa-spin',
					label: compact ? '' : 'Connecting...',
					class: 'connecting',
					pulse: false
				};
			case 'reconnecting':
				return {
					icon: 'fa-sync fa-spin',
					label: compact ? '' : 'Reconnecting...',
					class: 'reconnecting',
					pulse: false
				};
			case 'error':
				return {
					icon: 'fa-exclamation-triangle',
					label: compact ? '' : 'Error',
					class: 'error',
					pulse: false
				};
			case 'disconnected':
			default:
				return {
					icon: 'fa-unlink',
					label: compact ? '' : 'Disconnected',
					class: 'disconnected',
					pulse: false
				};
		}
	});
</script>

<span class="sync-status {statusConfig.class}" class:compact class:pulse={statusConfig.pulse}>
	<i class="fas {statusConfig.icon}" aria-hidden="true"></i>
	{#if statusConfig.label}
		<span class="status-label">{statusConfig.label}</span>
	{/if}
</span>

<style>
	.sync-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		transition: all var(--duration-normal) ease;
	}

	.sync-status.compact {
		padding: 4px 6px;
		gap: 0;
	}

	.sync-status i {
		font-size: 10px;
	}

	.status-label {
		white-space: nowrap;
	}

	/* Connected - green with pulse */
	.sync-status.connected {
		background: rgba(34, 197, 94, 0.15);
		color: var(--semantic-success, #22c55e);
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	/* Waiting - amber */
	.sync-status.waiting {
		background: rgba(245, 158, 11, 0.15);
		color: var(--semantic-warning, #f59e0b);
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	/* Connecting/reconnecting - blue */
	.sync-status.connecting,
	.sync-status.reconnecting {
		background: rgba(59, 130, 246, 0.15);
		color: var(--semantic-info, #3b82f6);
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	/* Error - red */
	.sync-status.error {
		background: rgba(239, 68, 68, 0.15);
		color: var(--semantic-error, #ef4444);
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	/* Disconnected - muted */
	.sync-status.disconnected {
		background: rgba(255, 255, 255, 0.05);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	/* Pulse animation for active states */
	.sync-status.pulse::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 8px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		transform: translateY(-50%);
		animation: pulse 2s infinite;
	}

	.sync-status.pulse {
		position: relative;
		padding-left: 20px;
	}

	.sync-status.pulse.compact {
		padding-left: 6px;
	}

	.sync-status.pulse.compact::before {
		display: none;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: translateY(-50%) scale(1);
		}
		50% {
			opacity: 0.5;
			transform: translateY(-50%) scale(1.2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sync-status.pulse::before {
			animation: none;
		}
	}
</style>
