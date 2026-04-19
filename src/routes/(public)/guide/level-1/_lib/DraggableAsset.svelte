<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';
	import interact from 'interactjs';
	import type { PlacedAsset, Position, Size } from './sidecar-schema';

	interface Props {
		asset: PlacedAsset;
		pageWidth: number;
		pageHeight: number;
		selected: boolean;
		onSelect: () => void;
		onChange: (next: { position: Position; size: Size }) => void;
		onDeselect?: () => void;
		children?: Snippet;
	}

	let {
		asset,
		pageWidth,
		pageHeight,
		selected,
		onSelect,
		onChange,
		children
	}: Props = $props();

	let host: HTMLDivElement | undefined = $state();

	// Pending drag/resize deltas applied via inline transform during interaction.
	// Committed to onChange only on drag/resize end so the undo stack isn't
	// flooded with intermediate frames.
	let pending: { dx: number; dy: number; dw: number; dh: number } = $state({
		dx: 0,
		dy: 0,
		dw: 0,
		dh: 0
	});

	// Suppress the click event that interact.js fires immediately after a drag.
	let wasDragging = false;

	const baseLeftPx = $derived(
		asset.position.unit === 'pct' ? (asset.position.x / 100) * pageWidth : asset.position.x
	);
	const baseTopPx = $derived(
		asset.position.unit === 'pct' ? (asset.position.y / 100) * pageHeight : asset.position.y
	);
	const baseWidthPx = $derived(
		asset.size.unit === 'pct' ? (asset.size.width / 100) * pageWidth : asset.size.width
	);
	const baseHeightPx = $derived(
		asset.size.unit === 'pct' ? (asset.size.height / 100) * pageHeight : asset.size.height
	);

	function pxToPosition(xPx: number, yPx: number): Position {
		if (asset.position.unit === 'pct') {
			return {
				x: pageWidth > 0 ? (xPx / pageWidth) * 100 : 0,
				y: pageHeight > 0 ? (yPx / pageHeight) * 100 : 0,
				unit: 'pct'
			};
		}
		return { x: xPx, y: yPx, unit: 'px' };
	}

	function pxToSize(wPx: number, hPx: number): Size {
		if (asset.size.unit === 'pct') {
			return {
				width: pageWidth > 0 ? (wPx / pageWidth) * 100 : 0,
				height: pageHeight > 0 ? (hPx / pageHeight) * 100 : 0,
				unit: 'pct'
			};
		}
		return { width: wPx, height: hPx, unit: 'px' };
	}

	onMount(() => {
		if (!host) return;
		const target = host;

		interact(target)
			.draggable({
				inertia: false,
				modifiers: [
					interact.modifiers.snap({
						targets: [interact.snappers.grid({ x: 8, y: 8 })],
						range: Infinity,
						relativePoints: [{ x: 0, y: 0 }]
					})
				],
				listeners: {
					start() {
						wasDragging = false;
					},
					move(event) {
						pending = {
							dx: pending.dx + event.dx,
							dy: pending.dy + event.dy,
							dw: pending.dw,
							dh: pending.dh
						};
						if (Math.abs(pending.dx) > 2 || Math.abs(pending.dy) > 2) {
							wasDragging = true;
						}
					},
					end() {
						const finalLeft = baseLeftPx + pending.dx;
						const finalTop = baseTopPx + pending.dy;
						const next = {
							position: pxToPosition(finalLeft, finalTop),
							size: pxToSize(baseWidthPx + pending.dw, baseHeightPx + pending.dh)
						};
						pending = { dx: 0, dy: 0, dw: 0, dh: 0 };
						onChange(next);
					}
				}
			})
			.resizable({
				edges: { left: true, right: true, top: true, bottom: true },
				listeners: {
					start() {
						wasDragging = false;
					},
					move(event) {
						const lockAspect = event.shiftKey;
						let dw = event.deltaRect?.width ?? 0;
						let dh = event.deltaRect?.height ?? 0;
						const dx = event.deltaRect?.left ?? 0;
						const dy = event.deltaRect?.top ?? 0;

						if (lockAspect) {
							// Use the dominant delta and propagate to the other dim.
							const aspect = baseWidthPx / Math.max(baseHeightPx, 1);
							if (Math.abs(dw) > Math.abs(dh)) {
								dh = dw / aspect;
							} else {
								dw = dh * aspect;
							}
						}

						pending = {
							dx: pending.dx + dx,
							dy: pending.dy + dy,
							dw: pending.dw + dw,
							dh: pending.dh + dh
						};
						wasDragging = true;
					},
					end() {
						const finalLeft = baseLeftPx + pending.dx;
						const finalTop = baseTopPx + pending.dy;
						const finalW = Math.max(8, baseWidthPx + pending.dw);
						const finalH = Math.max(8, baseHeightPx + pending.dh);
						const next = {
							position: pxToPosition(finalLeft, finalTop),
							size: pxToSize(finalW, finalH)
						};
						pending = { dx: 0, dy: 0, dw: 0, dh: 0 };
						onChange(next);
					}
				}
			});
	});

	onDestroy(() => {
		if (host) interact(host).unset();
	});

	function handleClick(event: MouseEvent) {
		if (wasDragging) {
			event.stopPropagation();
			wasDragging = false;
			return;
		}
		event.stopPropagation();
		onSelect();
	}

	function handlePointerDown() {
		wasDragging = false;
	}
</script>

<div
	bind:this={host}
	class="draggable-asset"
	class:selected
	style:left="{baseLeftPx + pending.dx}px"
	style:top="{baseTopPx + pending.dy}px"
	style:width="{Math.max(8, baseWidthPx + pending.dw)}px"
	style:height="{Math.max(8, baseHeightPx + pending.dh)}px"
	style:z-index={asset.zIndex ?? 1}
	style:transform={asset.rotation ? `rotate(${asset.rotation}deg)` : undefined}
	onclick={handleClick}
	onpointerdown={handlePointerDown}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect();
		}
	}}
	role="button"
	tabindex="0"
>
	{@render children?.()}
	{#if selected}
		<span class="handle handle-nw"></span>
		<span class="handle handle-n"></span>
		<span class="handle handle-ne"></span>
		<span class="handle handle-e"></span>
		<span class="handle handle-se"></span>
		<span class="handle handle-s"></span>
		<span class="handle handle-sw"></span>
		<span class="handle handle-w"></span>
	{/if}
</div>

<style>
	.draggable-asset {
		position: absolute;
		pointer-events: auto;
		touch-action: none;
		cursor: grab;
		box-sizing: border-box;
	}
	.draggable-asset:active {
		cursor: grabbing;
	}
	.draggable-asset.selected {
		box-shadow: 0 0 0 2px #4ea7e8;
	}
	.handle {
		position: absolute;
		width: 8px;
		height: 8px;
		background: #fff;
		border: 1px solid #4ea7e8;
		pointer-events: none;
		z-index: 2;
	}
	.handle-nw {
		left: -5px;
		top: -5px;
		cursor: nwse-resize;
	}
	.handle-n {
		left: 50%;
		top: -5px;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.handle-ne {
		right: -5px;
		top: -5px;
		cursor: nesw-resize;
	}
	.handle-e {
		right: -5px;
		top: 50%;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
	.handle-se {
		right: -5px;
		bottom: -5px;
		cursor: nwse-resize;
	}
	.handle-s {
		left: 50%;
		bottom: -5px;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.handle-sw {
		left: -5px;
		bottom: -5px;
		cursor: nesw-resize;
	}
	.handle-w {
		left: -5px;
		top: 50%;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
</style>
