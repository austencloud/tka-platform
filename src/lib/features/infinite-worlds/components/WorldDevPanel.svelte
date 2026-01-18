<script lang="ts">
	/**
	 * WorldDevPanel
	 *
	 * Developer panel showing current position, yaw, and movement mode.
	 * Used for debugging and finding spawn points in 3D worlds.
	 */

	interface Props {
		position: { x: number; y: number; z: number };
		yaw: number;
		isFlyMode: boolean;
		isRunning: boolean;
	}

	let { position, yaw, isFlyMode, isRunning }: Props = $props();

	let copyFeedback = $state("");

	async function copyCoordinates(): Promise<void> {
		const text = `X: ${position.x} Z: ${position.z} Yaw: ${yaw}°`;
		try {
			await navigator.clipboard.writeText(text);
			copyFeedback = "Copied!";
			setTimeout(() => (copyFeedback = ""), 2000);
		} catch {
			copyFeedback = "Failed";
			setTimeout(() => (copyFeedback = ""), 2000);
		}
	}
</script>

<div class="dev-panel">
	<div class="dev-panel-header">
		<span class="dev-label">Position</span>
		<button
			class="copy-btn"
			class:copied={copyFeedback === "Copied!"}
			onclick={copyCoordinates}
			title="Copy coordinates"
		>
			{#if copyFeedback === "Copied!"}
				<i class="fas fa-check" aria-hidden="true"></i>
			{:else}
				<i class="fas fa-copy" aria-hidden="true"></i>
			{/if}
		</button>
	</div>
	<div class="position-grid">
		<div class="coord">
			<span class="coord-label">X</span>
			<span class="coord-value">{position.x}</span>
		</div>
		<div class="coord">
			<span class="coord-label">Z</span>
			<span class="coord-value">{position.z}</span>
		</div>
		<div class="coord">
			<span class="coord-label">Yaw</span>
			<span class="coord-value">{yaw}°</span>
		</div>
	</div>
	<div class="mode-row">
		<span class="mode-badge" class:fly={isFlyMode} class:run={isRunning && !isFlyMode}>
			{isFlyMode ? "FLY" : isRunning ? "RUN" : "WALK"}
		</span>
		<span class="mode-keys">G fly · Shift run</span>
	</div>
</div>

<style>
	.dev-panel {
		position: absolute;
		top: 60px;
		left: 16px;
		background: rgba(0, 0, 0, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 12px;
		font-family: system-ui, sans-serif;
		z-index: 200;
		min-width: 140px;
	}

	.dev-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.dev-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: rgba(255, 255, 255, 0.5);
	}

	.copy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		color: rgba(255, 255, 255, 0.5);
		font-size: 12px;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) ease;
	}

	.copy-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.8);
	}

	.copy-btn.copied {
		background: rgba(74, 222, 128, 0.15);
		border-color: rgba(74, 222, 128, 0.4);
		color: #4ade80;
	}

	.position-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 10px;
	}

	.coord {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.coord-label {
		font-size: 10px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.35);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.coord-value {
		font-size: 13px;
		font-weight: 600;
		font-family: "SF Mono", Monaco, monospace;
		color: rgba(255, 255, 255, 0.9);
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.mode-badge {
		padding: 3px 8px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.3);
	}

	.mode-badge.run {
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
		border-color: rgba(251, 191, 36, 0.3);
	}

	.mode-badge.fly {
		background: rgba(96, 165, 250, 0.15);
		color: #60a5fa;
		border-color: rgba(96, 165, 250, 0.3);
	}

	.mode-keys {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.3);
	}
</style>
