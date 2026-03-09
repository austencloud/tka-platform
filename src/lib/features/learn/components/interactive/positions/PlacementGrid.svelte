<!--
PlacementGrid - Interactive grid for placing blue and red hand markers.
Uses the real pictograph renderer (PictographContainer) for visual consistency.
Tap targets overlay the real grid points so users interact with the actual pictograph.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import PictographContainer from '$lib/shared/pictograph/shared/components/PictographContainer.svelte';
	import { createMotionData } from '$lib/shared/pictograph/shared/domain/models/MotionData';
	import {
		GridLocation,
		GridMode,
	} from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
	import {
		MotionColor,
		MotionType,
		Orientation,
		RotationDirection,
	} from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
	import { PropType } from '$lib/shared/pictograph/prop/domain/enums/PropType';
	import type { PictographData } from '$lib/shared/pictograph/shared/domain/models/PictographData';
	import type { HandPosition } from '../../../domain/constants/position-quiz-data';
	import { container } from '$lib/shared/di';

	interface PlacementGridProps {
		gridMode: GridMode;
		onPlacementComplete: (left: HandPosition, right: HandPosition) => void;
		disabled?: boolean;
		showGuideLines?: boolean;
		guideLineType?: 'alpha' | 'beta' | 'gamma';
		guideLinePoints?: { left: HandPosition; right: HandPosition };
	}

	let {
		gridMode,
		onPlacementComplete,
		disabled = false,
		showGuideLines = false,
		guideLineType,
		guideLinePoints,
	}: PlacementGridProps = $props();

	// =========================================================================
	// Grid point definitions in real 950×950 coordinate space
	// Coordinates match the actual pictograph renderer (gridCoordinates.ts)
	// =========================================================================

	interface GridPoint {
		x: number;
		y: number;
		label: string;
		position: HandPosition;
		location: GridLocation;
	}

	const DIAMOND_POINTS: GridPoint[] = [
		{ x: 475.0, y: 331.9, label: 'North', position: 'N', location: GridLocation.NORTH },
		{ x: 618.1, y: 475.0, label: 'East', position: 'E', location: GridLocation.EAST },
		{ x: 475.0, y: 618.1, label: 'South', position: 'S', location: GridLocation.SOUTH },
		{ x: 331.9, y: 475.0, label: 'West', position: 'W', location: GridLocation.WEST },
	];

	const BOX_POINTS: GridPoint[] = [
		{ x: 576.2, y: 373.8, label: 'Northeast', position: 'NE', location: GridLocation.NORTHEAST },
		{ x: 576.2, y: 576.2, label: 'Southeast', position: 'SE', location: GridLocation.SOUTHEAST },
		{ x: 373.8, y: 576.2, label: 'Southwest', position: 'SW', location: GridLocation.SOUTHWEST },
		{ x: 373.8, y: 373.8, label: 'Northwest', position: 'NW', location: GridLocation.NORTHWEST },
	];

	const HAND_TO_LOCATION: Record<HandPosition, GridLocation> = {
		N: GridLocation.NORTH,
		E: GridLocation.EAST,
		S: GridLocation.SOUTH,
		W: GridLocation.WEST,
		NE: GridLocation.NORTHEAST,
		SE: GridLocation.SOUTHEAST,
		SW: GridLocation.SOUTHWEST,
		NW: GridLocation.NORTHWEST,
	};

	// Coordinate lookup for guide lines (all positions in their native grid mode)
	const POSITION_COORDS: Record<HandPosition, { x: number; y: number }> = {
		N: { x: 475.0, y: 331.9 },
		NE: { x: 576.2, y: 373.8 },
		E: { x: 618.1, y: 475.0 },
		SE: { x: 576.2, y: 576.2 },
		S: { x: 475.0, y: 618.1 },
		SW: { x: 373.8, y: 576.2 },
		W: { x: 331.9, y: 475.0 },
		NW: { x: 373.8, y: 373.8 },
	};

	// =========================================================================
	// Placement state machine: EMPTY → BLUE_PLACED → BOTH_PLACED
	// =========================================================================

	type PlacementState = 'empty' | 'blue-placed' | 'both-placed';

	let placementState = $state<PlacementState>('empty');
	let bluePosition = $state<HandPosition | null>(null);
	let redPosition = $state<HandPosition | null>(null);

	// Haptic feedback
	let hapticService: { trigger: (type: string) => void } | null = null;
	try {
		hapticService = container.items.hapticFeedback as {
			trigger: (type: string) => void;
		} | null;
	} catch {
		// Not available on desktop
	}

	// =========================================================================
	// Derived values
	// =========================================================================

	const activePoints = $derived(
		gridMode === GridMode.DIAMOND ? DIAMOND_POINTS : BOX_POINTS,
	);

	const promptText = $derived.by(() => {
		if (placementState === 'empty') return 'Tap a point for the blue hand';
		if (placementState === 'blue-placed') return 'Now tap a point for the red hand';
		return '';
	});

	const showUndo = $derived(placementState === 'blue-placed');

	// =========================================================================
	// Build real PictographData reactively based on placement
	// =========================================================================

	const pictographData: PictographData = $derived.by(() => {
		const blueLocation = bluePosition
			? HAND_TO_LOCATION[bluePosition]
			: GridLocation.NORTH;
		const redLocation = redPosition
			? HAND_TO_LOCATION[redPosition]
			: GridLocation.SOUTH;

		return {
			id: 'placement-grid',
			letter: null,
			startPosition: null,
			endPosition: null,
			gridMode,
			motions: {
				blue: createMotionData({
					motionType: MotionType.STATIC,
					rotationDirection: RotationDirection.NO_ROTATION,
					startLocation: blueLocation,
					endLocation: blueLocation,
					turns: 0,
					startOrientation: Orientation.IN,
					endOrientation: Orientation.IN,
					isVisible: placementState !== 'empty',
					propType: PropType.HAND,
					arrowLocation: blueLocation,
					color: MotionColor.BLUE,
					gridMode,
				}),
				red: createMotionData({
					motionType: MotionType.STATIC,
					rotationDirection: RotationDirection.NO_ROTATION,
					startLocation: redLocation,
					endLocation: redLocation,
					turns: 0,
					startOrientation: Orientation.IN,
					endOrientation: Orientation.IN,
					isVisible: placementState === 'both-placed',
					propType: PropType.HAND,
					arrowLocation: redLocation,
					color: MotionColor.RED,
					gridMode,
				}),
			},
		};
	});

	// =========================================================================
	// Handlers
	// =========================================================================

	function handlePointSelect(point: GridPoint) {
		if (disabled) return;

		if (placementState === 'empty') {
			bluePosition = point.position;
			placementState = 'blue-placed';
			hapticService?.trigger('selection');
			announceStatus(
				`Blue hand placed at ${point.label}. Tap a point for the red hand.`,
			);
			return;
		}

		if (placementState === 'blue-placed') {
			redPosition = point.position;
			placementState = 'both-placed';
			hapticService?.trigger('selection');
			const bluePosLabel = activePoints.find(
				(p) => p.position === bluePosition,
			)?.label;
			announceStatus(
				`Red hand placed at ${point.label}. Blue at ${bluePosLabel}, red at ${point.label}.`,
			);
			onPlacementComplete(bluePosition!, redPosition);
			return;
		}
	}

	function handleUndo() {
		bluePosition = null;
		placementState = 'empty';
		hapticService?.trigger('selection');
		announceStatus('Blue hand removed. Tap a point for the blue hand.');
	}

	function handleKeydown(event: KeyboardEvent, point: GridPoint) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handlePointSelect(point);
		}
	}

	// =========================================================================
	// Accessibility: live region announcements
	// =========================================================================

	let liveAnnouncement = $state('');

	function announceStatus(message: string) {
		liveAnnouncement = message;
	}

	// =========================================================================
	// Reset when gridMode changes (parent moves to next question)
	// =========================================================================

	$effect(() => {
		void gridMode;
		untrack(() => {
			placementState = 'empty';
			bluePosition = null;
			redPosition = null;
			liveAnnouncement = '';
		});
	});

	// =========================================================================
	// Point visual state helpers
	// =========================================================================

	function isBlueAt(position: HandPosition): boolean {
		return bluePosition === position && placementState !== 'empty';
	}

	function isRedAt(position: HandPosition): boolean {
		return redPosition === position && placementState === 'both-placed';
	}

	// =========================================================================
	// Guide line geometry (950×950 coordinate space)
	// =========================================================================

	function getGuideCoords() {
		if (!guideLinePoints) return null;
		const left = POSITION_COORDS[guideLinePoints.left];
		const right = POSITION_COORDS[guideLinePoints.right];
		if (!left || !right) return null;
		return { left, right };
	}

	function computeGammaArc(): string {
		const coords = getGuideCoords();
		if (!coords) return '';
		const cx = 475;
		const cy = 475;
		const r = 60;
		const angleLeft = Math.atan2(coords.left.y - cy, coords.left.x - cx);
		const angleRight = Math.atan2(coords.right.y - cy, coords.right.x - cx);

		const startX = cx + r * Math.cos(angleLeft);
		const startY = cy + r * Math.sin(angleLeft);
		const endX = cx + r * Math.cos(angleRight);
		const endY = cy + r * Math.sin(angleRight);

		let angleDiff = angleRight - angleLeft;
		if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
		if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
		const sweepFlag = angleDiff > 0 ? 1 : 0;

		return `M ${startX} ${startY} A ${r} ${r} 0 0 ${sweepFlag} ${endX} ${endY}`;
	}
