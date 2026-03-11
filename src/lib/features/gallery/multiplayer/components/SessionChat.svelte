<script lang="ts">
	/**
	 * SessionChat
	 *
	 * In-session chat panel for multiplayer gallery.
	 * Displays chat messages and allows sending new messages.
	 */

	import { onMount, tick } from 'svelte';
	import { t } from "$lib/shared/i18n/i18n.svelte.js";
	import type { ChatMessage } from '../domain/multiplayer-models';

	interface Props {
		/** Whether chat is open */
		open: boolean;
		/** Chat messages */
		messages: readonly ChatMessage[];
		/** Current user ID for highlighting own messages */
		currentUserId: string | null;
		/** Callback to send a message */
		onSend: (text: string) => Promise<void>;
		/** Callback to close chat */
		onClose: () => void;
	}

	let { open, messages, currentUserId, onSend, onClose }: Props = $props();

	let inputText = $state('');
	let isSending = $state(false);
	let messagesContainer: HTMLDivElement | undefined = $state();
	let inputElement: HTMLInputElement | undefined = $state();

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (messages.length > 0 && messagesContainer) {
			tick().then(() => {
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			});
		}
	});

	// Focus input when chat opens
	$effect(() => {
		if (open && inputElement) {
			tick().then(() => {
				inputElement?.focus();
			});
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!inputText.trim() || isSending) return;

		isSending = true;
		try {
			await onSend(inputText.trim());
			inputText = '';
		} catch (error) {
			console.error('Failed to send message:', error);
		} finally {
			isSending = false;
		}
	}

	function formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function getMessageTypeIcon(type: string): string {
		switch (type) {
			case 'join':
				return 'sign-in-alt';
			case 'leave':
				return 'sign-out-alt';
			case 'emote':
				return 'hand-sparkles';
			default:
				return '';
		}
	}
</script>

{#if open}
	<div class="chat-panel" role="region" aria-label={t("gallery_chat_region_label")}>
		<!-- Header -->
		<header class="chat-header">
			<h3>{t("gallery_chat_title")}</h3>
			<button class="close-button" onclick={onClose} aria-label={t("gallery_chat_close")}>
				<i class="fas fa-times" aria-hidden="true"></i>
			</button>
		</header>

		<!-- Messages -->
		<div class="messages" bind:this={messagesContainer}>
			{#if messages.length === 0}
				<div class="empty-state">
					<i class="fas fa-comments" aria-hidden="true"></i>
					<p>{t("gallery_chat_empty")}</p>
				</div>
			{:else}
				{#each messages as message (message.id)}
					{@const isOwn = message.userId === currentUserId}
					{@const isSystem = message.type !== 'message'}

					{#if isSystem}
						<!-- System message (join/leave/emote) -->
						<div class="system-message">
							<i class="fas fa-{getMessageTypeIcon(message.type)}" aria-hidden="true"></i>
							<span>{message.text}</span>
							<span class="time">{formatTime(message.timestamp)}</span>
						</div>
					{:else}
						<!-- User message -->
						<div class="message" class:own={isOwn}>
							{#if !isOwn}
								<div class="avatar">
									{#if message.avatarUrl}
										<img src={message.avatarUrl} alt="" />
									{:else}
										<span class="initials">
											{message.displayName.charAt(0).toUpperCase()}
										</span>
									{/if}
								</div>
							{/if}
							<div class="message-content">
								{#if !isOwn}
									<span class="sender">{message.displayName}</span>
								{/if}
								<div class="bubble">
									<span class="text">{message.text}</span>
									<span class="time">{formatTime(message.timestamp)}</span>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		<!-- Input -->
		<form class="input-form" onsubmit={handleSubmit}>
			<input
				bind:this={inputElement}
				type="text"
				bind:value={inputText}
				placeholder={t("gallery_chat_placeholder")}
				maxlength={500}
				disabled={isSending}
			/>
			<button type="submit" disabled={isSending || !inputText.trim()} aria-label={t("gallery_chat_send")}>
				{#if isSending}
					<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				{:else}
					<i class="fas fa-paper-plane" aria-hidden="true"></i>
				{/if}
			</button>
		</form>
	</div>
{/if}

<style>
	.chat-panel {
		position: fixed;
		bottom: 80px;
		right: 16px;
		width: min(360px, calc(100vw - 32px));
		height: min(400px, calc(100vh - 160px));
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		z-index: 50;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.chat-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--theme-text, white);
	}

	.close-button {
		background: none;
		border: none;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		padding: 4px;
	}

	.close-button:hover {
		color: var(--theme-text, white);
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
		text-align: center;
	}

	.empty-state i {
		font-size: 32px;
		margin-bottom: 8px;
	}

	/* System messages */
	.system-message {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 12px;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
	}

	.system-message i {
		font-size: 10px;
	}

	.system-message .time {
		font-size: 10px;
		opacity: 0.6;
	}

	/* User messages */
	.message {
		display: flex;
		gap: 8px;
		max-width: 85%;
	}

	.message.own {
		align-self: flex-end;
		flex-direction: row-reverse;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar .initials {
		font-size: 12px;
		font-weight: 600;
		color: var(--theme-text, white);
	}

	.message-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sender {
		font-size: 11px;
		font-weight: 500;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		padding-left: 8px;
	}

	.bubble {
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
		padding: 8px 12px;
		border-radius: 12px;
		border-top-left-radius: 4px;
	}

	.message.own .bubble {
		background: var(--theme-accent, #60a5fa);
		border-top-left-radius: 12px;
		border-top-right-radius: 4px;
	}

	.text {
		font-size: 14px;
		color: var(--theme-text, white);
		word-break: break-word;
	}

	.bubble .time {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.5);
		margin-left: 8px;
	}

	.message.own .bubble .time {
		color: rgba(255, 255, 255, 0.7);
	}

	/* Input form */
	.input-form {
		display: flex;
		gap: 8px;
		padding: 12px;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
	}

	.input-form input {
		flex: 1;
		padding: 10px 14px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 20px;
		color: var(--theme-text, white);
		font-size: 14px;
	}

	.input-form input:focus {
		outline: none;
		border-color: var(--theme-accent, #60a5fa);
	}

	.input-form input::placeholder {
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
	}

	.input-form button {
		width: 40px;
		height: 40px;
		background: var(--theme-accent, #60a5fa);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--duration-fast);
	}

	.input-form button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.input-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
