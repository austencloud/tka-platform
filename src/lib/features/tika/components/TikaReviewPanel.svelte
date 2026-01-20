<!--
  TIKA Review Panel

  Two sources of review items:
  1. Flagged conversations from Firestore (user-flagged)
  2. Failed evaluation scenarios from file-based reports

  Allows Austen to:
  - Browse flagged conversations
  - Browse failed scenarios
  - See what went wrong
  - Approve/reject responses
  - Add corrections
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { TikaSessionRepository } from '../services/implementations/TikaSessionRepository';
	import { authState } from '$lib/shared/auth/state/authState.svelte';
	import type { TikaSession } from '../domain/models/tika-conversation-models';

	// Props
	let { onBack, onLoadSession }: {
		onBack?: () => void;
		onLoadSession?: (sessionId: string) => void;
	} = $props();

	// Repository for flagged conversations
	const sessionRepository = browser ? new TikaSessionRepository() : null;

	interface Issue {
		type: string;
		severity: string;
		message: string;
	}

	interface Resolution {
		resolvedAt: string;
		resolvedBy: string;
		notes: string;
		correctedResponse?: string;
	}

	interface FlaggedItem {
		id: string;
		scenarioId: string;
		scenarioName: string;
		category: string;
		difficulty: string;
		userLevel: number;
		question: string;
		tikaResponse: string;
		toolsCalled: string[];
		issues: Issue[];
		expectedKeyFacts: string[];
		timestamp: string;
		status: 'pending' | 'approved' | 'rejected' | 'needs-rewrite';
		resolution?: Resolution;
	}

	interface Summary {
		total: number;
		pending: number;
		resolved: number;
		passRate: number;
		runId: string;
		runDate: string;
	}

	// Source toggle: conversations (Firestore) vs evaluations (file-based)
	type ReviewSource = 'conversations' | 'evaluations';
	let source = $state<ReviewSource>('conversations');

	// Flagged conversations state
	let flaggedConversations = $state<TikaSession[]>([]);
	let loadingConversations = $state(true);
	let conversationsError = $state<string | null>(null);
	let selectedConversation = $state<TikaSession | null>(null);

	// Evaluation items state (existing)
	let items = $state<FlaggedItem[]>([]);
	let summary = $state<Summary | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedItem = $state<FlaggedItem | null>(null);
	let filter = $state<'all' | 'pending' | 'resolved'>('pending');

	// Check if user is authenticated
	const isAuthenticated = $derived(authState.isAuthenticated);

	// Resolution form state
	let resolutionNotes = $state('');
	let correctedResponse = $state('');
	let saving = $state(false);
	let copySuccess = $state(false);

	// Derived
	let filteredItems = $derived(
		items.filter((item) => {
			if (filter === 'all') return true;
			if (filter === 'pending') return item.status === 'pending';
			return item.status !== 'pending';
		})
	);

	// Load flagged conversations from Firestore
	async function loadFlaggedConversations() {
		if (!sessionRepository || !isAuthenticated) {
			loadingConversations = false;
			return;
		}

		loadingConversations = true;
		conversationsError = null;

		try {
			flaggedConversations = await sessionRepository.getFlaggedSessions();
		} catch (e) {
			console.error('[TikaReviewPanel] Failed to load flagged conversations:', e);
			conversationsError = 'Failed to load flagged conversations';
		} finally {
			loadingConversations = false;
		}
	}

	// Unflag a conversation
	async function unflagConversation(sessionId: string) {
		if (!sessionRepository) return;

		try {
			await sessionRepository.flagForReview(sessionId, false);
			// Remove from local list
			flaggedConversations = flaggedConversations.filter(c => c.id !== sessionId);
			if (selectedConversation?.id === sessionId) {
				selectedConversation = null;
			}
		} catch (e) {
			console.error('[TikaReviewPanel] Failed to unflag conversation:', e);
		}
	}

	// Open a flagged conversation in the chat
	function openConversation(session: TikaSession) {
		if (onLoadSession) {
			onLoadSession(session.id);
			onBack?.();
		}
	}

	// Load evaluation items (existing)
	async function loadItems() {
		loading = true;
		error = null;

		try {
			const response = await fetch('/api/tika/flagged');
			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				items = data.items;
				summary = data.summary;
			}
		} catch (e) {
			error = 'Failed to load flagged items';
		} finally {
			loading = false;
		}
	}

	// Resolve an item
	async function resolveItem(status: 'approved' | 'rejected' | 'needs-rewrite') {
		if (!selectedItem) return;

		saving = true;

		try {
			const response = await fetch('/api/tika/flagged', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					itemId: selectedItem.id,
					status,
					notes: resolutionNotes,
					correctedResponse: correctedResponse || undefined
				})
			});

			const data = await response.json();

			if (data.success) {
				// Update local state
				const idx = items.findIndex((i) => i.id === selectedItem!.id);
				if (idx >= 0) {
					items[idx] = {
						...items[idx],
						status,
						resolution: data.resolution
					};
				}

				// Clear form and selection
				selectedItem = null;
				resolutionNotes = '';
				correctedResponse = '';

				// Reload to get fresh data
				await loadItems();
			}
		} catch (e) {
			console.error('Failed to save resolution:', e);
		} finally {
			saving = false;
		}
	}

	// Copy item to clipboard for discussion
	async function copyForDiscussion() {
		if (!selectedItem) return;

		const text = `## Tika Review Item

**Scenario:** ${selectedItem.scenarioName}
**Category:** ${selectedItem.category}
**Level:** ${selectedItem.userLevel}

### Question
> ${selectedItem.question}

### Tika's Response
${selectedItem.tikaResponse}

### Issues Found
${selectedItem.issues.map((i) => `- ${i.type}: ${i.message}`).join('\n')}

### Expected Key Facts
${selectedItem.expectedKeyFacts.map((f) => `- ${f}`).join('\n')}
`;

		try {
			await navigator.clipboard.writeText(text);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	// Category badge color
	function getCategoryColor(category: string): string {
		const colors: Record<string, string> = {
			'letter-explanation': '#3b82f6',
			'term-definition': '#10b981',
			'letter-comparison': '#8b5cf6',
			'misconception-correction': '#ef4444',
			'concept-question': '#f59e0b',
			'edge-case': '#6366f1'
		};
		return colors[category] || '#64748b';
	}

	onMount(() => {
		loadFlaggedConversations();
		loadItems();
	});
</script>

<div class="review-panel">
	<header class="panel-header">
		{#if onBack}
			<button class="back-btn" onclick={onBack} title="Back to conversation" aria-label="Back to conversation">
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
			</button>
		{/if}
		<div class="header-content">
			<h2>Tika Review</h2>
			<!-- Source tabs -->
			<div class="source-tabs">
				<button
					class:active={source === 'conversations'}
					onclick={() => (source = 'conversations')}
				>
					<i class="fas fa-comments" aria-hidden="true"></i>
					Flagged ({flaggedConversations.length})
				</button>
				<button
					class:active={source === 'evaluations'}
					onclick={() => (source = 'evaluations')}
				>
					<i class="fas fa-flask" aria-hidden="true"></i>
					Evals ({items.length})
				</button>
			</div>
		</div>

		<div class="header-actions">
			{#if source === 'evaluations'}
				<div class="filter-tabs">
					<button class:active={filter === 'pending'} onclick={() => (filter = 'pending')}>
						Pending
					</button>
					<button class:active={filter === 'all'} onclick={() => (filter = 'all')}> All </button>
					<button class:active={filter === 'resolved'} onclick={() => (filter = 'resolved')}>
						Resolved
					</button>
				</div>
			{/if}
			<button
				class="refresh-btn"
				onclick={() => source === 'conversations' ? loadFlaggedConversations() : loadItems()}
				disabled={source === 'conversations' ? loadingConversations : loading}
			>
				<i class="fas fa-sync-alt" class:spinning={source === 'conversations' ? loadingConversations : loading}></i>
			</button>
		</div>
	</header>

	<div class="content-area">
		<!-- Item List -->
		<div class="item-list">
			{#if source === 'conversations'}
				<!-- Flagged Conversations List -->
				{#if loadingConversations}
					<div class="loading-state">
						<i class="fas fa-spinner fa-spin"></i>
						<span>Loading flagged conversations...</span>
					</div>
				{:else if conversationsError}
					<div class="error-state">
						<i class="fas fa-exclamation-triangle"></i>
						<span>{conversationsError}</span>
						<button onclick={loadFlaggedConversations}>Retry</button>
					</div>
				{:else if !isAuthenticated}
					<div class="empty-state">
						<i class="fas fa-lock"></i>
						<span>Sign in to see flagged conversations</span>
					</div>
				{:else if flaggedConversations.length === 0}
					<div class="empty-state">
						<i class="fas fa-flag"></i>
						<span>No flagged conversations</span>
						<p class="empty-hint">Flag conversations from the chat header to review them here</p>
					</div>
				{:else}
					{#each flaggedConversations as conversation (conversation.id)}
						<button
							class="item-card conversation-card"
							class:selected={selectedConversation?.id === conversation.id}
							onclick={() => (selectedConversation = conversation)}
						>
							<div class="item-header">
								<span class="category-badge" style="background: #f59e0b">
									<i class="fas fa-flag" aria-hidden="true"></i> Flagged
								</span>
								<span class="difficulty">{conversation.messageCount} msgs</span>
							</div>
							<h3>{conversation.title}</h3>
							<p class="question">{conversation.lastUserMessage}</p>
							<div class="timestamp">
								<i class="fas fa-clock" aria-hidden="true"></i>
								{conversation.flaggedAt ? new Date(conversation.flaggedAt).toLocaleDateString() : 'Unknown'}
							</div>
						</button>
					{/each}
				{/if}
			{:else}
				<!-- Evaluation Items List (existing) -->
				{#if loading}
					<div class="loading-state">
						<i class="fas fa-spinner fa-spin"></i>
						<span>Loading evaluation items...</span>
					</div>
				{:else if error}
					<div class="error-state">
						<i class="fas fa-exclamation-triangle"></i>
						<span>{error}</span>
						<button onclick={loadItems}>Retry</button>
					</div>
				{:else if filteredItems.length === 0}
					<div class="empty-state">
						<i class="fas fa-check-circle"></i>
						<span>No {filter === 'pending' ? 'pending' : ''} evaluation items</span>
					</div>
				{:else}
					{#each filteredItems as item (item.id)}
						<button
							class="item-card"
							class:selected={selectedItem?.id === item.id}
							class:pending={item.status === 'pending'}
							onclick={() => {
								selectedItem = item;
								resolutionNotes = '';
								correctedResponse = '';
							}}
						>
							<div class="item-header">
								<span class="category-badge" style="background: {getCategoryColor(item.category)}">
									{item.category.replace('-', ' ')}
								</span>
								<span class="difficulty">{item.difficulty}</span>
							</div>
							<h3>{item.scenarioName}</h3>
							<p class="question">{item.question}</p>
							<div class="issue-count">
								<i class="fas fa-exclamation-circle"></i>
								{item.issues.length} issue{item.issues.length !== 1 ? 's' : ''}
						</div>
						{#if item.status !== 'pending'}
							<div class="resolution-badge">
								<i class="fas fa-check"></i> Resolved
							</div>
						{/if}
					</button>
				{/each}
				{/if}
			{/if}
		</div>

		<!-- Detail Panel -->
		{#if source === 'conversations' && selectedConversation}
			<!-- Conversation Detail Panel -->
			<div class="detail-panel">
				<div class="detail-header">
					<h3>{selectedConversation.title}</h3>
					<div class="detail-actions">
						<button
							class="action-btn-small open-btn"
							onclick={() => openConversation(selectedConversation)}
							title="Open in chat"
						>
							<i class="fas fa-external-link-alt" aria-hidden="true"></i>
							Open
						</button>
						<button
							class="action-btn-small unflag-btn"
							onclick={() => unflagConversation(selectedConversation.id)}
							title="Remove from review"
						>
							<i class="fas fa-flag-checkered" aria-hidden="true"></i>
							Done
						</button>
					</div>
				</div>

				<div class="detail-content">
					<section class="detail-section">
						<h4>Conversation</h4>
						<div class="conversation-messages">
							{#each selectedConversation.messages as message}
								<div class="message-preview" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
									<span class="role-label">{message.role === 'user' ? 'You' : 'Tika'}</span>
									<div class="message-text">
										{#if message.parts}
											{@const textPart = message.parts.find(p => p.type === 'text')}
											{#if textPart && 'text' in textPart}
												{textPart.text.slice(0, 500)}{textPart.text.length > 500 ? '...' : ''}
											{/if}
										{:else if message.content}
											{message.content.slice(0, 500)}{message.content.length > 500 ? '...' : ''}
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</section>

					<section class="detail-section">
						<h4>Info</h4>
						<p><strong>Messages:</strong> {selectedConversation.messageCount}</p>
						<p><strong>Created:</strong> {new Date(selectedConversation.createdAt).toLocaleString()}</p>
						<p><strong>Flagged:</strong> {selectedConversation.flaggedAt ? new Date(selectedConversation.flaggedAt).toLocaleString() : 'Unknown'}</p>
					</section>
				</div>
			</div>
		{:else if source === 'evaluations' && selectedItem}
			<div class="detail-panel">
				<div class="detail-header">
					<h3>{selectedItem.scenarioName}</h3>
					<button class="copy-btn" class:success={copySuccess} onclick={copyForDiscussion} title="Copy for discussion">
						<i class="fas" class:fa-copy={!copySuccess} class:fa-check={copySuccess}></i>
					</button>
				</div>

				<!-- Scrollable content area -->
				<div class="detail-content">
					<section class="detail-section">
						<h4>Question</h4>
						<blockquote>{selectedItem.question}</blockquote>
					</section>

					<section class="detail-section">
						<h4>Tika's Response</h4>
						<div class="response-text">{selectedItem.tikaResponse}</div>
					</section>

					<section class="detail-section issues">
						<h4>Issues Found</h4>
						<ul>
							{#each selectedItem.issues as issue}
								<li class="issue-item" class:error={issue.severity === 'error'}>
									<strong>{issue.type}:</strong>
									{issue.message}
								</li>
							{/each}
						</ul>
					</section>

					<section class="detail-section">
						<h4>Expected Key Facts</h4>
						<ul>
							{#each selectedItem.expectedKeyFacts as fact}
								<li>{fact}</li>
							{/each}
						</ul>
					</section>

					{#if selectedItem.toolsCalled.length > 0}
						<section class="detail-section">
							<h4>Tools Called</h4>
							<div class="tools-list">
								{#each selectedItem.toolsCalled as tool}
									<span class="tool-badge">{tool}</span>
								{/each}
							</div>
						</section>
					{/if}
				</div>

				<!-- Resolution Form - fixed at bottom -->
				{#if selectedItem.status === 'pending'}
					<div class="resolution-footer">
						<section class="resolution-form">
							<h4>Resolution</h4>

							<label>
								<span>Notes</span>
								<textarea
									bind:value={resolutionNotes}
									placeholder="What's wrong with this response? How should it be fixed?"
									rows="2"
								></textarea>
							</label>

							<label>
								<span>Corrected Response (optional)</span>
								<textarea
									bind:value={correctedResponse}
									placeholder="Write the ideal response..."
									rows="2"
								></textarea>
							</label>

							<div class="resolution-actions">
								<button
									class="approve-btn"
									onclick={() => resolveItem('approved')}
									disabled={saving}
								>
									<i class="fas fa-check"></i> Approve
								</button>
								<button
									class="rewrite-btn"
									onclick={() => resolveItem('needs-rewrite')}
									disabled={saving || !correctedResponse}
								>
									<i class="fas fa-pen"></i> Use Correction
								</button>
								<button
									class="reject-btn"
									onclick={() => resolveItem('rejected')}
									disabled={saving}
								>
									<i class="fas fa-times"></i> Reject
								</button>
							</div>
						</section>
					</div>
				{:else if selectedItem.resolution}
					<div class="resolution-footer">
						<section class="resolution-display">
							<h4>Resolution</h4>
							<p><strong>Status:</strong> {selectedItem.status}</p>
							<p><strong>Resolved:</strong> {new Date(selectedItem.resolution.resolvedAt).toLocaleString()}</p>
							{#if selectedItem.resolution.notes}
								<p><strong>Notes:</strong> {selectedItem.resolution.notes}</p>
							{/if}
							{#if selectedItem.resolution.correctedResponse}
								<div class="corrected-response">
									<strong>Corrected Response:</strong>
									<div class="response-text">{selectedItem.resolution.correctedResponse}</div>
								</div>
							{/if}
						</section>
					</div>
				{/if}
			</div>
		{:else}
			<div class="no-selection">
				<i class="fas fa-mouse-pointer"></i>
				<span>Select an item to review</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.review-panel {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
	}

	.panel-header {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		gap: 12px;
		background: rgba(15, 20, 30, 0.95);
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target, 48px);
		height: var(--min-touch-target, 48px);
		padding: 0;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(100, 100, 120, 0.85), rgba(70, 70, 90, 0.85));
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		font-size: 16px;
		cursor: pointer;
		transition: all var(--duration-normal, 0.3s) ease;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.back-btn:hover {
		background: linear-gradient(135deg, rgba(120, 120, 140, 0.95), rgba(90, 90, 110, 0.95));
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.back-btn:active {
		transform: scale(0.95);
	}

	.back-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.stats {
		display: flex;
		gap: 0.75rem;
	}

	.stat {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.stat.pass-rate {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
	}

	.stat.pending {
		background: rgba(245, 158, 11, 0.2);
		color: #fbbf24;
	}

	.stat.resolved {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.filter-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		padding: 0.25rem;
		border-radius: 6px;
	}

	.filter-tabs button {
		padding: 0.375rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: 0.875rem;
		cursor: pointer;
		border-radius: 4px;
		transition: all var(--duration-fast) ease;
	}

	.filter-tabs button:hover {
		color: var(--theme-text, #fff);
	}

	.filter-tabs button.active {
		background: var(--theme-accent, #6366f1);
		color: white;
	}

	.refresh-btn {
		width: 36px;
		height: 36px;
		border: none;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		border-radius: 6px;
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.refresh-btn:hover {
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text, #fff);
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.content-area {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.item-list {
		width: 320px;
		min-width: 280px;
		border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.item-card {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.75rem;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.item-card:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.item-card.selected {
		border-color: var(--theme-accent, #6366f1);
		background: rgba(99, 102, 241, 0.1);
	}

	.item-card.pending {
		border-left: 3px solid #f59e0b;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.category-badge {
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		color: white;
	}

	.difficulty {
		font-size: 0.75rem;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
	}

	.item-card h3 {
		margin: 0 0 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--theme-text, #fff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-card .question {
		margin: 0;
		font-size: 0.75rem;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.issue-count {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #ef4444;
	}

	.resolution-badge {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #4ade80;
	}

	.detail-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1rem 0.5rem;
		flex-shrink: 0;
	}

	.detail-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 1rem 1rem;
		min-height: 0;
	}

	.resolution-footer {
		flex-shrink: 0;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		padding: 0.75rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
	}

	.copy-btn {
		width: 36px;
		height: 36px;
		border: none;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		border-radius: 6px;
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.copy-btn:hover {
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text, #fff);
	}

	.copy-btn.success {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
	}

	.detail-section {
		margin-bottom: 1.25rem;
	}

	.detail-section h4 {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	blockquote {
		margin: 0;
		padding: 0.75rem 1rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-left: 3px solid var(--theme-accent, #6366f1);
		border-radius: 0 6px 6px 0;
		font-size: 0.9375rem;
		font-style: italic;
	}

	.response-text {
		padding: 0.75rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 6px;
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.issues ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.issue-item {
		padding: 0.5rem 0.75rem;
		background: rgba(245, 158, 11, 0.1);
		border-radius: 6px;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.issue-item.error {
		background: rgba(239, 68, 68, 0.1);
		color: #fca5a5;
	}

	.tools-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.tool-badge {
		padding: 0.25rem 0.5rem;
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: monospace;
	}

	.resolution-form {
		padding: 0.5rem;
		background: transparent;
	}

	.resolution-form h4 {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.resolution-form label {
		display: block;
		margin-bottom: 0.5rem;
	}

	.resolution-form label span {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
	}

	.resolution-form textarea {
		width: 100%;
		padding: 0.5rem;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		color: var(--theme-text, #fff);
		font-size: 0.8125rem;
		resize: none;
	}

	.resolution-form textarea:focus {
		outline: none;
		border-color: var(--theme-accent, #6366f1);
	}

	.resolution-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.resolution-actions button {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.approve-btn {
		background: #22c55e;
		color: white;
	}

	.approve-btn:hover {
		background: #16a34a;
	}

	.rewrite-btn {
		background: #6366f1;
		color: white;
	}

	.rewrite-btn:hover:not(:disabled) {
		background: #4f46e5;
	}

	.reject-btn {
		background: #64748b;
		color: white;
	}

	.reject-btn:hover {
		background: #475569;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.resolution-display {
		padding: 1rem;
		background: rgba(34, 197, 94, 0.1);
		border-radius: 8px;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.resolution-display p {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
	}

	.corrected-response {
		margin-top: 0.75rem;
	}

	.no-selection,
	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 0.75rem;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		text-align: center;
		padding: 2rem;
	}

	.no-selection i,
	.loading-state i,
	.error-state i,
	.empty-state i {
		font-size: 2rem;
		opacity: 0.5;
	}

	.error-state {
		color: #ef4444;
	}

	.error-state button {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text, #fff);
		border-radius: 6px;
		cursor: pointer;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.content-area {
			flex-direction: column;
		}

		.item-list {
			width: 100%;
			max-height: 40vh;
			border-right: none;
			border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		}

		.detail-panel {
			min-height: 0;
		}
	}

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinning {
      animation: none;
    }
  }

	/* Source tabs */
	.source-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		padding: 0.25rem;
		border-radius: 6px;
		margin-left: 1rem;
	}

	.source-tabs button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: 0.875rem;
		cursor: pointer;
		border-radius: 4px;
		transition: all var(--duration-fast) ease;
	}

	.source-tabs button:hover {
		color: var(--theme-text, #fff);
	}

	.source-tabs button.active {
		background: var(--theme-accent, #6366f1);
		color: white;
	}

	.source-tabs button i {
		font-size: 0.75rem;
	}

	/* Conversation card styles */
	.conversation-card .timestamp {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.empty-hint {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		opacity: 0.7;
	}

	/* Conversation detail panel */
	.detail-actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn-small {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast) ease;
	}

	.open-btn {
		background: var(--theme-accent, #6366f1);
		color: white;
	}

	.open-btn:hover {
		background: #4f46e5;
	}

	.unflag-btn {
		background: #22c55e;
		color: white;
	}

	.unflag-btn:hover {
		background: #16a34a;
	}

	/* Conversation messages preview */
	.conversation-messages {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.message-preview {
		padding: 0.75rem;
		border-radius: 8px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
	}

	.message-preview.user {
		border-left: 3px solid var(--theme-accent, #6366f1);
	}

	.message-preview.assistant {
		border-left: 3px solid #22c55e;
	}

	.role-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		margin-bottom: 0.375rem;
	}

	.message-text {
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
