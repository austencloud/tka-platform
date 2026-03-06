<!--
  ConflictResolutionDialog - Prompts the user to resolve version conflicts
  when the same sequence was edited on multiple devices.

  Shows:
  - Which sequence has a conflict
  - What changed between versions (word, step count)
  - When each version was last modified
  - Options: keep local changes or accept the other device's version

  Accessibility:
  - Focus trapped within dialog while open
  - aria-describedby links to description paragraph
  - Loading state prevents double-clicks
  - Escape key closes (defaults to server version)
-->
<script lang="ts">
	import type {
		VersionConflict,
		ConflictResolution,
	} from "../services/contracts/IConflictResolver";

	interface Props {
		conflict: VersionConflict;
		onResolve: (resolution: ConflictResolution) => void;
	}

	let { conflict, onResolve }: Props = $props();

	let isResolving = $state(false);
	let dialogRef = $state<HTMLDivElement>();

	const localDate = $derived(
		conflict.localVersion.updatedAt
			? new Intl.DateTimeFormat("en-US", {
					dateStyle: "medium",
					timeStyle: "short",
				}).format(conflict.localVersion.updatedAt)
			: "Unknown"
	);

	const serverDate = $derived(
		conflict.serverVersion.updatedAt
			? new Intl.DateTimeFormat("en-US", {
					dateStyle: "medium",
					timeStyle: "short",
				}).format(conflict.serverVersion.updatedAt)
			: "Unknown"
	);

	const sequenceWord = $derived(
		conflict.localVersion.word || conflict.localVersion.name || "Untitled"
	);

	// Compute differences between versions for the visual summary
	const wordChanged = $derived(
		conflict.localVersion.word !== conflict.serverVersion.word
	);
	const localStepCount = $derived(conflict.localVersion.steps?.length ?? 0);
	const serverStepCount = $derived(conflict.serverVersion.steps?.length ?? 0);
	const stepCountChanged = $derived(localStepCount !== serverStepCount);
	const hasDifferences = $derived(wordChanged || stepCountChanged);

	async function handleResolve(resolution: ConflictResolution) {
		if (isResolving) return;
		isResolving = true;
		onResolve(resolution);
	}

	// Focus trap: keep focus within the dialog
	$effect(() => {
		if (!dialogRef) return;

		const focusableElements = dialogRef.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				handleResolve("use-server");
				return;
			}

			if (e.key !== "Tab") return;

			if (e.shiftKey && document.activeElement === firstElement) {
				lastElement?.focus();
				e.preventDefault();
			} else if (!e.shiftKey && document.activeElement === lastElement) {
				firstElement?.focus();
				e.preventDefault();
			}
		}

		dialogRef.addEventListener("keydown", handleKeyDown);
		firstElement?.focus();

		return () => dialogRef?.removeEventListener("keydown", handleKeyDown);
	});
</script>

<div
	class="conflict-backdrop"
	role="dialog"
	aria-modal="true"
	aria-label="Version conflict detected"
	aria-describedby="conflict-desc"
	bind:this={dialogRef}
>
	<div class="conflict-dialog">
		<div class="conflict-header">
			<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
			<h2>Sequence edited on another device</h2>
		</div>

		<p class="conflict-description" id="conflict-desc">
			<strong>"{sequenceWord}"</strong> was modified on another device while you
			had unsaved changes. Choose which version to keep.
		</p>

		{#if hasDifferences}
			<div class="conflict-changes">
				<div class="changes-label">What changed</div>
				{#if wordChanged}
					<div class="change-item">
						<i class="fas fa-font" aria-hidden="true"></i>
						<span>Word: "{conflict.localVersion.word}" vs "{conflict.serverVersion.word}"</span>
					</div>
				{/if}
				{#if stepCountChanged}
					<div class="change-item">
						<i class="fas fa-list" aria-hidden="true"></i>
						<span>Steps: {localStepCount} vs {serverStepCount}</span>
					</div>
				{/if}
			</div>
		{/if}

		<div class="version-comparison">
			<button
				class="version-option"
				onclick={() => handleResolve("keep-local")}
				disabled={isResolving}
				aria-busy={isResolving && true}
				type="button"
			>
				{#if isResolving}
					<div class="version-label">
						<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
						Saving...
					</div>
				{:else}
					<div class="version-label">
						<i class="fas fa-mobile-screen" aria-hidden="true"></i>
						This device
					</div>
					<div class="version-date">{localDate}</div>
				{/if}
			</button>

			<div class="version-divider">or</div>

			<button
				class="version-option"
				onclick={() => handleResolve("use-server")}
				disabled={isResolving}
				aria-busy={isResolving && true}
				type="button"
			>
				{#if isResolving}
					<div class="version-label">
						<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
						Saving...
					</div>
				{:else}
					<div class="version-label">
						<i class="fas fa-cloud" aria-hidden="true"></i>
						Other device
					</div>
					<div class="version-date">{serverDate}</div>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.conflict-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		padding: 16px;
	}

	.conflict-dialog {
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 16px;
		padding: 24px;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
	}

	.conflict-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}

	.conflict-header i {
		color: var(--semantic-warning, #f59e0b);
		font-size: 20px;
	}

	.conflict-header h2 {
		font-size: var(--font-size-min, 14px);
		font-weight: 600;
		color: var(--theme-text, #fff);
		margin: 0;
	}

	.conflict-description {
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
		line-height: 1.5;
		margin: 0 0 16px;
	}

	.conflict-description strong {
		color: var(--theme-text, #fff);
	}

	.conflict-changes {
		margin: 0 0 16px;
		padding: 10px 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.02));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.changes-label {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.change-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text, #fff);
	}

	.change-item i {
		width: 14px;
		text-align: center;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: 11px;
	}

	.version-comparison {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.version-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 10px;
		cursor: pointer;
		color: var(--theme-text, #fff);
		font-size: var(--font-size-min, 14px);
		transition:
			border-color 150ms ease,
			background 150ms ease,
			opacity 150ms ease;
		min-height: var(--min-touch-target);
	}

	.version-option:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.version-option:hover:not(:disabled) {
		border-color: var(
			--theme-stroke-strong,
			rgba(255, 255, 255, 0.2)
		);
		background: rgba(255, 255, 255, 0.06);
	}

	.version-option:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: 2px;
	}

	.version-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
	}

	.version-label i {
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		width: 16px;
		text-align: center;
	}

	.version-date {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.version-divider {
		text-align: center;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		padding: 2px 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.conflict-backdrop {
			backdrop-filter: none;
		}

		.version-option {
			transition: none;
		}
	}
</style>