</script>

<div class="placement-grid" class:disabled>
	<!-- Prompt text -->
	{#if promptText}
		<p class="prompt-text">{promptText}</p>
	{/if}

	<!-- Grid with real pictograph + tap overlay -->
	<div class="grid-container">
		<!-- Real pictograph layer -->
		<div class="pictograph-layer">
			<PictographContainer
				{pictographData}
				gridMode={gridMode}
				showTKA={false}
				showReversals={false}
				showVTG={false}
				showElemental={false}
				showPositions={false}
				disableTransitions={true}
				cellIndex={0}
				bluePropTypeOverride={PropType.HAND}
				redPropTypeOverride={PropType.HAND}
			/>
		</div>

		<!-- Tap target overlay (aligned to 950×950 pictograph coordinate space) -->
		<svg
			class="tap-overlay"
			viewBox="0 0 950 950"
			aria-label="Position placement grid"
		>
			<!-- Tappable grid points -->
			{#each activePoints as point (point.position)}
				{@const hasBlue = isBlueAt(point.position)}
				{@const hasRed = isRedAt(point.position)}

				<g
					class="tap-point"
					class:tappable={!disabled && placementState !== 'both-placed'}
					onclick={() => handlePointSelect(point)}
					onkeydown={(e) => handleKeydown(e, point)}
					role="button"
					tabindex={disabled ? -1 : 0}
					aria-label="{point.label} point{hasBlue ? ' (blue hand)' : ''}{hasRed ? ' (red hand)' : ''}"
					aria-disabled={disabled}
				>
					<!-- Generous invisible touch target for mobile -->
					<circle
						cx={point.x}
						cy={point.y}
						r={50}
						fill="transparent"
						class="touch-target"
					/>

					<!-- Subtle ring on unplaced points to indicate interactivity -->
					{#if !hasBlue && !hasRed && !disabled && placementState !== 'both-placed'}
						<circle
							cx={point.x}
							cy={point.y}
							r={24}
							fill="none"
							stroke="rgba(255, 255, 255, 0.25)"
							stroke-width="2.5"
							class="hint-ring"
						/>
					{/if}
				</g>
			{/each}

			<!-- Guide lines overlay (used by SemanticFeedback) -->
			{#if showGuideLines && guideLineType && guideLinePoints}
				{@const coords = getGuideCoords()}
				{#if coords}
					<g class="guide-lines">
						{#if guideLineType === 'alpha'}
							<!-- Alpha: dashed line through center showing opposite relationship -->
							<line
								x1={coords.left.x}
								y1={coords.left.y}
								x2={coords.right.x}
								y2={coords.right.y}
								stroke="rgba(255, 255, 255, 0.6)"
								stroke-width="4"
								stroke-dasharray="15 10"
							/>
							<circle cx="475" cy="475" r="10" fill="rgba(255, 255, 255, 0.4)" />
						{:else if guideLineType === 'beta'}
							<!-- Beta: concentric ripple circles at the shared point -->
							{#each [30, 50, 70] as radius, i}
								<circle
									cx={coords.left.x}
									cy={coords.left.y}
									r={radius}
									fill="none"
									stroke="rgba(255, 255, 255, 0.4)"
									stroke-width="2.5"
									class="beta-ripple"
									style="animation-delay: {i * 0.3}s;"
								/>
							{/each}
						{:else if guideLineType === 'gamma'}
							<!-- Gamma: right-angle arc indicator at center -->
							<line
								x1="475"
								y1="475"
								x2={coords.left.x}
								y2={coords.left.y}
								stroke="rgba(255, 255, 255, 0.3)"
								stroke-width="2.5"
								stroke-dasharray="10 8"
							/>
							<line
								x1="475"
								y1="475"
								x2={coords.right.x}
								y2={coords.right.y}
								stroke="rgba(255, 255, 255, 0.3)"
								stroke-width="2.5"
								stroke-dasharray="10 8"
							/>
							<path
								d={computeGammaArc()}
								fill="none"
								stroke="rgba(255, 255, 255, 0.6)"
								stroke-width="4"
							/>
							<text
								x="475"
								y="450"
								text-anchor="middle"
								fill="rgba(255, 255, 255, 0.5)"
								font-size="32"
							>90°</text>
						{/if}
					</g>
				{/if}
			{/if}
		</svg>
	</div>

	<!-- Undo button -->
	{#if showUndo && !disabled}
		<button class="undo-button" onclick={handleUndo}>
			Undo
		</button>
	{/if}

	<!-- Accessibility: live region for screen readers -->
	<div class="sr-only" aria-live="polite" aria-atomic="true">
		{liveAnnouncement}
	</div>
</div>

<style>
	.placement-grid {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.placement-grid.disabled {
		pointer-events: none;
		opacity: 0.7;
	}

	.prompt-text {
		margin: 0;
		font-size: var(--font-size-min, 14px);
		color: var(--theme-text, rgba(255, 255, 255, 0.9));
		text-align: center;
		font-weight: 500;
		min-height: 1.5em;
	}

	/* Container stacks the real pictograph and tap overlay */
	.grid-container {
		position: relative;
		width: 100%;
		max-width: 320px;
		aspect-ratio: 1;
		border-radius: 12px;
		overflow: hidden;
	}

	.pictograph-layer {
		width: 100%;
		height: 100%;
	}

	/* Transparent SVG overlay for tap targets, aligned to pictograph coordinates */
	.tap-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	/* Tap point interactivity */
	.tap-point.tappable {
		cursor: pointer;
	}

	.tap-point.tappable:hover .hint-ring,
	.tap-point.tappable:focus-visible .hint-ring {
		stroke: rgba(255, 255, 255, 0.55);
		stroke-width: 3;
	}

	.tap-point:focus-visible {
		outline: none;
	}

	.tap-point:focus-visible .touch-target {
		stroke: rgba(255, 255, 255, 0.5);
		stroke-width: 3;
		stroke-dasharray: 10 5;
	}

	.hint-ring {
		transition: stroke 0.15s ease, stroke-width 0.15s ease;
	}

	/* Guide line animations */
	.beta-ripple {
		animation: ripple-expand 1.5s ease-out infinite;
	}

	@keyframes ripple-expand {
		0% {
			opacity: 0.5;
		}
		100% {
			opacity: 0;
		}
	}

	/* Undo button */
	.undo-button {
		padding: 0.4rem 1rem;
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		color: var(--theme-text, rgba(255, 255, 255, 0.8));
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		cursor: pointer;
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.undo-button:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
		background: rgba(255, 255, 255, 0.08);
	}

	/* Screen reader only */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Accessibility: reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.hint-ring {
			transition: none;
		}

		.beta-ripple {
			animation: none;
		}

		.undo-button {
			transition: none;
		}
	}
</style>
