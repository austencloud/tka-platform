<script lang="ts">
	/**
	 * PlaqueOverlay - Museum plaque display
	 *
	 * Fullscreen overlay showing exhibit plaque text,
	 * styled to look like a real museum information panel.
	 * Press ESC or click the backdrop to close.
	 */
	import type { PlaqueContent } from "../domain/archive-types";

	interface Props {
		content: PlaqueContent;
		visible: boolean;
		onClose: () => void;
	}

	let { content, visible, onClose }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && visible) {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains("plaque-backdrop")) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
	<div class="plaque-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown} role="button" tabindex="-1">
		<div class="plaque-container">
			<!-- Main plaque -->
			<div class="plaque-panel">
				<div class="plaque-border">
					<div class="plaque-title">{content.title}</div>
					<div class="plaque-subtitle">
						{#each content.subtitle.split("\n") as line}
							<div>{line}</div>
						{/each}
					</div>
					<div class="plaque-divider"></div>
					<div class="plaque-body">
						{#each content.body.split("\n\n") as paragraph}
							<p>{paragraph}</p>
						{/each}
					</div>
					<div class="plaque-divider"></div>
					<div class="plaque-footer">
						{#each content.footer.split("\n") as line}
							<div>{line}</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Secondary plaque (if present) -->
			{#if content.secondary}
				<div class="plaque-panel secondary">
					<div class="plaque-border">
						<div class="plaque-secondary-title">{content.secondary.title}</div>
						<div class="plaque-divider"></div>
						<div class="plaque-body small">
							{#each content.secondary.body.split("\n\n") as paragraph}
								<p>{paragraph}</p>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<div class="plaque-dismiss">Press ESC to close</div>
		</div>
	</div>
{/if}

<style>
	.plaque-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal);
		animation: fadeIn 0.3s ease-out;
	}

	.plaque-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 640px;
		max-height: 85vh;
		overflow-y: auto;
		padding: 2rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(200, 180, 140, 0.3) transparent;
	}

	.plaque-panel {
		background: #1a1612;
		border: 2px solid #3a3228;
		box-shadow:
			0 0 30px rgba(0, 0, 0, 0.5),
			inset 0 0 60px rgba(0, 0, 0, 0.3);
	}

	.plaque-panel.secondary {
		background: #161210;
		border-color: #2a2420;
	}

	.plaque-border {
		padding: 2rem 2.5rem;
		border: 1px solid #2a2218;
		margin: 6px;
	}

	.plaque-title {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 1.1rem;
		letter-spacing: 0.25em;
		text-align: center;
		color: #d4c5a0;
		margin-bottom: 0.75rem;
		font-weight: 400;
	}

	.plaque-subtitle {
		text-align: center;
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 0.85rem;
		color: #a09070;
		line-height: 1.6;
		font-style: italic;
	}

	.plaque-divider {
		height: 1px;
		background: linear-gradient(
			to right,
			transparent,
			#3a3228 20%,
			#3a3228 80%,
			transparent
		);
		margin: 1.25rem 0;
	}

	.plaque-body {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 0.9rem;
		line-height: 1.75;
		color: #c8b890;
		text-align: justify;
	}

	.plaque-body.small {
		font-size: 0.82rem;
		line-height: 1.65;
		color: #a89878;
	}

	.plaque-body p {
		margin: 0 0 0.8rem 0;
	}

	.plaque-body p:last-child {
		margin-bottom: 0;
	}

	.plaque-secondary-title {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 0.8rem;
		letter-spacing: 0.2em;
		text-align: center;
		color: #a09070;
		font-weight: 400;
	}

	.plaque-footer {
		text-align: center;
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 0.75rem;
		color: #807060;
		font-style: italic;
		line-height: 1.6;
	}

	.plaque-dismiss {
		text-align: center;
		font-size: 0.75rem;
		color: rgba(200, 180, 140, 0.4);
		font-family: system-ui, sans-serif;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
