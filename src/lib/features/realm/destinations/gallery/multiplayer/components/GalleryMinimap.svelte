<script lang="ts">
	/**
	 * GalleryMinimap
	 *
	 * 2D overhead view of the gallery showing player positions.
	 * - Local player shown as larger colored dot
	 * - Remote players shown as smaller dots with names
	 * - Gallery walls rendered as simple lines
	 * - Click to teleport (optional)
	 */

	import { t } from "$lib/shared/i18n/i18n.svelte.js";
	import type { GalleryLayout } from '../../domain/models/GalleryLayout';
	import type { RemotePlayer, PlayerPosition } from '../domain/multiplayer-models';

	interface Props {
		/** Gallery layout for rendering walls */
		layout: GalleryLayout;
		/** Local player position */
		localPosition: PlayerPosition;
		/** Local player yaw (facing direction) */
		localYaw?: number;
		/** Remote players to display */
		remotePlayers: RemotePlayer[];
		/** Whether minimap is expanded (larger view) */
		expanded?: boolean;
		/** Callback when clicking on minimap to teleport */
		onTeleport?: (position: PlayerPosition) => void;
	}

	let {
		layout,
		localPosition,
		localYaw = 0,
		remotePlayers,
		expanded = false,
		onTeleport
	}: Props = $props();

	// Minimap sizing
	const MINIMAP_SIZE = $derived(expanded ? 280 : 140);
	const PADDING = 10;

	// Calculate scale from layout floor size
	const bounds = $derived.by(() => {
		const width = layout.floorSize.width;
		const depth = layout.floorSize.depth;
		const maxDimension = Math.max(width, depth);
		const scale = (MINIMAP_SIZE - PADDING * 2) / maxDimension;
		return {
			minX: -width / 2,
			maxX: width / 2,
			minZ: 0,
			maxZ: depth,
			width,
			depth,
			scale
		};
	});

	// Transform world position to minimap coordinates
	function worldToMinimap(pos: { x: number; z: number }): { x: number; y: number } {
		const b = bounds;
		const x = PADDING + (pos.x - b.minX) * b.scale;
		const y = PADDING + (pos.z - b.minZ) * b.scale;
		return { x, y };
	}

	// Generate wall segments for SVG
	// Note: GalleryLayout currently uses GLB models without explicit wall data
	// Walls are part of the 3D model. For minimap, we just show the floor bounds.
	const wallPaths = $derived.by(() => {
		const b = bounds;
		// Draw a rectangle representing the gallery bounds
		const paths: string[] = [];
		const topLeft = worldToMinimap({ x: b.minX, z: b.minZ });
		const topRight = worldToMinimap({ x: b.maxX, z: b.minZ });
		const bottomRight = worldToMinimap({ x: b.maxX, z: b.maxZ });
		const bottomLeft = worldToMinimap({ x: b.minX, z: b.maxZ });

		paths.push(`M ${topLeft.x} ${topLeft.y}`);
		paths.push(`L ${topRight.x} ${topRight.y}`);
		paths.push(`L ${bottomRight.x} ${bottomRight.y}`);
		paths.push(`L ${bottomLeft.x} ${bottomLeft.y}`);
		paths.push(`Z`);

		return paths.join(' ');
	});

	// Local player minimap position
	const localMinimapPos = $derived(worldToMinimap({ x: localPosition.x, z: localPosition.z }));

	// Remote player minimap positions
	const remoteMinimapPositions = $derived(
		remotePlayers.map((player) => ({
			...player,
			minimapPos: worldToMinimap({ x: player.position.x, z: player.position.z })
		}))
	);

	// Direction indicator for local player
	const directionLine = $derived.by(() => {
		const length = expanded ? 12 : 8;
		// yaw is in radians, 0 = facing +Z, need to convert to SVG coords
		const dx = Math.sin(localYaw) * length;
		const dy = Math.cos(localYaw) * length;
		return {
			x2: localMinimapPos.x + dx,
			y2: localMinimapPos.y + dy
		};
	});

	// Handle click to teleport
	function handleClick(e: MouseEvent) {
		if (!onTeleport) return;

		const svg = e.currentTarget as SVGElement;
		const rect = svg.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const clickY = e.clientY - rect.top;

		// Convert back to world coordinates
		const b = bounds;
		const worldX = b.minX + (clickX - PADDING) / b.scale;
		const worldZ = b.minZ + (clickY - PADDING) / b.scale;

		onTeleport({ x: worldX, y: localPosition.y, z: worldZ });
	}

	// Player colors
	const LOCAL_PLAYER_COLOR = '#4ade80'; // Green
	const REMOTE_PLAYER_COLOR = '#60a5fa'; // Blue
	const WALL_COLOR = 'rgba(255, 255, 255, 0.4)';
