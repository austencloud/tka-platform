<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. Owns its shuffle pool (state factory)
	 * and renders the notation card + live animation + shuffle control.
	 *
	 * Regular width: ChoreoCard on top, animation below, shuffle at the bottom.
	 * Compact width (phones): animation-first — the card moves into a bottom
	 * drawer behind a grid button, so the two live animations sit side by side.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
	import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
	import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
	import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";
	import { createFuseShufflePool } from "../state/fuse-shuffle-pool.svelte";
	import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
	import { getSettings } from "$lib/shared/application/state/app-state.svelte";
	import { getFuseContext } from "../context/fuse-context";
	import { fuseTourState } from "$lib/shared/onboarding/state/fuse-tour-state.svelte";

	let {
		side,
		bpm,
		onControllerReady,
		onCurrentSequenceChange,
		length = 8,
		currentStep = 0,
		compact = false,
		tourShuffleGlow = false,
	}: {
		side: "left" | "right";
		bpm: number;
		onControllerReady?: (controller: AnimationPlaybackController) => void;
		onCurrentSequenceChange?: (seq: SequenceData | null) => void;
		length?: number;
		currentStep?: number;
		compact?: boolean;
		tourShuffleGlow?: boolean;
	} = $props();

	const { state: fuseState } = getFuseContext();

	const label = $derived(side === "left" ? "Blue" : "Red");
	const propColor = $derived<"blue" | "red">(side === "left" ? "blue" : "red");
	const accentColor = $derived(side === "left" ? "var(--prop-blue, #2196f3)" : "var(--prop-red, #f44336)");

	// Single-prop card rendering for this side
	const viewMode = $derived<BrowseViewMode>({
		subject: "props",
		granularity: "solo",
		color: propColor,
	});

	const pool = createFuseShufflePool({
		browseLoader: getBrowseLoader(),
		getLength: () => length,
		onCurrentItemChange: (seq) => onCurrentSequenceChange?.(seq),
	});

	const currentSequence = $derived(pool.currentItem);

	// Kick the shared beat clock once sequences exist to animate
	$effect(() => {
		if (pool.poolSize > 0) fuseState.startClock();
	});

	const highlightedStep = $derived.by(() => {
		if (!currentSequence?.steps?.length) return null;
		return Math.floor(currentStep) % currentSequence.steps.length;
	});

	let cardDrawerOpen = $state(false);

	function handleShuffle() {
		pool.shuffle();
		if (fuseTourState.isActive && fuseTourState.currentStop === "shuffle") {
			fuseTourState.completeAction();
			setTimeout(() => fuseTourState.advance(), 1500);
		}
	}
</script>

