<!--
  SyncConnectionSheet.svelte

  Bottom sheet for managing LAN sync connections.
  Allows creating a room (shows code) or joining an existing room (enter code).
-->
<script lang="ts">
	import Drawer from '$lib/shared/foundation/ui/Drawer.svelte';
	import SheetDragHandle from '$lib/shared/foundation/ui/SheetDragHandle.svelte';
	import { container } from '$lib/shared/di';
	import { lanSyncState, getConnectionStatusText } from '../state/lan-sync-state.svelte';
	import SyncStatusIndicator from './SyncStatusIndicator.svelte';

	interface Props {
		open?: boolean;
		sequenceId?: string;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		sequenceId = '',
		onclose
	}: Props = $props();

	const hapticService = container.items.hapticFeedback;

	// Local state
	let joinCode = $state('');
	let isCreating = $state(false);
	let isJoining = $state(false);
	let errorMessage = $state<string | null>(null);

	// Derived state from global sync state
	const connectionState = $derived(lanSyncState.connectionState);
	const isConnected = $derived(lanSyncState.isConnected);
	const isWaitingForPeer = $derived(connectionState.status === 'waiting-for-peer');
	const roomCode = $derived(lanSyncState.roomCode);

	async function handleCreateRoom() {
		if (isCreating) return;

		isCreating = true;
		errorMessage = null;
		hapticService?.trigger('selection');

		try {
			await lanSyncState.createRoom();
			hapticService?.trigger('success');
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create room';
			hapticService?.trigger('error');
		} finally {
			isCreating = false;
		}
	}

	async function handleJoinRoom() {
		const code = joinCode.trim().toUpperCase();
		if (!code || isJoining) return;

		// Normalize the code (add TKA- prefix if not present)
		const normalizedCode = code.startsWith('TKA-') ? code : `TKA-${code}`;

		isJoining = true;
		errorMessage = null;
		hapticService?.trigger('selection');

		try {
			await lanSyncState.joinRoom(normalizedCode);
			hapticService?.trigger('success');
			joinCode = '';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to join room';
			hapticService?.trigger('error');
		} finally {
			isJoining = false;
		}
	}

	function handleDisconnect() {
		hapticService?.trigger('selection');
		lanSyncState.disconnect();
		joinCode = '';
		errorMessage = null;
	}

	function handleCopyCode() {
		if (!roomCode) return;
		navigator.clipboard.writeText(roomCode);
		hapticService?.trigger('success');
	}

	function handleClose() {
		hapticService?.trigger('selection');
		errorMessage = null;
		open = false;
		onclose?.();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && joinCode.trim()) {
			handleJoinRoom();
		}
	}
</script>

<Drawer
	isOpen={open}
	labelledBy="sync-connection-title"
	onclose={handleClose}
	closeOnBackdrop={true}
	showHandle={true}
	placement="bottom"
	class="sync-sheet"
