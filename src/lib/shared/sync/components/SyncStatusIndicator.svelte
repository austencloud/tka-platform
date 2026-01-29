<!--
  SyncStatusIndicator.svelte

  Displays the current device sync connection status as a small indicator.
  Shows connection quality, peer count, latency on hover/tap, and handles
  all connection states with appropriate visual feedback.

  Enhanced features:
  - Latency display on hover/tap (e.g., "12ms")
  - Smooth color transitions
  - Expandable latency tooltip
-->
<script lang="ts">
	import {
		deviceSyncState,
		getConnectionStatusText,
		getQualityIndicator
	} from '../state/device-sync-state.svelte';

	interface Props {
		/** If true, only show dot without text */
		compact?: boolean;
		/** If true, show quality indicator color when connected */
		showQuality?: boolean;
		/** If true, always show latency when connected (not just on hover) */
		showLatencyAlways?: boolean;
	}

	let { compact = false, showQuality = true, showLatencyAlways = false }: Props = $props();

	// Internal state for hover/tap latency display
	let isHovering = $state(false);
	let isTapped = $state(false);

	// Reactive derivations from deviceSyncState
	const status = $derived(deviceSyncState.connectionState.status);
	const peerCount = $derived(deviceSyncState.peerCount);
	const quality = $derived(deviceSyncState.quality);
	const errorMessage = $derived(deviceSyncState.connectionState.errorMessage);
	const lastRttMs = $derived(deviceSyncState.connectionState.lastRttMs);

	// Get quality indicator colors
	const qualityInfo = $derived(getQualityIndicator(quality));

	// Show latency when hovering, tapped, or always enabled
	const showLatency = $derived(
		status === 'connected' &&
		lastRttMs !== null &&
		(showLatencyAlways || isHovering || isTapped)
	);

	// Format latency for display
	const latencyText = $derived.by(() => {
		if (lastRttMs === null) return '';
		if (lastRttMs < 1) return '<1ms';
		if (lastRttMs < 1000) return `${Math.round(lastRttMs)}ms`;
		return `${(lastRttMs / 1000).toFixed(1)}s`;
	});

	// Determine dot color based on status and quality
	const dotColor = $derived.by(() => {
		switch (status) {
			case 'connected':
				return showQuality ? qualityInfo.color : 'var(--semantic-success)';
			case 'creating-room':
			case 'waiting-for-peer':
			case 'joining-room':
			case 'reconnecting':
				return 'var(--semantic-warning)';
			case 'error':
				return 'var(--semantic-error)';
			case 'disconnected':
			default:
				return 'var(--theme-text-muted, rgba(255, 255, 255, 0.4))';
		}
	});

	// Should the dot pulse?
	const shouldPulse = $derived(
		status === 'creating-room' ||
			status === 'waiting-for-peer' ||
			status === 'joining-room' ||
			status === 'reconnecting'
	);

	// Status text for display
	const statusText = $derived.by(() => {
		if (compact) return '';

		switch (status) {
			case 'connected':
				return peerCount === 1 ? '(1 peer)' : `(${peerCount} peers)`;
			case 'waiting-for-peer':
				return 'Waiting...';
			case 'joining-room':
				return 'Joining...';
			case 'creating-room':
				return 'Creating...';
			case 'reconnecting':
				return 'Reconnecting...';
			case 'error':
				return '';
			case 'disconnected':
			default:
				return '';
		}
	});

	// Should show error icon?
	const showErrorIcon = $derived(status === 'error');

	// Tooltip text
	const tooltipText = $derived.by(() => {
		const baseText = getConnectionStatusText(status);
		if (status === 'connected' && showQuality) {
			const latencyPart = lastRttMs !== null ? ` (${latencyText})` : '';
			return `${baseText} - ${qualityInfo.label} quality${latencyPart}`;
		}
		if (status === 'error' && errorMessage) {
			return `${baseText}: ${errorMessage}`;
		}
		return baseText;
	});

	// Aria label for accessibility
	const ariaLabel = $derived.by(() => {
		switch (status) {
			case 'connected': {
				const latencyPart = lastRttMs !== null ? ` Latency: ${latencyText}.` : '';
				return `Connected to ${peerCount} ${peerCount === 1 ? 'peer' : 'peers'}. Connection quality: ${qualityInfo.label}.${latencyPart}`;
			}
			case 'waiting-for-peer':
				return 'Waiting for another device to connect';
			case 'joining-room':
				return 'Joining sync room';
			case 'creating-room':
				return 'Creating sync room';
			case 'reconnecting':
				return 'Reconnecting to sync room';
			case 'error':
				return `Connection error${errorMessage ? `: ${errorMessage}` : ''}`;
			case 'disconnected':
			default:
				return 'Not connected to sync';
		}
	});

	// Handlers for hover/tap
	function handleMouseEnter(): void {
		isHovering = true;
	}

	function handleMouseLeave(): void {
		isHovering = false;
	}

	function handleTap(): void {
		// Toggle tapped state on mobile
		isTapped = !isTapped;
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleTap();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="sync-status-indicator"
	class:compact
	class:interactive={status === 'connected'}
	role={status === 'connected' ? 'button' : 'status'}
	aria-live="polite"
	aria-label={ariaLabel}
	title={tooltipText}
	tabindex={status === 'connected' ? 0 : -1}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onclick={handleTap}
	onkeydown={handleKeyDown}
>
	<span
		class="status-dot"
		class:pulse={shouldPulse}
		style:--dot-color={dotColor}
		aria-hidden="true"
	>
		{#if showErrorIcon}
			<i class="fas fa-exclamation" aria-hidden="true"></i>
		{/if}
	</span>

	{#if showLatency}
		<span class="latency-text" aria-live="polite">
			{latencyText}
		</span>
	{/if}

	{#if statusText}
		<span class="status-text">{statusText}</span>
	{/if}
</div>

<style>
	.sync-status-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		min-height: 48px; /* WCAG AAA touch target */
		min-width: 48px;
		cursor: default;
		user-select: none;
	}

	.sync-status-indicator.compact {
		padding: 4px;
		gap: 0;
	}

	.status-dot {
		position: relative;
		width: 12px;
		height: 12px;
		min-width: 12px;
		min-height: 12px;
		border-radius: 50%;
		background-color: var(--dot-color);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color var(--duration-normal, 200ms) ease;
	}

	.status-dot i {
		font-size: 6px;
		color: white;
	}

	/* Pulse animation for connecting/waiting states */
	.status-dot.pulse {
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(1.1);
		}
	}

	.status-text {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		white-space: nowrap;
		font-weight: 500;
	}

	/* Interactive state when connected */
	.sync-status-indicator.interactive {
		cursor: pointer;
	}

	.sync-status-indicator.interactive:focus-visible {
		outline: 2px solid var(--theme-accent, #8b5cf6);
		outline-offset: 2px;
		border-radius: 6px;
	}

	/* Latency text display */
	.latency-text {
		font-size: var(--font-size-compact, 12px);
		font-family: var(--font-mono, monospace);
		font-weight: 600;
		color: var(--dot-color, var(--semantic-success));
		white-space: nowrap;
		animation: fadeIn var(--duration-normal, 200ms) ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-4px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.status-dot.pulse {
			animation: none;
		}

		.status-dot {
			transition: none;
		}

		.latency-text {
			animation: none;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.status-dot {
			border: 2px solid currentColor;
		}

		.status-text {
			color: var(--theme-text, white);
		}
	}
</style>
