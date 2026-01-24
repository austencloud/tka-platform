<!--
  NearbyTab.svelte

  Displays nearby sessions discovered via Firebase presence.
  Auto-refreshes and shows sessions available to join.
-->
<script lang="ts">
	import { connectState } from '../../state/connect-state.svelte';
	import SessionCard from './SessionCard.svelte';

	// Derived from connectState
	const nearbySessions = $derived(connectState.nearbySessions);
	const isLoading = $derived(connectState.isLoading);
	const currentUserId = $derived(connectState.currentUserId);

	async function handleJoinSession(sessionId: string) {
		await connectState.joinSession(sessionId);
	}

	function handleRefresh() {
		// The presence tracker auto-refreshes, but we can force it
		connectState.refresh();
	}
</script>

<div class="nearby-tab">
	<!-- Header with refresh -->
	<header class="tab-header">
		<div class="header-info">
			<h2>Nearby Sessions</h2>
			<p class="subtitle" aria-live="polite" aria-atomic="true">
				{#if nearbySessions.length === 0}
					No one nearby is sharing right now
				{:else}
					{nearbySessions.length} session{nearbySessions.length === 1 ? '' : 's'} found
				{/if}
			</p>
		</div>

		<button
			class="refresh-button"
			onclick={handleRefresh}
			aria-label="Refresh nearby sessions"
			disabled={isLoading}
		>
			<i class="fas fa-sync-alt" class:spinning={isLoading} aria-hidden="true"></i>
		</button>
	</header>

	<!-- Session list -->
	<div class="sessions-list">
		{#if isLoading && nearbySessions.length === 0}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Looking for sessions...</p>
			</div>
		{:else if nearbySessions.length === 0}
			<div class="empty-state">
				<div class="empty-icon">
					<i class="fas fa-broadcast-tower" aria-hidden="true"></i>
				</div>
				<h3>No sessions nearby</h3>
				<p>When someone shares a sequence, it will appear here automatically.</p>
				<div class="hint">
					<i class="fas fa-lightbulb" aria-hidden="true"></i>
					<span>Make sure you're signed in to see nearby sessions</span>
				</div>
			</div>
		{:else}
			{#each nearbySessions as session (session.sessionId)}
				<SessionCard
					{session}
					onJoin={() => handleJoinSession(session.sessionId)}
					isOwnSession={session.hostUserId === currentUserId}
				/>
			{/each}
		{/if}
	</div>
</div>

<style>
	.nearby-tab {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 16px;
		gap: 16px;
	}

	/* Header */
	.tab-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.header-info h2 {
		font-size: var(--font-size-lg, 18px);
		font-weight: 600;
		margin: 0;
		color: var(--theme-text, white);
	}

	.subtitle {
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
		margin: 4px 0 0 0;
	}

	.refresh-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 50%;
		color: var(--theme-text, white);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-button:hover:not(:disabled) {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.refresh-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-button i.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Sessions list */
	.sessions-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		overflow-y: auto;
	}

	/* Loading state */
	.loading-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-top-color: var(--theme-accent, #6366f1);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.loading-state p {
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
		margin: 0;
	}

	/* Empty state */
	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 32px;
		gap: 16px;
	}

	.empty-icon {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 50%;
	}

	.empty-icon i {
		font-size: 32px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
	}

	.empty-state h3 {
		font-size: var(--font-size-lg, 18px);
		font-weight: 600;
		margin: 0;
		color: var(--theme-text, white);
	}

	.empty-state p {
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
		margin: 0;
		max-width: 280px;
	}

	.hint {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 8px;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.hint i {
		color: var(--semantic-warning, #f59e0b);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.refresh-button i.spinning,
		.spinner {
			animation: none;
		}
	}
</style>
