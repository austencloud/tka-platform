<script lang="ts">
	/**
	 * BoundaryEditorPanel
	 *
	 * Boundary editing panel shown when in overhead/bird's-eye view.
	 * Allows drawing polygons to define area boundaries.
	 */

	interface Props {
		boundaryPoints: Array<{ x: number; z: number }>;
		isPolygonClosed: boolean;
		onCloseBoundary: () => void;
		onClearBoundary: () => void;
		onExitOverhead: () => void;
	}

	let {
		boundaryPoints,
		isPolygonClosed,
		onCloseBoundary,
		onClearBoundary,
		onExitOverhead,
	}: Props = $props();
</script>

<div class="overhead-panel">
	<div class="overhead-header">
		<i class="fas fa-draw-polygon" aria-hidden="true"></i>
		<span>Boundary Editor</span>
	</div>

	<!-- Boundary status -->
	<div class="boundary-status">
		{#if isPolygonClosed}
			<span class="status-badge closed">
				<i class="fas fa-check-circle" aria-hidden="true"></i>
				Boundary Set ({boundaryPoints.length} points)
			</span>
		{:else if boundaryPoints.length > 0}
			<span class="status-badge open">
				<i class="fas fa-pencil-alt" aria-hidden="true"></i>
				Drawing... ({boundaryPoints.length} points)
			</span>
		{:else}
			<span class="status-badge empty">
				<i class="fas fa-mouse-pointer" aria-hidden="true"></i>
				Click to add points
			</span>
		{/if}
	</div>

	<p class="overhead-hint">
		{#if !isPolygonClosed}
			Click the terrain to add boundary points.
			{#if boundaryPoints.length >= 3}
				<br /><strong>Click near first point to close.</strong>
			{/if}
		{:else}
			Boundary is set. Clear to redraw.
		{/if}
	</p>

	<!-- Boundary actions -->
	<div class="boundary-actions">
		{#if boundaryPoints.length >= 3 && !isPolygonClosed}
			<button class="boundary-btn close" onclick={onCloseBoundary}>
				<i class="fas fa-check" aria-hidden="true"></i>
				Close Polygon
			</button>
		{/if}
		{#if boundaryPoints.length > 0}
			<button class="boundary-btn clear" onclick={onClearBoundary}>
				<i class="fas fa-trash-alt" aria-hidden="true"></i>
				Clear
			</button>
		{/if}
	</div>

	<hr class="divider" />

	<button class="overhead-action" onclick={onExitOverhead}>
		<i class="fas fa-walking" aria-hidden="true"></i>
		Return to Ground
	</button>
</div>

<style>
	.overhead-panel {
		position: absolute;
		top: 70px;
		right: 16px;
		background: rgba(0, 0, 0, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 14px;
		font-family: system-ui, sans-serif;
		z-index: 200;
		max-width: 220px;
	}

	.overhead-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
		color: white;
		font-weight: 600;
		font-size: 14px;
	}

	.overhead-header i {
		color: #60a5fa;
	}

	.overhead-hint {
		margin: 0 0 12px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
		line-height: 1.5;
	}

	.overhead-hint strong {
		color: rgba(255, 255, 255, 0.8);
	}

	/* Boundary status */
	.boundary-status {
		margin-bottom: 10px;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
	}

	.status-badge.empty {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.6);
	}

	.status-badge.open {
		background: rgba(249, 115, 22, 0.15);
		color: #f97316;
	}

	.status-badge.closed {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
	}

	/* Boundary actions */
	.boundary-actions {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}

	.boundary-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) ease;
	}

	.boundary-btn.close {
		background: rgba(74, 222, 128, 0.15);
		border: 1px solid rgba(74, 222, 128, 0.3);
		color: #4ade80;
	}

	.boundary-btn.close:hover {
		background: rgba(74, 222, 128, 0.25);
		border-color: rgba(74, 222, 128, 0.5);
	}

	.boundary-btn.clear {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #f87171;
	}

	.boundary-btn.clear:hover {
		background: rgba(239, 68, 68, 0.25);
		border-color: rgba(239, 68, 68, 0.5);
	}

	.divider {
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		margin: 12px 0;
	}

	.overhead-action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px;
		background: rgba(249, 115, 22, 0.15);
		border: 1px solid rgba(249, 115, 22, 0.3);
		border-radius: 6px;
		color: #f97316;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms) ease;
	}

	.overhead-action:hover {
		background: rgba(249, 115, 22, 0.25);
		border-color: rgba(249, 115, 22, 0.5);
	}
</style>