</script>

<div class="minimap-container" class:expanded>
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
	<svg
		width={MINIMAP_SIZE}
		height={MINIMAP_SIZE}
		viewBox="0 0 {MINIMAP_SIZE} {MINIMAP_SIZE}"
		onclick={handleClick}
		role={onTeleport ? "button" : "img"}
		aria-label={onTeleport ? t("gallery_minimap_teleport_label") : t("gallery_minimap_label")}
	>
		<!-- Background -->
		<rect
			x="0"
			y="0"
			width={MINIMAP_SIZE}
			height={MINIMAP_SIZE}
			fill="rgba(0, 0, 0, 0.6)"
			rx="8"
		/>

		<!-- Walls -->
		<path d={wallPaths} stroke={WALL_COLOR} stroke-width="2" fill="none" />

		<!-- Remote players -->
		{#each remoteMinimapPositions as player (player.userId)}
			<g class="remote-player">
				<!-- Player dot -->
				<circle
					cx={player.minimapPos.x}
					cy={player.minimapPos.y}
					r={expanded ? 5 : 3}
					fill={REMOTE_PLAYER_COLOR}
				/>
				<!-- Player name (only in expanded view) -->
				{#if expanded}
					<text
						x={player.minimapPos.x}
						y={player.minimapPos.y - 8}
						fill="white"
						font-size="9"
						text-anchor="middle"
						class="player-name"
					>
						{player.displayName.slice(0, 12)}
					</text>
				{/if}
			</g>
		{/each}

		<!-- Local player -->
		<g class="local-player">
			<!-- Direction indicator -->
			<line
				x1={localMinimapPos.x}
				y1={localMinimapPos.y}
				x2={directionLine.x2}
				y2={directionLine.y2}
				stroke={LOCAL_PLAYER_COLOR}
				stroke-width="2"
			/>
			<!-- Player dot -->
			<circle
				cx={localMinimapPos.x}
				cy={localMinimapPos.y}
				r={expanded ? 6 : 4}
				fill={LOCAL_PLAYER_COLOR}
			/>
		</g>

		<!-- Player count badge -->
		<g class="player-count">
			<rect
				x={MINIMAP_SIZE - 28}
				y="4"
				width="24"
				height="16"
				rx="8"
				fill="rgba(0, 0, 0, 0.7)"
			/>
			<text
				x={MINIMAP_SIZE - 16}
				y="15"
				fill="white"
				font-size="10"
				text-anchor="middle"
				font-weight="600"
			>
				{remotePlayers.length + 1}
			</text>
		</g>
	</svg>

	<!-- Expand/collapse button -->
	<button class="expand-button" aria-label={expanded ? t("gallery_minimap_collapse") : t("gallery_minimap_expand")}>
		<i class="fas fa-{expanded ? 'compress' : 'expand'}" aria-hidden="true"></i>
	</button>
</div>

<style>
	.minimap-container {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: all var(--duration-normal) ease;
	}

	.minimap-container.expanded {
		transform: scale(1);
	}

	svg {
		display: block;
		cursor: pointer;
	}

	.player-name {
		pointer-events: none;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}

	.remote-player circle {
		transition: r var(--duration-fast) ease;
	}

	.remote-player:hover circle {
		r: 6;
	}

	.local-player circle {
		filter: drop-shadow(0 0 4px rgba(74, 222, 128, 0.6));
	}

	.expand-button {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 24px;
		height: 24px;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		opacity: 0.7;
		transition: opacity var(--duration-fast);
	}

	.expand-button:hover {
		opacity: 1;
	}
</style>