{#snippet propCard(seq: SequenceData)}
	{#if seq.steps && seq.steps.length > 0}
		<div class="choreo-card-wrap themed-scrollbar">
			<ChoreoCard
				sequence={seq}
				browseViewMode={viewMode}
				showWord={false}
				showStepNumbers={true}
				showDifficultyLevel={false}
				showCreatorName={false}
				showNotes={false}
				showBirthday={false}
				showLoopGlyph={false}
				darkMode={true}
				bluePropType={getSettings().bluePropType}
				redPropType={getSettings().redPropType}
				highlightedStepIndex={highlightedStep}
				showHighlight={highlightedStep !== null}
				hideSoloHeader={true}
			/>
		</div>
	{:else}
		<div class="state-msg">
			<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
			<span>Loading steps...</span>
		</div>
	{/if}
{/snippet}

<div
	class="fuse-panel"
	class:compact
	role="region"
	aria-label="{label} prop path"
	style="--accent: {accentColor};"
>
	<div class="content-column">
		<header class="panel-head">
			<span class="side-dot" aria-hidden="true"></span>
			<span class="side-label">{label} path</span>
		</header>

		{#if !compact}
			<div class="card-section">
				{#if pool.loading}
					<div class="state-msg">
						<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
						<span>Loading sequences...</span>
					</div>
				{:else if !currentSequence}
					<div class="state-msg">
						<span>No sequences found for this length.</span>
						<span class="hint">Try a different step count.</span>
					</div>
				{:else}
					{#key currentSequence.id ?? pool.poolIndex}
						{@render propCard(currentSequence)}
					{/key}
				{/if}
			</div>
		{/if}

		<div class="animation-section">
			{#if currentSequence}
				{#key currentSequence.id ?? currentSequence.word}
					<FuseAnimationPreview
						sequence={currentSequence}
						{bpm}
						{onControllerReady}
						{propColor}
						{currentStep}
					/>
				{/key}
			{:else if pool.loading}
				<div class="animation-placeholder">
					<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
				</div>
			{:else}
				<div class="animation-placeholder">
					<i class="fas fa-play-circle" aria-hidden="true"></i>
				</div>
			{/if}
		</div>

		<div class="panel-actions">
			{#if compact}
				<button
					class="grid-btn"
					onclick={() => (cardDrawerOpen = true)}
					aria-label="Show {label} notation grid"
					title="Notation grid"
				>
					<i class="fas fa-table-cells" aria-hidden="true"></i>
				</button>
			{/if}

			<button
				class="shuffle-btn"
				class:glow={tourShuffleGlow}
				onclick={handleShuffle}
				disabled={pool.poolSize <= 1}
				aria-label="Shuffle {label} to next sequence"
			>
				<i class="fas fa-shuffle" aria-hidden="true"></i>
				<span class="shuffle-label">Shuffle</span>
				{#if pool.poolSize > 0}
					<span class="shuffle-counter">{pool.poolIndex + 1} / {pool.poolSize}</span>
				{/if}
			</button>
		</div>
	</div>
</div>

{#if compact}
	<Drawer
		bind:isOpen={cardDrawerOpen}
		placement="bottom"
		ariaLabel="{label} notation grid"
	>
		<div class="drawer-card">
			{#if currentSequence}
				{#key currentSequence.id ?? pool.poolIndex}
					{@render propCard(currentSequence)}
				{/key}
			{:else}
				<div class="state-msg">
					<span>No sequence showing.</span>
				</div>
			{/if}
		</div>
	</Drawer>
{/if}

<style>
	/* The panel is a lit stage for one prop path: panel surface with a faint
	   accent wash falling from the top edge, accent-tinted top border, soft
	   elevation. Sized by the parent grid (FuseLayout centers + caps cells). */
	.fuse-panel {
		display: flex;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent) 7%, transparent) 0%,
				transparent 140px
			),
			var(--theme-panel-bg, rgba(18, 18, 28, 0.55));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-top-color: color-mix(in srgb, var(--accent) 40%, var(--theme-stroke, rgba(255, 255, 255, 0.08)));
		border-radius: var(--radius-lg, 16px);
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
		overflow: hidden;
	}

	.content-column {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		container-type: size;
	}

	/* ── Panel identity header ──────────────────────────────────── */

	.panel-head {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		padding: 12px 16px 10px;
	}

	.side-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 70%, transparent);
	}

	.side-label {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
	}

	.card-section {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 0 var(--spacing-sm, 8px);
	}

	.choreo-card-wrap {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		animation: cardIn 240ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
	}

	@keyframes cardIn {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	/* Square animation stage. Sized against the column's own height so it can
	   never crush the card above it: no wider than the column, no taller than
	   half the column. aspect-ratio keeps it square within those bounds. */
	.animation-section {
		flex-shrink: 0;
		width: min(100%, 50cqh);
		aspect-ratio: 1;
		align-self: center;
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
		position: relative;
		overflow: hidden;
	}

	/* Faint accent spotlight behind the moving prop - gives the stage depth
	   without competing with the animation itself. */
	.animation-section::before {
		content: "";
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 70% 55% at 50% 45%,
			color-mix(in srgb, var(--accent) 9%, transparent) 0%,
			transparent 75%
		);
		pointer-events: none;
	}

	/* Compact: the animation IS the panel. Square stage at full panel width;
	   the panel wraps to fit (header + stage + actions) and the parent grid
	   centers the pair vertically - no stretched voids. */
	.fuse-panel.compact .animation-section {
		flex: none;
		width: 100%;
		aspect-ratio: 1;
		border-top: none;
	}

	.fuse-panel.compact .content-column {
		height: auto;
		container-type: inline-size;
	}

	.animation-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
		font-size: 2rem;
	}

	/* ── Bottom actions (grid expand + shuffle) ─────────────────── */

	/* Contained pill controls on padded ground - not an edge-to-edge strip */
	.panel-actions {
		flex-shrink: 0;
		display: flex;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-sm, 8px) 10px;
	}

	.grid-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 48px;
		min-height: 48px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 999px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-sm, 14px);
		cursor: pointer;
		transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
	}

	.grid-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, #ffffff);
	}

	.shuffle-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		min-height: 48px;
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-sm, 14px);
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
	}

	.shuffle-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 22%, transparent);
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		box-shadow: 0 2px 16px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.shuffle-btn:active:not(:disabled) {
		background: color-mix(in srgb, var(--accent) 30%, transparent);
	}

	.shuffle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.shuffle-btn.glow {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
		box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent);
		animation: shuffleGlow 1.5s ease-in-out infinite;
	}

	@keyframes shuffleGlow {
		0%, 100% {
			box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent);
			background: color-mix(in srgb, var(--accent) 30%, transparent);
		}
		50% {
			box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 50%, transparent);
			background: color-mix(in srgb, var(--accent) 45%, transparent);
		}
	}

	.shuffle-label {
		letter-spacing: 0.03em;
	}

	.shuffle-counter {
		font-size: var(--font-size-compact, 12px);
		font-weight: 400;
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
	}

	/* ── Drawer + shared states ─────────────────────────────────── */

	.drawer-card {
		display: flex;
		flex-direction: column;
		height: min(70vh, 640px);
		padding: var(--spacing-sm, 8px);
	}

	.state-msg {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
		text-align: center;
	}

	.hint {
		font-size: var(--font-size-compact, 12px);
	}

	@media (prefers-reduced-motion: reduce) {
		.shuffle-btn,
		.grid-btn {
			transition: none;
		}

		.shuffle-btn.glow,
		.choreo-card-wrap {
			animation: none;
		}
	}
</style>
