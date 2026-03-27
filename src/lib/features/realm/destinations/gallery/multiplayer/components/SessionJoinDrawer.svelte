<script lang="ts">
	/**
	 * SessionJoinDrawer
	 *
	 * UI for creating and joining multiplayer gallery sessions.
	 * - Create new public or private sessions
	 * - Browse and join public sessions
	 * - Join via invite link
	 */

	import { onMount } from 'svelte';
	import { t } from "$lib/shared/i18n/i18n.svelte.js";
	import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
	import type {
		PublicSessionInfo,
		CreateSessionOptions,
		SessionVisibility
	} from '../domain/multiplayer-models';

	interface Props {
		/** Whether the drawer is open */
		open: boolean;
		/** Callback to close drawer */
		onClose: () => void;
		/** Callback to create a session */
		onCreate: (name: string, visibility: SessionVisibility) => Promise<void>;
		/** Callback to join a session */
		onJoin: (sessionId: string) => Promise<void>;
		/** Public sessions available to join (optional) */
		publicSessions?: readonly PublicSessionInfo[];
		/** Whether loading public sessions */
		isLoading?: boolean;
		/** Currently in a session */
		isInSession?: boolean;
		/** Callback to leave current session */
		onLeave?: () => Promise<void>;
		/** Callback to refresh sessions list */
		onRefresh?: () => void;
	}

	let {
		open,
		onClose,
		onCreate,
		onJoin,
		publicSessions = [],
		isLoading = false,
		isInSession = false,
		onLeave,
		onRefresh
	}: Props = $props();

	// Tab state
	type Tab = 'create' | 'browse' | 'link';
	let activeTab = $state<Tab>('browse');

	// Create session form state
	let sessionName = $state('');
	let visibility = $state<SessionVisibility>('public');
	let isCreating = $state(false);

	// Join by link state
	let inviteLink = $state('');
	let isJoining = $state(false);

	// Extract session ID from invite link
	function extractSessionId(link: string): string | null {
		try {
			const url = new URL(link);
			return url.searchParams.get('session');
		} catch {
			// Not a valid URL, try treating it as a raw session ID
			if (link.length > 10 && !link.includes(' ')) {
				return link;
			}
			return null;
		}
	}

	async function handleCreate() {
		if (!sessionName.trim()) return;

		isCreating = true;
		try {
			await onCreate(sessionName.trim(), visibility);
			sessionName = '';
			onClose();
		} catch (error) {
			console.error('Failed to create session:', error);
		} finally {
			isCreating = false;
		}
	}

	async function handleJoinSession(sessionId: string) {
		isJoining = true;
		try {
			await onJoin(sessionId);
			onClose();
		} catch (error) {
			console.error('Failed to join session:', error);
		} finally {
			isJoining = false;
		}
	}

	async function handleJoinByLink() {
		const sessionId = extractSessionId(inviteLink);
		if (!sessionId) {
			alert(t("gallery_session_invalid_link"));
			return;
		}

		await handleJoinSession(sessionId);
		inviteLink = '';
	}

	async function handleLeave() {
		if (!onLeave) return;
		try {
			await onLeave();
		} catch (error) {
			console.error('Failed to leave session:', error);
		}
	}

	// Format time ago
	function formatTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return t("gallery_time_just_now");
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return t("gallery_time_minutes_ago", { count: minutes.toString() });
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return t("gallery_time_hours_ago", { count: hours.toString() });
		return t("gallery_time_days_ago", { count: Math.floor(hours / 24).toString() });
	}

	onMount(() => {
		if (open && onRefresh) {
			onRefresh();
		}
	});

	// Refresh when drawer opens
	$effect(() => {
		if (open && onRefresh) {
			onRefresh();
		}
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div class="backdrop" onclick={onClose} role="presentation"></div>

	<!-- Drawer -->
	<div class="drawer" role="dialog" aria-label={t("gallery_session_dialog_label")}>
		<DrawerHeader title={t("gallery_session_drawer_title")} {onClose} />

		<!-- Leave session button if in session -->
		{#if isInSession}
			<div class="in-session-banner">
				<span>{t("gallery_session_in_session")}</span>
				<button class="leave-button" onclick={handleLeave}>
					<i class="fas fa-sign-out-alt" aria-hidden="true"></i>
					{t("gallery_leave")}
				</button>
			</div>
		{/if}

		<!-- Tabs -->
		<nav class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'browse'}
				onclick={() => (activeTab = 'browse')}
			>
				<i class="fas fa-globe" aria-hidden="true"></i>
				{t("gallery_session_tab_browse")}
			</button>
			<button
				class="tab"
				class:active={activeTab === 'create'}
				onclick={() => (activeTab = 'create')}
			>
				<i class="fas fa-plus" aria-hidden="true"></i>
				{t("gallery_session_tab_create")}
			</button>
			<button
				class="tab"
				class:active={activeTab === 'link'}
				onclick={() => (activeTab = 'link')}
			>
				<i class="fas fa-link" aria-hidden="true"></i>
				{t("gallery_session_tab_join_link")}
			</button>
		</nav>

		<!-- Tab content -->
		<div class="tab-content">
			{#if activeTab === 'browse'}
				<!-- Browse public sessions -->
				<div class="sessions-list">
					{#if isLoading}
						<div class="loading">
							<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
							{t("gallery_session_loading")}
						</div>
					{:else if publicSessions.length === 0}
						<div class="empty-state">
							<i class="fas fa-door-open" aria-hidden="true"></i>
							<p>{t("gallery_session_empty")}</p>
							<p class="hint">{t("gallery_session_empty_hint")}</p>
						</div>
					{:else}
						{#each publicSessions as session (session.id)}
							<button
								class="session-card"
								onclick={() => handleJoinSession(session.id)}
								disabled={isJoining}
							>
								<div class="session-info">
									<span class="session-name">{session.name}</span>
									<span class="session-host">{t("gallery_by_author", { author: session.hostDisplayName })}</span>
								</div>
								<div class="session-meta">
									<span class="player-count">
										<i class="fas fa-users" aria-hidden="true"></i>
										{session.playerCount}/{session.maxPlayers}
									</span>
									<span class="created-at">{formatTimeAgo(session.createdAt)}</span>
								</div>
							</button>
						{/each}
					{/if}

					<button class="refresh-button" onclick={() => onRefresh?.()} disabled={isLoading || !onRefresh}>
						<i class="fas fa-sync-alt" class:fa-spin={isLoading} aria-hidden="true"></i>
						{t("gallery_session_refresh")}
					</button>
				</div>
			{:else if activeTab === 'create'}
				<!-- Create new session -->
				<form class="create-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
					<div class="form-group">
						<label for="session-name">{t("gallery_session_name_label")}</label>
						<input
							id="session-name"
							type="text"
							bind:value={sessionName}
							placeholder={t("gallery_session_name_placeholder")}
							maxlength={50}
							required
						/>
					</div>

					<div class="form-group" role="radiogroup" aria-labelledby="visibility-label">
						<span id="visibility-label" class="form-label-text">{t("gallery_session_visibility_label")}</span>
						<div class="visibility-options">
							<label class="visibility-option">
								<input
									type="radio"
									name="visibility"
									value="public"
									bind:group={visibility}
								/>
								<span class="option-content">
									<i class="fas fa-globe" aria-hidden="true"></i>
									<span class="option-label">{t("gallery_session_public")}</span>
									<span class="option-desc">{t("gallery_session_public_desc")}</span>
								</span>
							</label>
							<label class="visibility-option">
								<input
									type="radio"
									name="visibility"
									value="private"
									bind:group={visibility}
								/>
								<span class="option-content">
									<i class="fas fa-lock" aria-hidden="true"></i>
									<span class="option-label">{t("gallery_session_private")}</span>
									<span class="option-desc">{t("gallery_session_private_desc")}</span>
								</span>
							</label>
						</div>
					</div>

					<button type="submit" class="create-button" disabled={isCreating || !sessionName.trim()}>
						{#if isCreating}
							<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
							{t("gallery_session_creating")}
						{:else}
							<i class="fas fa-plus" aria-hidden="true"></i>
							{t("gallery_session_create_button")}
						{/if}
					</button>
				</form>
			{:else if activeTab === 'link'}
				<!-- Join by invite link -->
				<form class="link-form" onsubmit={(e) => { e.preventDefault(); handleJoinByLink(); }}>
					<div class="form-group">
						<label for="invite-link">{t("gallery_session_invite_label")}</label>
						<input
							id="invite-link"
							type="text"
							bind:value={inviteLink}
							placeholder={t("gallery_session_invite_placeholder")}
						/>
					</div>

					<button type="submit" class="join-button" disabled={isJoining || !inviteLink.trim()}>
						{#if isJoining}
							<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
							{t("gallery_session_joining")}
						{:else}
							<i class="fas fa-sign-in-alt" aria-hidden="true"></i>
							{t("gallery_session_join_button")}
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 100;
		pointer-events: auto;
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(400px, 90vw);
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		z-index: 101;
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
		pointer-events: auto;
	}

	.in-session-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 20px;
		background: rgba(74, 222, 128, 0.1);
		border-bottom: 1px solid rgba(74, 222, 128, 0.2);
	}

	.in-session-banner span {
		color: #4ade80;
		font-size: 14px;
	}

	.leave-button {
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.leave-button:hover {
		background: rgba(239, 68, 68, 0.3);
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.tab {
		flex: 1;
		background: none;
		border: none;
		padding: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: 13px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		border-bottom: 2px solid transparent;
		transition: all var(--duration-fast);
	}

	.tab:hover {
		color: var(--theme-text, white);
		background: rgba(255, 255, 255, 0.05);
	}

	.tab.active {
		color: var(--theme-accent, #60a5fa);
		border-bottom-color: var(--theme-accent, #60a5fa);
	}

	.tab i {
		font-size: 16px;
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
	}

	/* Sessions list */
	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.session-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--duration-fast);
		text-align: left;
		width: 100%;
	}

	.session-card:hover:not(:disabled) {
		border-color: var(--theme-accent, #60a5fa);
		background: rgba(96, 165, 250, 0.1);
	}

	.session-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.session-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.session-name {
		font-size: 15px;
		font-weight: 500;
		color: var(--theme-text, white);
	}

	.session-host {
		font-size: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.session-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.player-count {
		font-size: 13px;
		color: var(--theme-accent, #60a5fa);
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.created-at {
		font-size: 11px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
	}

	.loading,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		text-align: center;
	}

	.empty-state i {
		font-size: 48px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state .hint {
		font-size: 13px;
		opacity: 0.7;
	}

	.refresh-button {
		margin-top: 8px;
		padding: 10px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 13px;
	}

	.refresh-button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.08);
		color: var(--theme-text, white);
	}

	/* Form styles */
	.create-form,
	.link-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-group label,
	.form-label-text {
		font-size: 13px;
		font-weight: 500;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
	}

	.form-group input[type='text'] {
		padding: 12px 14px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		color: var(--theme-text, white);
		font-size: 15px;
	}

	.form-group input[type='text']:focus {
		outline: none;
		border-color: var(--theme-accent, #60a5fa);
	}

	.visibility-options {
		display: flex;
		gap: 12px;
	}

	.visibility-option {
		flex: 1;
		cursor: pointer;
	}

	.visibility-option input {
		display: none;
	}

	.option-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		transition: all var(--duration-fast);
	}

	.visibility-option input:checked + .option-content {
		border-color: var(--theme-accent, #60a5fa);
		background: rgba(96, 165, 250, 0.1);
	}

	.option-content i {
		font-size: 20px;
		margin-bottom: 8px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
	}

	.visibility-option input:checked + .option-content i {
		color: var(--theme-accent, #60a5fa);
	}

	.option-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--theme-text, white);
	}

	.option-desc {
		font-size: 11px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		margin-top: 2px;
	}

	.create-button,
	.join-button {
		padding: 14px;
		background: var(--theme-accent, #60a5fa);
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all var(--duration-fast);
	}

	.create-button:hover:not(:disabled),
	.join-button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.create-button:disabled,
	.join-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
