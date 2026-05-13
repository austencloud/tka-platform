<script lang="ts">
	import type { ContentType } from '../state/viewer-state.svelte';

	const RAIL_WIDTH_KEY = 'tka-viewer-rail-width';
	const DEFAULT_WIDTH = 180;
	const MIN_WIDTH = 72;
	const MAX_WIDTH = 300;

	interface Props {
		activeMode: ContentType;
		videoCount?: number;
		webgl2Available?: boolean;
		onBack: () => void;
		onSelectMode: (mode: ContentType) => void;
	}

	let { activeMode, videoCount = 0, webgl2Available = true, onBack, onSelectMode }: Props = $props();

	const allModes: { id: ContentType; icon: string; label: string }[] = [
		{ id: 'animation', icon: 'fa-play', label: '2D Animation' },
		{ id: 'animation-3d', icon: 'fa-cube', label: '3D Animation' },
		{ id: 'card', icon: 'fa-grip', label: 'Card' },
		{ id: 'videos', icon: 'fa-video', label: 'Videos' }
	];

	const modes = $derived(
		webgl2Available ? allModes : allModes.filter((m) => m.id !== 'animation-3d')
	);

	let navEl: HTMLElement | undefined = $state();

	function loadWidth(): number {
		try {
			const raw = localStorage.getItem(RAIL_WIDTH_KEY);
			if (raw) {
				const n = parseInt(raw, 10);
				if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
			}
		} catch { /* ignore */ }
		return DEFAULT_WIDTH;
	}

	let railWidth = $state(loadWidth());
	let collapsed = $derived(railWidth < 100);
	let dragging = $state(false);

	function persistWidth(w: number) {
		try { localStorage.setItem(RAIL_WIDTH_KEY, String(w)); } catch { /* ignore */ }
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		dragging = true;
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || !navEl) return;
		const rect = navEl.getBoundingClientRect();
		const newWidth = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - rect.left)));
		railWidth = newWidth;
	}

	function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		persistWidth(railWidth);
	}

	function onHandleDoubleClick() {
		railWidth = railWidth < 100 ? DEFAULT_WIDTH : MIN_WIDTH;
		persistWidth(railWidth);
	}

	function focusAt(index: number) {
		const buttons = navEl?.querySelectorAll<HTMLButtonElement>('.rail-mode-btn');
		buttons?.[index]?.focus();
	}

	function handleKeydown(e: KeyboardEvent, index: number) {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				focusAt(Math.min(index + 1, modes.length - 1));
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusAt(Math.max(index - 1, 0));
				break;
			case 'Home':
				e.preventDefault();
				focusAt(0);
				break;
			case 'End':
				e.preventDefault();
				focusAt(modes.length - 1);
				break;
		}
	}
</script>

<nav
	class="content-rail"
	class:collapsed
	class:dragging
	role="group"
	aria-label="Content switcher"
	bind:this={navEl}
	style:width="{railWidth}px"
>
	<button type="button" class="rail-back-btn" onclick={onBack} aria-label="Back to split view">
		<i class="fas fa-chevron-left" aria-hidden="true"></i>
		{#if !collapsed}
			<span class="rail-back-label">Back</span>
		{/if}
	</button>

	<div class="rail-modes">
		{#each modes as mode, i (mode.id)}
			<button
				type="button"
				class="rail-mode-btn"
				class:active={activeMode === mode.id}
				aria-pressed={activeMode === mode.id}
				aria-label={mode.label}
				onclick={() => onSelectMode(mode.id)}
				onkeydown={(e) => handleKeydown(e, i)}
			>
				<i class="fas {mode.icon}" aria-hidden="true"></i>
				{#if !collapsed}
					<span class="rail-mode-label">{mode.label}</span>
				{/if}
				{#if mode.id === 'videos' && videoCount > 0}
					<span class="rail-badge">{videoCount}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_tabindex -->
	<div
		class="resize-handle"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		ondblclick={onHandleDoubleClick}
		role="separator"
		aria-orientation="vertical"
		aria-valuenow={railWidth}
		aria-valuemin={MIN_WIDTH}
		aria-valuemax={MAX_WIDTH}
		aria-label="Resize sidebar"
		tabindex="0"
	></div>
</nav>

<style>
	.content-rail {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--theme-panel-bg, #0a0a14);
		border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
		overflow: hidden;
		flex-shrink: 0;
		transition: width 180ms cubic-bezier(0.2, 0, 0, 1);
	}

	.content-rail.dragging {
		transition: none;
		user-select: none;
	}

	.resize-handle {
		position: absolute;
		top: 0;
		right: -3px;
		width: 6px;
		height: 100%;
		cursor: col-resize;
		z-index: 10;
		touch-action: none;
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 32px;
		border-radius: 1px;
		background: rgba(255, 255, 255, 0);
		transition: background 150ms ease, height 150ms ease;
	}

	.resize-handle:hover::after,
	.dragging .resize-handle::after {
		background: var(--theme-accent, #6366f1);
		height: 48px;
	}

	.rail-back-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 16px 8px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		transition:
			background 120ms cubic-bezier(0.2, 0, 0, 1),
			color 120ms cubic-bezier(0.2, 0, 0, 1);
	}

	.rail-back-btn:hover {
		background: color-mix(in srgb, var(--theme-panel-bg, #0a0a14) 85%, white);
		color: var(--theme-text, #ffffff);
	}

	.rail-back-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #f43f5e);
		outline-offset: -2px;
	}

	.rail-back-btn i {
		font-size: 18px;
	}

	.rail-back-label {
		font-size: var(--font-size-xs, 11px);
		font-weight: 500;
		letter-spacing: 0.03em;
	}

	.rail-modes {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.rail-mode-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		cursor: pointer;
		position: relative;
		transition:
			background 120ms cubic-bezier(0.2, 0, 0, 1),
			color 120ms cubic-bezier(0.2, 0, 0, 1),
			border-color 120ms cubic-bezier(0.2, 0, 0, 1);
	}

	.rail-mode-btn:hover:not(.active) {
		background: rgba(255, 255, 255, 0.04);
		color: var(--theme-text, rgba(255, 255, 255, 0.8));
	}

	.rail-mode-btn.active {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
		border-left-color: var(--theme-accent, #6366f1);
		color: var(--theme-text, #ffffff);
	}

	.rail-mode-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: -2px;
	}

	.rail-mode-btn i {
		font-size: 20px;
	}

	.rail-mode-label {
		font-size: var(--font-size-xs, 11px);
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	.rail-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--theme-accent, #6366f1);
		color: white;
		font-size: 10px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.content-rail {
			transition: none;
		}
		.rail-back-btn,
		.rail-mode-btn {
			transition: none;
		}
	}
</style>
