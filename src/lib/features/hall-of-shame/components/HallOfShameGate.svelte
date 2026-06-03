<!--
  HallOfShameGate.svelte

  Age verification modal for accessing Hall of Shame content.
  Uses honor-system checkbox confirmation (18+).
  Stores consent in user profile for persistence.
-->
<script lang="ts">

import { getAgeVerifier } from "$lib/features/hall-of-shame/get-age-verifier";
	import { t } from '$lib/shared/i18n/i18n.svelte';
	import BaseModal from '$lib/shared/foundation/ui/modal/BaseModal.svelte';
	import ModalHeader from '$lib/shared/foundation/ui/modal/ModalHeader.svelte';
	import ModalFooter from '$lib/shared/foundation/ui/modal/ModalFooter.svelte';
	import { authState } from '$lib/shared/auth/state/auth-state.svelte';

	interface Props {
		/** Called when user successfully verifies age */
		onVerified: () => void;
		/** Called when user cancels/closes without verifying */
		onCancel: () => void;
	}

	let { onVerified, onCancel }: Props = $props();

	let isOpen = $state(true);
	let confirmed = $state(false);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	function handleClose() {
		isOpen = false;
		setTimeout(onCancel, 250);
	}

	async function handleConfirm() {
		if (!confirmed) return;

		isSubmitting = true;
		error = null;

		try {
			const ageVerifier = getAgeVerifier();
			const userId = authState.user?.uid;

			if (!userId) {
				error = t('hall_of_shame_sign_in_message');
				return;
			}

			await ageVerifier.recordVerification(userId);

			isOpen = false;
			setTimeout(onVerified, 250);
		} catch (err) {
			console.error('[HallOfShameGate] Verification error:', err);
			error = t('hall_of_shame_verification_error');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<BaseModal bind:open={isOpen} onclose={handleClose} size="sm" animation="pop" labelledBy="age-gate-title">
	{#snippet header()}
		<ModalHeader
			title={t('hall_of_shame_gate_title')}
			subtitle={t('hall_of_shame_gate_subtitle')}
			icon="fa-skull"
			iconColor="#ef4444"
			onClose={handleClose}
			id="age-gate-title"
		/>
	{/snippet}

	<div class="gate-content">
		<div class="warning-icon" aria-hidden="true">
			<i class="fas fa-exclamation-triangle"></i>
		</div>

		<p class="warning-text">
			{t('hall_of_shame_gate_warning')}
		</p>

		<p class="disclaimer">
			{t('hall_of_shame_gate_disclaimer')}
		</p>

		<label class="checkbox-label">
			<input
				type="checkbox"
				bind:checked={confirmed}
				disabled={isSubmitting}
			/>
			<span>{t('hall_of_shame_confirm_age')}</span>
		</label>

		{#if error}
			<div class="error-message" role="alert">
				<i class="fas fa-exclamation-circle" aria-hidden="true"></i>
				<span>{error}</span>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<ModalFooter>
			<button class="secondary" onclick={handleClose} disabled={isSubmitting}>
				{t('hall_of_shame_cancel')}
			</button>
			<button
				class="primary danger"
				onclick={handleConfirm}
				disabled={!confirmed || isSubmitting}
			>
				{#if isSubmitting}
					<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
					{t('hall_of_shame_verifying')}
				{:else}
					{t('hall_of_shame_enter')}
				{/if}
			</button>
		</ModalFooter>
	{/snippet}
</BaseModal>

<style>
	.gate-content {
		padding: var(--modal-padding, 24px);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
	}

	.warning-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(239, 68, 68, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		color: #ef4444;
	}

	.warning-text {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		line-height: 1.6;
		color: var(--theme-text, rgba(255, 255, 255, 0.9));
	}

	.disclaimer {
		margin: 0;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		line-height: 1.5;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		min-height: var(--min-touch-target);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	.checkbox-label:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
	}

	.checkbox-label input[type='checkbox'] {
		width: 24px;
		height: 24px;
		min-width: 24px;
		accent-color: #ef4444;
		cursor: pointer;
	}

	.checkbox-label span {
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text, rgba(255, 255, 255, 0.9));
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		font-size: var(--font-size-min, 14px);
		color: #fca5a5;
	}

	/* Footer buttons */
	button {
		padding: 10px 20px;
		font-size: var(--font-size-min, 14px);
		font-weight: 500;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	button.secondary {
		background: rgba(255, 255, 255, 0.1);
		color: var(--theme-text, rgba(255, 255, 255, 0.9));
	}

	button.secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
	}

	button.primary.danger {
		background: #ef4444;
		color: white;
	}

	button.primary.danger:hover:not(:disabled) {
		background: #dc2626;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Mobile responsive */
	@media (max-width: 480px) {
		.gate-content {
			padding: var(--modal-padding-mobile, 20px);
		}

		.warning-icon {
			width: 56px;
			height: 56px;
			font-size: 24px;
		}
	}
</style>
