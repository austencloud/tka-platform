<!--
  TIKA Review Panel - Unified Review Workflow

  Single source of truth for reviewing Tika conversations.
  Replaces the old dual-source (Firestore + file-based evaluations) approach.

  Workflow:
  - Conversations are flagged by users → status: "pending"
  - /tika command claims and reviews → status: "claimed" → "approved" | "in-review" | "needs-correction"
  - Human reviews AI's assessment → can approve, request correction, or archive
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { TikaSessionRepository } from '../services/implementations/TikaSessionRepository';
	import { authState } from '$lib/shared/auth/state/authState.svelte';
	import type { TikaSession, ReviewStatus } from '../domain/models/tika-conversation-models';
	import CopyAsImageButton from '$lib/shared/foundation/ui/CopyAsImageButton.svelte';
	import CopyForAIButton from '$lib/shared/foundation/ui/CopyForAIButton.svelte';
	import TikaConversationReadOnly from './TikaConversationReadOnly.svelte';

	// Props
	let { onBack, onLoadSession }: {
		onBack?: () => void;
		onLoadSession?: (sessionId: string) => void;
	} = $props();

	// Repository
	const sessionRepository = browser ? new TikaSessionRepository() : null;

	// State
	let sessions = $state<TikaSession[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedSession = $state<TikaSession | null>(null);

	// Filter state - which status tabs to show
	type FilterTab = 'pending' | 'in-review' | 'completed' | 'all';
	let activeTab = $state<FilterTab>('pending');

	// Notes input state
	let notesInput = $state('');
	let savingNotes = $state(false);

	// Check if user is authenticated
	const isAuthenticated = $derived(authState.isAuthenticated);

	// Filter sessions by active tab
	const filteredSessions = $derived(() => {
		if (activeTab === 'all') return sessions;
		if (activeTab === 'pending') {
			return sessions.filter(s => s.reviewStatus === 'pending');
		}
		if (activeTab === 'in-review') {
			return sessions.filter(s =>
				s.reviewStatus === 'claimed' ||
				s.reviewStatus === 'in-review' ||
				s.reviewStatus === 'needs-correction'
			);
		}
		if (activeTab === 'completed') {
			return sessions.filter(s =>
				s.reviewStatus === 'approved' ||
				s.reviewStatus === 'archived'
			);
		}
		return sessions;
	});

	// Count by status for tab badges
	const statusCounts = $derived(() => {
		const pending = sessions.filter(s => s.reviewStatus === 'pending').length;
		const inReview = sessions.filter(s =>
			s.reviewStatus === 'claimed' ||
			s.reviewStatus === 'in-review' ||
			s.reviewStatus === 'needs-correction'
		).length;
		const completed = sessions.filter(s =>
			s.reviewStatus === 'approved' ||
			s.reviewStatus === 'archived'
		).length;
		return { pending, inReview, completed };
	});

	// Load sessions from Firestore
	async function loadSessions() {
		if (!sessionRepository || !isAuthenticated) {
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			// Get all flagged sessions (they all have review status)
			sessions = await sessionRepository.getReviewQueue();
		} catch (e) {
			console.error('[TikaReviewPanel] Failed to load sessions:', e);
			error = 'Failed to load review queue';
		} finally {
			loading = false;
		}
	}

	// Get status indicator info
	function getStatusInfo(status: ReviewStatus | undefined): {
		color: string;
		icon: string;
		label: string;
	} {
		switch (status) {
			case 'pending':
				return { color: '#f59e0b', icon: 'fa-flag', label: 'Pending' };
			case 'claimed':
				return { color: '#3b82f6', icon: 'fa-robot', label: 'Claimed by AI' };
			case 'in-review':
				return { color: '#8b5cf6', icon: 'fa-user-check', label: 'In Review' };
			case 'approved':
				return { color: '#22c55e', icon: 'fa-check-circle', label: 'Approved' };
			case 'needs-correction':
				return { color: '#ef4444', icon: 'fa-exclamation-circle', label: 'Needs Fix' };
			case 'archived':
				return { color: '#64748b', icon: 'fa-archive', label: 'Archived' };
			default:
				return { color: '#64748b', icon: 'fa-question', label: 'Unknown' };
		}
	}

	// Format relative time
	function formatRelativeTime(date: Date | undefined): string {
		if (!date) return 'Unknown';
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (hours < 1) return 'Just now';
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	}

	// Save notes for a session
	async function saveNotes() {
		if (!sessionRepository || !selectedSession || !notesInput.trim()) return;

		savingNotes = true;
		try {
			await sessionRepository.addReviewNotes(selectedSession.id, notesInput);
			// Update local state
			const idx = sessions.findIndex(s => s.id === selectedSession!.id);
			if (idx >= 0) {
				sessions[idx] = {
					...sessions[idx],
					reviewMetadata: {
						...sessions[idx].reviewMetadata,
						notes: notesInput,
					}
				};
				selectedSession = sessions[idx];
			}
		} catch (e) {
			console.error('[TikaReviewPanel] Failed to save notes:', e);
		} finally {
			savingNotes = false;
		}
	}

	// Archive a session
	async function archiveSession(sessionId: string) {
		if (!sessionRepository) return;

		try {
			await sessionRepository.archiveReview(sessionId);
			// Update local state
			const idx = sessions.findIndex(s => s.id === sessionId);
			if (idx >= 0) {
				sessions[idx] = { ...sessions[idx], reviewStatus: 'archived' };
			}
			if (selectedSession?.id === sessionId) {
				selectedSession = sessions[idx];
			}
		} catch (e) {
			console.error('[TikaReviewPanel] Failed to archive session:', e);
		}
	}

	// Approve a session (after human review)
	async function approveSession(sessionId: string) {
		if (!sessionRepository) return;

		try {
			await sessionRepository.updateReviewStatus(sessionId, 'approved');
			// Update local state
			const idx = sessions.findIndex(s => s.id === sessionId);
			if (idx >= 0) {
				sessions[idx] = { ...sessions[idx], reviewStatus: 'approved' };
			}
			if (selectedSession?.id === sessionId) {
				selectedSession = sessions[idx];
			}
		} catch (e) {
			console.error('[TikaReviewPanel] Failed to approve session:', e);
		}
	}

	// Open conversation in chat
	function openInChat(session: TikaSession) {
		if (onLoadSession) {
			onLoadSession(session.id);
			onBack?.();
		}
	}

	// Handle session selection
	function selectSession(session: TikaSession) {
		selectedSession = session;
		notesInput = session.reviewMetadata?.notes || '';
	}

	// Extract text content from a UIMessage, including tool outputs
	function getMessageText(message: { parts?: unknown[]; content?: string }): string {
		// First try text parts
		if (message.parts) {
			const textParts = message.parts.filter((p: unknown) => {
				const part = p as { type?: string };
				return part.type === 'text';
			});
			const textContent = textParts
				.map((p: unknown) => (p as { text?: string }).text || '')
				.join('');
			if (textContent) return textContent;

			// If no text parts, try tool outputs
			for (const part of message.parts) {
				const p = part as { type?: string; output?: unknown; state?: string; toolInvocation?: { state: string; result?: unknown } };
				// New AI SDK format: type is "tool-{toolName}"
				if (p.type?.startsWith('tool-') && p.type !== 'tool-invocation') {
					if (p.state === 'output-available' && p.output) {
						const text = extractExplanation(p.output);
						if (text) return text;
					}
				}
				// Old format: tool-invocation
				if (p.type === 'tool-invocation' && p.toolInvocation) {
					if (p.toolInvocation.state === 'result' && p.toolInvocation.result) {
						const text = extractExplanation(p.toolInvocation.result);
						if (text) return text;
					}
				}
			}
		}

		// Fallback to content field
		return message.content || '';
	}

	// Extract explanation from tool output
	function extractExplanation(output: unknown): string {
		if (typeof output === 'string') return output;
		if (output && typeof output === 'object') {
			const obj = output as Record<string, unknown>;
			// Check for explanation field (canonical response format)
			if (typeof obj.explanation === 'string') {
				return obj.explanation;
			}
		}
		return '';
	}

	// Reference for image capture - will be set by the TikaConversationReadOnly component
	let conversationReadOnlyComponent: TikaConversationReadOnly | null = $state(null);
	let conversationPreviewEl: HTMLElement | null = $derived(
		conversationReadOnlyComponent?.getContainerElement() ?? null
	);

	// Generate comprehensive conversation data for AI review
	function generateCopyForAI(): string {
		if (!selectedSession) return '';

		const lines: string[] = [
			'# Tika Conversation for Review',
			'',
			`**Session ID:** ${selectedSession.id}`,
			`**Created:** ${selectedSession.createdAt.toLocaleString()}`,
			`**Messages:** ${selectedSession.messageCount}`,
			`**Review Status:** ${selectedSession.reviewStatus || 'Not reviewed'}`,
		];

		// Add review metadata if available
		if (selectedSession.reviewMetadata) {
			const meta = selectedSession.reviewMetadata;
			if (meta.grade) {
				lines.push(`**Grade:** ${meta.grade}${meta.confidence ? ` (${meta.confidence}% confidence)` : ''}`);
			}
			if (meta.notes) {
				lines.push(`**Reviewer Notes:** ${meta.notes}`);
			}
			if (meta.aiNotes) {
				lines.push(`**AI Analysis:** ${meta.aiNotes}`);
			}
		}

		lines.push('', '---', '');

		// Process each message with full tool details
		for (const message of selectedSession.messages) {
			if (message.role === 'user') {
				lines.push('## User Question');
				lines.push('');
				lines.push(getMessageText(message));
				lines.push('');
			} else if (message.role === 'assistant') {
				lines.push('## Tika Response');
				lines.push('');

				// Process message parts in detail
				if (message.parts) {
					// First, get any direct text content
					const textParts = message.parts.filter((p: unknown) => {
						const part = p as { type?: string };
						return part.type === 'text';
					});
					const textContent = textParts
						.map((p: unknown) => (p as { text?: string }).text || '')
						.join('');
					if (textContent) {
						lines.push(textContent);
						lines.push('');
					}

					// Then process all tool invocations with FULL details
					const toolDetails: string[] = [];
					for (const part of message.parts) {
						const p = part as {
							type?: string;
							input?: Record<string, unknown>;
							output?: unknown;
							state?: string;
							toolInvocation?: {
								toolName: string;
								args: Record<string, unknown>;
								state: string;
								result?: unknown;
							};
						};

						// New AI SDK format: type is "tool-{toolName}"
						if (p.type?.startsWith('tool-') && p.type !== 'tool-invocation') {
							const toolName = p.type.replace('tool-', '');
							const isComplete = p.state === 'output-available';

							toolDetails.push(`### Tool: \`${toolName}\``);
							toolDetails.push('');
							toolDetails.push(`**Status:** ${isComplete ? '✅ Completed' : '⏳ Pending'}`);

							// Input parameters
							if (p.input) {
								toolDetails.push('');
								toolDetails.push('**Input:**');
								toolDetails.push('```json');
								toolDetails.push(JSON.stringify(p.input, null, 2));
								toolDetails.push('```');
							}

							// Output
							if (isComplete && p.output) {
								toolDetails.push('');
								toolDetails.push('**Output:**');

								const output = p.output as Record<string, unknown>;

								// Extract explanation if present
								if (typeof output.explanation === 'string') {
									toolDetails.push('');
									toolDetails.push('*Explanation:*');
									toolDetails.push(output.explanation);
								}

								// Extract inline pictograph details
								if (output.inlinePictograph) {
									const pic = output.inlinePictograph as Record<string, unknown>;
									toolDetails.push('');
									toolDetails.push('*Generated Pictograph:*');
									toolDetails.push(`- Letter: ${pic.letter}`);
									if (pic.variation !== undefined) toolDetails.push(`- Variation: ${pic.variation}`);
									if (pic.propType) toolDetails.push(`- Prop Type: ${pic.propType}`);
									if (pic.imageUrl) toolDetails.push(`- Image: Generated successfully`);
								}

								// Extract inline gallery details
								if (output.inlineGallery) {
									const gal = output.inlineGallery as Record<string, unknown>;
									const items = gal.items as unknown[] || [];
									toolDetails.push('');
									toolDetails.push('*Generated Gallery:*');
									if (gal.title) toolDetails.push(`- Title: ${gal.title}`);
									toolDetails.push(`- Items: ${items.length} pictographs`);
									for (const item of items.slice(0, 5)) {
										const it = item as Record<string, unknown>;
										toolDetails.push(`  - ${it.label || it.letter || 'Unknown'}`);
									}
									if (items.length > 5) {
										toolDetails.push(`  - ... and ${items.length - 5} more`);
									}
								}

								// Extract multiple galleries
								if (output.inlineGalleries && Array.isArray(output.inlineGalleries)) {
									for (const gal of output.inlineGalleries) {
										const gallery = gal as Record<string, unknown>;
										const items = gallery.items as unknown[] || [];
										toolDetails.push('');
										toolDetails.push(`*Gallery: ${gallery.title || 'Untitled'}*`);
										toolDetails.push(`- Items: ${items.length} pictographs`);
									}
								}

								// Extract sequence player details
								if (output.inlineSequencePlayer) {
									const seq = output.inlineSequencePlayer as Record<string, unknown>;
									toolDetails.push('');
									toolDetails.push('*Generated Sequence Player:*');
									if (seq.word) toolDetails.push(`- Word: ${seq.word}`);
								}

								// Extract quiz details
								if (output.inlineQuiz) {
									const quiz = output.inlineQuiz as Record<string, unknown>;
									toolDetails.push('');
									toolDetails.push('*Generated Quiz:*');
									if (quiz.question) toolDetails.push(`- Question: ${quiz.question}`);
									if (quiz.options && Array.isArray(quiz.options)) {
										toolDetails.push(`- Options: ${quiz.options.length}`);
									}
								}

								// Raw output for inspection (truncated)
								const outputStr = JSON.stringify(output);
								if (outputStr.length < 500) {
									toolDetails.push('');
									toolDetails.push('*Raw Output (for debugging):*');
									toolDetails.push('```json');
									toolDetails.push(JSON.stringify(output, null, 2));
									toolDetails.push('```');
								}
							}
							toolDetails.push('');
						}

						// Old format: tool-invocation
						if (p.type === 'tool-invocation' && p.toolInvocation) {
							const inv = p.toolInvocation;
							const isComplete = inv.state === 'result';

							toolDetails.push(`### Tool: \`${inv.toolName}\``);
							toolDetails.push('');
							toolDetails.push(`**Status:** ${isComplete ? '✅ Completed' : '⏳ Pending'}`);

							toolDetails.push('');
							toolDetails.push('**Input:**');
							toolDetails.push('```json');
							toolDetails.push(JSON.stringify(inv.args, null, 2));
							toolDetails.push('```');

							if (isComplete && inv.result) {
								toolDetails.push('');
								toolDetails.push('**Result:**');
								const result = inv.result as Record<string, unknown>;
								if (typeof result.explanation === 'string') {
									toolDetails.push(result.explanation);
								} else {
									toolDetails.push('```json');
									toolDetails.push(JSON.stringify(result, null, 2).slice(0, 1000));
									toolDetails.push('```');
								}
							}
							toolDetails.push('');
						}
					}

					// Add tool details section if there are tools
					if (toolDetails.length > 0) {
						lines.push('---');
						lines.push('');
						lines.push('## Tool Invocations');
						lines.push('');
						lines.push(...toolDetails);
					}
				}
			}
			lines.push('---');
			lines.push('');
		}

		return lines.join('\n');
	}

	onMount(() => {
		loadSessions();
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
		</div>
		<button
			class="refresh-btn"
			onclick={loadSessions}
			disabled={loading}
			title="Refresh"
		>
			<i class="fas fa-sync-alt" class:spinning={loading}></i>
		</button>
	</header>

	<!-- Status Filter Tabs -->
	<nav class="status-tabs">
		<button
			class:active={activeTab === 'pending'}
			onclick={() => (activeTab = 'pending')}
		>
			<span class="tab-icon" style="color: #f59e0b">
				<i class="fas fa-flag" aria-hidden="true"></i>
			</span>
			Pending
			{#if statusCounts().pending > 0}
				<span class="badge pending">{statusCounts().pending}</span>
			{/if}
		</button>
		<button
			class:active={activeTab === 'in-review'}
			onclick={() => (activeTab = 'in-review')}
		>
			<span class="tab-icon" style="color: #8b5cf6">
				<i class="fas fa-user-check" aria-hidden="true"></i>
			</span>
			In Review
			{#if statusCounts().inReview > 0}
				<span class="badge in-review">{statusCounts().inReview}</span>
			{/if}
		</button>
		<button
			class:active={activeTab === 'completed'}
			onclick={() => (activeTab = 'completed')}
		>
			<span class="tab-icon" style="color: #22c55e">
				<i class="fas fa-check-circle" aria-hidden="true"></i>
			</span>
			Completed
			{#if statusCounts().completed > 0}
				<span class="badge completed">{statusCounts().completed}</span>
			{/if}
		</button>
		<button
			class:active={activeTab === 'all'}
			onclick={() => (activeTab = 'all')}
		>
			<span class="tab-icon" style="color: #64748b">
				<i class="fas fa-list" aria-hidden="true"></i>
			</span>
			All
		</button>
	</nav>

	<div class="content-area">
		<!-- Session List -->
		<div class="session-list">
			{#if loading}
				<div class="state-message">
					<i class="fas fa-spinner fa-spin"></i>
					<span>Loading...</span>
				</div>
			{:else if error}
				<div class="state-message error">
					<i class="fas fa-exclamation-triangle"></i>
					<span>{error}</span>
					<button onclick={loadSessions}>Retry</button>
				</div>
			{:else if !isAuthenticated}
				<div class="state-message">
					<i class="fas fa-lock"></i>
					<span>Sign in to access review queue</span>
				</div>
			{:else if filteredSessions().length === 0}
				<div class="state-message">
					<i class="fas fa-inbox"></i>
					<span>No conversations in this view</span>
					{#if activeTab === 'pending'}
						<p class="hint">Flag conversations from the chat to review them here</p>
					{/if}
				</div>
			{:else}
				{#each filteredSessions() as session (session.id)}
					{@const statusInfo = getStatusInfo(session.reviewStatus)}
					<button
						class="session-card"
						class:selected={selectedSession?.id === session.id}
						onclick={() => selectSession(session)}
					>
						<div class="card-header">
							<span class="status-badge" style="background: {statusInfo.color}">
								<i class="fas {statusInfo.icon}" aria-hidden="true"></i>
								{statusInfo.label}
							</span>
							{#if session.reviewMetadata?.grade}
								<span class="grade-badge" class:good={session.reviewMetadata.grade.startsWith('A') || session.reviewMetadata.grade.startsWith('B')}>
									{session.reviewMetadata.grade}
									{#if session.reviewMetadata.confidence}
										<span class="confidence">({session.reviewMetadata.confidence}%)</span>
									{/if}
								</span>
							{/if}
						</div>
						<h3>{session.title}</h3>
						<p class="preview">{session.lastUserMessage}</p>
						<div class="card-footer">
							<span class="meta">
								<i class="fas fa-comments" aria-hidden="true"></i>
								{session.messageCount}
							</span>
							<span class="meta">
								<i class="fas fa-clock" aria-hidden="true"></i>
								{formatRelativeTime(session.flaggedAt)}
							</span>
							{#if session.reviewMetadata?.claimedBy === 'claude-tika'}
								<span class="meta claimed">
									<i class="fas fa-robot" aria-hidden="true"></i>
									AI reviewed
								</span>
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</div>

		<!-- Detail Panel -->
		{#if selectedSession}
			{@const statusInfo = getStatusInfo(selectedSession.reviewStatus)}
			<div class="detail-panel">
				<div class="detail-header">
					<div class="detail-title-row">
						<h3>{selectedSession.title}</h3>
						<span class="status-indicator" style="background: {statusInfo.color}">
							<i class="fas {statusInfo.icon}" aria-hidden="true"></i>
							{statusInfo.label}
						</span>
					</div>
					<div class="detail-actions">
						<button
							class="action-btn primary"
							onclick={() => openInChat(selectedSession)}
							title="Open in chat"
						>
							<i class="fas fa-external-link-alt" aria-hidden="true"></i>
							Open
						</button>
						{#if selectedSession.reviewStatus === 'in-review' || selectedSession.reviewStatus === 'needs-correction'}
							<button
								class="action-btn success"
								onclick={() => approveSession(selectedSession.id)}
								title="Approve"
							>
								<i class="fas fa-check" aria-hidden="true"></i>
								Approve
							</button>
						{/if}
						{#if selectedSession.reviewStatus !== 'archived'}
							<button
								class="action-btn neutral"
								onclick={() => archiveSession(selectedSession.id)}
								title="Archive"
							>
								<i class="fas fa-archive" aria-hidden="true"></i>
								Archive
							</button>
						{/if}
					</div>
				</div>

				<div class="detail-content">
					<!-- Review Info Section -->
					{#if selectedSession.reviewMetadata?.grade}
						<section class="detail-section review-summary">
							<h4>AI Review Summary</h4>
							<div class="review-grade">
								<span class="big-grade" class:good={selectedSession.reviewMetadata.grade.startsWith('A') || selectedSession.reviewMetadata.grade.startsWith('B')}>
									{selectedSession.reviewMetadata.grade}
								</span>
								{#if selectedSession.reviewMetadata.confidence}
									<span class="confidence-label">
										{selectedSession.reviewMetadata.confidence}% confidence
									</span>
								{/if}
							</div>
							{#if selectedSession.reviewMetadata.aiNotes}
								<div class="ai-notes">
									<p>{selectedSession.reviewMetadata.aiNotes}</p>
								</div>
							{/if}
							{#if selectedSession.reviewMetadata.correctedResponse}
								<div class="corrected-response">
									<h5>Suggested Correction</h5>
									<div class="response-text">{selectedSession.reviewMetadata.correctedResponse}</div>
								</div>
							{/if}
						</section>
					{/if}

					<!-- Human Notes Section -->
					<section class="detail-section">
						<h4>Notes</h4>
						{#if selectedSession.reviewStatus === 'pending' || selectedSession.reviewStatus === 'in-review'}
							<div class="notes-input">
								<textarea
									bind:value={notesInput}
									placeholder="Add context or notes before review..."
									rows="3"
								></textarea>
								<button
									class="save-notes-btn"
									onclick={saveNotes}
									disabled={savingNotes || !notesInput.trim()}
								>
									{savingNotes ? 'Saving...' : 'Save Notes'}
								</button>
							</div>
						{:else if selectedSession.reviewMetadata?.notes}
							<div class="notes-display">
								<p>{selectedSession.reviewMetadata.notes}</p>
							</div>
						{:else}
							<p class="no-notes">No notes added</p>
						{/if}
					</section>

					<!-- Conversation Preview -->
					<section class="detail-section conversation-section">
						<div class="section-header">
							<h4>Conversation</h4>
							<div class="section-actions">
								<CopyForAIButton
									getData={generateCopyForAI}
									ariaLabel="Copy conversation for AI review"
									size="sm"
									variant="icon-only"
								/>
								<CopyAsImageButton
									targetElement={conversationPreviewEl}
									ariaLabel="Copy conversation as image"
									size="sm"
								/>
							</div>
						</div>
						<div class="conversation-preview-wrapper">
							<TikaConversationReadOnly
								bind:this={conversationReadOnlyComponent}
								messages={selectedSession.messages}
							/>
						</div>
					</section>

					<!-- Metadata -->
					<section class="detail-section metadata">
						<h4>Details</h4>
						<dl>
							<dt>Session ID</dt>
							<dd><code>{selectedSession.id}</code></dd>
							<dt>Created</dt>
							<dd>{selectedSession.createdAt.toLocaleString()}</dd>
							<dt>Flagged</dt>
							<dd>{selectedSession.flaggedAt?.toLocaleString() || 'Unknown'}</dd>
							{#if selectedSession.reviewMetadata?.claimedAt}
								<dt>Claimed</dt>
								<dd>
									{selectedSession.reviewMetadata.claimedAt.toLocaleString()}
									{#if selectedSession.reviewMetadata.claimedBy}
										by {selectedSession.reviewMetadata.claimedBy}
									{/if}
								</dd>
							{/if}
							{#if selectedSession.reviewMetadata?.reviewedAt}
								<dt>Reviewed</dt>
								<dd>{selectedSession.reviewMetadata.reviewedAt.toLocaleString()}</dd>
							{/if}
						</dl>
					</section>
				</div>
			</div>
		{:else}
			<div class="no-selection">
				<i class="fas fa-hand-pointer"></i>
				<span>Select a conversation to review</span>
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

	/* Header */
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
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.back-btn:hover {
		background: linear-gradient(135deg, rgba(120, 120, 140, 0.95), rgba(90, 90, 110, 0.95));
		transform: scale(1.05);
	}

	.back-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.header-content {
		flex: 1;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.refresh-btn {
		width: 40px;
		height: 40px;
		border: none;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.refresh-btn:hover {
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text, #fff);
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* Status Tabs */
	.status-tabs {
		display: flex;
		padding: 8px 16px;
		gap: 4px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: rgba(15, 20, 30, 0.6);
	}

	.status-tabs button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border: none;
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: 14px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.status-tabs button:hover {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #fff);
	}

	.status-tabs button.active {
		background: var(--theme-accent, #6366f1);
		color: white;
	}

	.tab-icon {
		font-size: 12px;
	}

	.badge {
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 600;
	}

	.badge.pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
	.badge.in-review { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
	.badge.completed { background: rgba(34, 197, 94, 0.2); color: #4ade80; }

	/* Content Area */
	.content-area {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* Session List */
	.session-list {
		width: 340px;
		min-width: 280px;
		border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.session-card {
		display: block;
		width: 100%;
		text-align: left;
		padding: 12px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.session-card:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: rgba(255, 255, 255, 0.06);
	}

	.session-card.selected {
		border-color: var(--theme-accent, #6366f1);
		background: rgba(99, 102, 241, 0.1);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.status-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		color: white;
	}

	.grade-badge {
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
		background: rgba(239, 68, 68, 0.2);
		color: #fca5a5;
	}

	.grade-badge.good {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
	}

	.grade-badge .confidence {
		font-weight: 400;
		opacity: 0.8;
	}

	.session-card h3 {
		margin: 0 0 6px;
		font-size: 14px;
		font-weight: 500;
		color: var(--theme-text, #fff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.session-card .preview {
		margin: 0;
		font-size: 13px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-footer {
		display: flex;
		gap: 12px;
		margin-top: 10px;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.meta.claimed {
		color: #60a5fa;
	}

	/* Detail Panel */
	.detail-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.detail-header {
		padding: 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.detail-title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.detail-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		color: white;
	}

	.detail-actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn.primary {
		background: var(--theme-accent, #6366f1);
		color: white;
	}

	.action-btn.primary:hover {
		background: #4f46e5;
	}

	.action-btn.success {
		background: #22c55e;
		color: white;
	}

	.action-btn.success:hover {
		background: #16a34a;
	}

	.action-btn.neutral {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.action-btn.neutral:hover {
		background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text, #fff);
	}

	.detail-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.detail-section {
		margin-bottom: 24px;
	}

	.detail-section h4 {
		margin: 0 0 12px;
		font-size: 12px;
		font-weight: 600;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-section h5 {
		margin: 12px 0 8px;
		font-size: 13px;
		font-weight: 500;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
	}

	/* Review Summary */
	.review-summary {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 12px;
		padding: 16px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.review-grade {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
	}

	.big-grade {
		font-size: 2rem;
		font-weight: 700;
		color: #fca5a5;
	}

	.big-grade.good {
		color: #4ade80;
	}

	.confidence-label {
		font-size: 14px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
	}

	.ai-notes {
		padding: 12px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}

	.ai-notes p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
	}

	.corrected-response {
		margin-top: 16px;
	}

	.response-text {
		padding: 12px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		font-size: 14px;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	/* Notes */
	.notes-input {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.notes-input textarea {
		width: 100%;
		padding: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		color: var(--theme-text, #fff);
		font-size: 14px;
		resize: none;
	}

	.notes-input textarea:focus {
		outline: none;
		border-color: var(--theme-accent, #6366f1);
	}

	.save-notes-btn {
		align-self: flex-end;
		padding: 8px 16px;
		background: var(--theme-accent, #6366f1);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.save-notes-btn:hover:not(:disabled) {
		background: #4f46e5;
	}

	.save-notes-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.notes-display {
		padding: 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-radius: 8px;
	}

	.notes-display p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
	}

	.no-notes {
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		font-style: italic;
		font-size: 14px;
	}

	/* Section Header with Actions */
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.section-header h4 {
		margin: 0;
	}

	.section-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	/* Make CopyAsImageButton and CopyForAIButton smaller in this context */
	.section-actions :global(.capture-btn),
	.section-actions :global(.copy-btn) {
		width: 36px;
		height: 36px;
		font-size: 14px;
	}

	.no-content {
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
		font-style: italic;
	}

	/* Conversation Section - expandable to fit content */
	.conversation-section {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.conversation-preview-wrapper {
		flex: 1;
		overflow-y: auto;
		max-height: 500px;
		border-radius: 12px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	/* Metadata */
	.metadata dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 0;
	}

	.metadata dt {
		font-size: 13px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
	}

	.metadata dd {
		margin: 0;
		font-size: 13px;
	}

	.metadata code {
		font-family: monospace;
		font-size: 12px;
		padding: 2px 6px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
	}

	/* State Messages */
	.state-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		text-align: center;
		padding: 32px;
	}

	.state-message i {
		font-size: 2rem;
		opacity: 0.5;
	}

	.state-message.error {
		color: #ef4444;
	}

	.state-message button {
		margin-top: 8px;
		padding: 8px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		color: var(--theme-text, #fff);
		border-radius: 6px;
		cursor: pointer;
	}

	.hint {
		font-size: 13px;
		opacity: 0.7;
		margin-top: 4px;
	}

	.no-selection {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
	}

	.no-selection i {
		font-size: 2.5rem;
		opacity: 0.4;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.content-area {
			flex-direction: column;
		}

		.session-list {
			width: 100%;
			max-height: 40vh;
			border-right: none;
			border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		}

		.status-tabs {
			overflow-x: auto;
			padding: 8px;
		}

		.status-tabs button {
			padding: 8px 12px;
			font-size: 13px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinning {
			animation: none;
		}
	}
</style>