>
	<div class="sync-sheet__container">
		<SheetDragHandle />

		<!-- Header -->
		<header class="sync-sheet__header">
			<div class="header-content">
				<i class="fas fa-broadcast-tower header-icon" aria-hidden="true"></i>
				<h2 id="sync-connection-title">LAN Sync</h2>
			</div>
			<button class="close-button" onclick={handleClose} aria-label="Close">
				<i class="fas fa-times" aria-hidden="true"></i>
			</button>
		</header>

		<!-- Content -->
		<div class="sync-sheet__content">
			<!-- Status indicator when active -->
			{#if isConnected || isWaitingForPeer}
				<div class="status-section">
					<SyncStatusIndicator
						status={connectionState.status}
						peerCount={connectionState.connectedPeerCount}
					/>
				</div>
			{/if}

			<!-- Error message -->
			{#if errorMessage}
				<div class="error-banner" role="alert">
					<i class="fas fa-exclamation-circle" aria-hidden="true"></i>
					<span>{errorMessage}</span>
				</div>
			{/if}

			<!-- Connected state -->
			{#if isConnected}
				<div class="connected-info">
					<div class="info-card">
						<div class="info-label">Room Code</div>
						<div class="code-display">
							<span class="code">{roomCode}</span>
							<button class="copy-btn" onclick={handleCopyCode} aria-label="Copy room code">
								<i class="fas fa-copy" aria-hidden="true"></i>
							</button>
						</div>
					</div>

					<div class="info-card">
						<div class="info-label">Connected Devices</div>
						<div class="device-count">
							<i class="fas fa-mobile-alt" aria-hidden="true"></i>
							<span>{connectionState.connectedPeerCount + 1}</span>
						</div>
					</div>

					<p class="sync-hint">
						Play/pause on either device controls both. Switch one to Animation mode and one to Image
						mode to see synced playback.
					</p>

					<button class="disconnect-btn" onclick={handleDisconnect}>
						<i class="fas fa-unlink" aria-hidden="true"></i>
						Disconnect
					</button>
				</div>

				<!-- Waiting for peer state -->
			{:else if isWaitingForPeer}
				<div class="waiting-info">
					<div class="code-card">
						<div class="code-label">Room Code</div>
						<div class="code-display large">
							<span class="code">{roomCode}</span>
							<button class="copy-btn" onclick={handleCopyCode} aria-label="Copy room code">
								<i class="fas fa-copy" aria-hidden="true"></i>
							</button>
						</div>
					</div>

					<p class="waiting-text">
						<i class="fas fa-mobile-alt" aria-hidden="true"></i>
						Open the same sequence on another device and enter this code to connect.
					</p>

					<button class="cancel-btn" onclick={handleDisconnect}>Cancel</button>
				</div>

				<!-- Disconnected state - show create/join options -->
			{:else}
				<div class="connection-options">
					<p class="intro-text">
						Sync playback between two devices on the same network. One shows animation, the other
						shows the step grid.
					</p>

					<!-- Create Room -->
					<div class="option-section">
						<h3 class="option-title">Create Room</h3>
						<p class="option-desc">Start a new sync session and share the code with another device.</p>
						<button
							class="action-btn primary"
							onclick={handleCreateRoom}
							disabled={isCreating || isJoining}
						>
							{#if isCreating}
								<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
								Creating...
							{:else}
								<i class="fas fa-plus" aria-hidden="true"></i>
								Create Room
							{/if}
						</button>
					</div>

					<div class="divider">
						<span>or</span>
					</div>

					<!-- Join Room -->
					<div class="option-section">
						<h3 class="option-title">Join Room</h3>
						<p class="option-desc">Enter the code shown on the other device.</p>
						<div class="join-form">
							<input
								type="text"
								bind:value={joinCode}
								onkeydown={handleKeyDown}
								placeholder="Enter code (e.g., X7K9)"
								maxlength="8"
								autocomplete="off"
								autocapitalize="characters"
								disabled={isCreating || isJoining}
							/>
							<button
								class="action-btn secondary"
								onclick={handleJoinRoom}
								disabled={!joinCode.trim() || isCreating || isJoining}
							>
								{#if isJoining}
									<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
								{:else}
									<i class="fas fa-sign-in-alt" aria-hidden="true"></i>
									Join
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</Drawer>

<style>
	:global(.sync-sheet) {
		--sheet-z-index: 1200;
	}

	.sync-sheet__container {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-height: 85vh;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border-radius: 24px 24px 0 0;
		overflow: hidden;
	}

	.sync-sheet__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--theme-stroke);
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon {
		font-size: 1.25rem;
		color: var(--theme-accent);
	}

	.sync-sheet__header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--theme-text, white);
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target, 48px);
		height: var(--min-touch-target, 48px);
		border: none;
		background: var(--theme-card-bg);
		border-radius: 8px;
		color: var(--theme-text-dim);
		cursor: pointer;
		transition: all var(--duration-normal) ease;
	}

	.close-button:hover {
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text);
	}

	.sync-sheet__content {
		flex: 1;
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Status section */
	.status-section {
		display: flex;
		justify-content: center;
	}

	/* Error banner */
	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--semantic-error) 30%, transparent);
		border-radius: 8px;
		color: var(--semantic-error);
		font-size: var(--font-size-min, 14px);
	}

	/* Connected info */
	.connected-info {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.info-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: 12px;
	}

	.info-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.code-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.code-display.large {
		padding: 0.5rem;
	}

	.code {
		font-family: var(--font-mono, monospace);
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--theme-text);
		letter-spacing: 0.1em;
	}

	.code-display.large .code {
		font-size: 1.75rem;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		color: var(--theme-text-dim);
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.copy-btn:hover {
		background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		color: var(--theme-text);
	}

	.device-count {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--semantic-success);
	}

	.sync-hint {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-dim);
		text-align: center;
		line-height: 1.5;
	}

	.disconnect-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--semantic-error) 30%, transparent);
		border-radius: 12px;
		color: var(--semantic-error);
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--duration-normal) ease;
	}

	.disconnect-btn:hover {
		background: color-mix(in srgb, var(--semantic-error) 25%, transparent);
	}

	/* Waiting info */
	.waiting-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		text-align: center;
	}

	.code-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem 2rem;
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: 16px;
	}

	.code-label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.waiting-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-dim);
		line-height: 1.5;
	}

	.waiting-text i {
		color: var(--semantic-warning);
	}

	.cancel-btn {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: 1px solid var(--theme-stroke);
		border-radius: 8px;
		color: var(--theme-text-dim);
		font-size: var(--font-size-min, 14px);
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.cancel-btn:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text);
	}

	/* Connection options */
	.connection-options {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.intro-text {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-dim);
		text-align: center;
		line-height: 1.5;
	}

	.option-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.option-title {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		color: var(--theme-text);
	}

	.option-desc {
		margin: 0;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border-radius: 12px;
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--duration-normal) ease;
	}

	.action-btn.primary {
		background: var(--theme-accent);
		border: none;
		color: white;
	}

	.action-btn.primary:hover:not(:disabled) {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.action-btn.secondary {
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		color: var(--theme-text);
	}

	.action-btn.secondary:hover:not(:disabled) {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--theme-text-dim);
		font-size: var(--font-size-compact, 12px);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--theme-stroke);
	}

	.join-form {
		display: flex;
		gap: 0.75rem;
	}

	.join-form input {
		flex: 1;
		padding: 0.875rem 1rem;
		background: var(--theme-card-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: 12px;
		color: var(--theme-text);
		font-size: var(--font-size-min, 14px);
		font-family: var(--font-mono, monospace);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		transition: all var(--duration-normal) ease;
	}

	.join-form input:focus {
		outline: none;
		border-color: var(--theme-accent);
	}

	.join-form input::placeholder {
		text-transform: none;
		letter-spacing: normal;
		color: var(--theme-text-dim);
	}

	.join-form input:disabled {
		opacity: 0.5;
	}

	@media (max-width: 640px) {
		.sync-sheet__header {
			padding: 0.75rem 1rem;
		}

		.sync-sheet__content {
			padding: 1rem;
		}
	}
</style>
