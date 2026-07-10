<script lang="ts">
	/**
	 * Fuse Panel
	 *
	 * One side of the fuse split view. Owns its shuffle pool (state factory).
	 *
	 * Single layout at every size: ring-lit square stage on top, notation strip
	 * below, shuffle at the bottom. The panel is a size container and adapts to
	 * its own shape - wide panels give the stage the spare room (strip keeps a
	 * fixed share), tall panels (portrait phones) pin the stage to a
	 * width-square and let the notation strip absorb the vertical space, so
	 * there is never a dead zone. ChoreoCard is forced to even columns with no
	 * start cell (8-count = 4x2 wide, 2x4 tall).
	 *
	 * Shuffles swap stage + strip through the shared Crossfade primitive; the
	 * strip trails the stage by a beat for a cascading deal, and the incoming
	 * stage content lands with a brief accent ring flash.
	 */

	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
	import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
	import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
	import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
	import Crossfade from "$lib/shared/components/Crossfade.svelte";
	import FuseAnimationPreview from "./FuseAnimationPreview.svelte";
	import { createFuseShufflePool } from "../state/fuse-shuffle-pool.svelte";
	import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
	import { getSettings } from "$lib/shared/application/state/app-state.svelte";
	import { getFuseContext } from "../context/fuse-context";

	let {
		side,
		bpm,
		onControllerReady,
		onCurrentSequenceChange,
		length = 8,
		currentStep = 0,
	}: {
		side: "left" | "right";
		bpm: number;
		onControllerReady?: (controller: AnimationPlaybackController) => void;
		onCurrentSequenceChange?: (seq: SequenceData | null) => void;
		length?: number;
		currentStep?: number;
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

	// Even grid, no start cell. Wide panels read 4 across (8-count = 4x2);
	// narrow panels read 2 across (8-count = 2x4). Every length option divides
	// evenly by both. Length 2 is a single pair either way.
	let panelWidth = $state(0);
	const cardColumns = $derived(
		length === 2 ? 2 : panelWidth > 0 && panelWidth < 300 ? 2 : 4
	);

	const pool = createFuseShufflePool({
		browseLoader: getBrowseLoader(),
		getLength: () => length,
		onCurrentItemChange: (seq) => onCurrentSequenceChange?.(seq),
	});

	const currentSequence = $derived(pool.currentItem);
	const seqKey = $derived(currentSequence?.id ?? pool.poolIndex);

	// Kick the shared beat clock once sequences exist to animate
	$effect(() => {
		if (pool.poolSize > 0) fuseState.startClock();
	});

	const highlightedStep = $derived.by(() => {
		if (!currentSequence?.steps?.length) return null;
		return Math.floor(currentStep) % currentSequence.steps.length;
	});

	function handleShuffle() {
		pool.shuffle();
	}
</script>

{#snippet propCard(seq: SequenceData)}
	{#if seq.steps && seq.steps.length > 0}
		<div class="choreo-card-wrap themed-scrollbar">
			<ChoreoCard
				sequence={seq}
				browseViewMode={viewMode}
				columnCount={cardColumns}
				includeStartPosition={false}
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
	role="region"
	aria-label="{label} prop path"
	style="--accent: {accentColor};"
	bind:clientWidth={panelWidth}
>
	<!-- Hero stage: ring-lit square, ambient spotlight behind -->
	<div class="stage">
		<div class="stage-box">
			{#if currentSequence}
				<Crossfade key={seqKey} fill>
					<div class="stage-enter">
						<FuseAnimationPreview
							sequence={currentSequence}
							{bpm}
							{onControllerReady}
							{propColor}
							{currentStep}
						/>
					</div>
				</Crossfade>
			{:else}
				<div class="stage-placeholder">
					{#if pool.loading}
						<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
					{:else}
						<i class="fas fa-play-circle" aria-hidden="true"></i>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="strip">
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
			<Crossfade key={seqKey} fill delay={80}>
				{@render propCard(currentSequence)}
			</Crossfade>
		{/if}
	</div>

	<div class="panel-actions">
		<button
			class="shuffle-btn"
			onclick={handleShuffle}
			disabled={pool.poolSize <= 1}
			aria-label="Shuffle {label} to next sequence"
		>
			<i class="fas fa-shuffle" aria-hidden="true"></i>
			<span class="shuffle-label">Shuffle</span>
		</button>
	</div>
</div>

<style>
	/* The panel is a lit stage for one prop path: panel surface with a faint
	   accent wash falling from the top edge, accent-tinted top border, soft
	   elevation. Sized by the parent grid (FuseLayout centers + caps cells).
	   It's a size container so its children can adapt to its shape. */
	.fuse-panel {
		container: fuse-panel / size;
		display: flex;
		flex-direction: column;
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

	/* ── Hero stage ─────────────────────────────────────────────── */

	/* Wide panels: fills the space above the strip; centers a square stage box
	   sized to whichever axis is tighter. The spotlight covers the WHOLE stage
	   area so leftover space around the square reads as ambience, not void. */
	.stage {
		flex: 1 1 auto;
		min-height: 0;
		position: relative;
		container-type: size;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-sm, 8px);
	}

	.stage::before {
		content: "";
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 75% 60% at 50% 45%,
			color-mix(in srgb, var(--accent) 9%, transparent) 0%,
			transparent 75%
		);
		pointer-events: none;
	}

	.stage-box {
		width: min(100cqw - 16px, 100cqh - 16px);
		aspect-ratio: 1;
		position: relative;
		border-radius: var(--radius-md, 12px);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
		overflow: hidden;
	}

	.stage-enter {
		width: 100%;
		height: 100%;
		animation: stageIn 420ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
	}

	/* Incoming shuffle lands with a settle + accent ring flash */
	@keyframes stageIn {
		from {
			opacity: 0.4;
			transform: scale(0.985);
		}
	}

	.stage-enter::after {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 28px color-mix(in srgb, var(--accent) 35%, transparent);
		opacity: 0;
		animation: ringFlash 600ms ease-out;
		pointer-events: none;
	}

	@keyframes ringFlash {
		0% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	.stage-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
		font-size: 2rem;
	}

	/* ── Notation strip ─────────────────────────────────────────── */

	/* Wide panels: fixed share so ChoreoCard gets a definite box to size its
	   grid into (it fits cells to its container). Stage takes the rest. */
	.strip {
		flex: 0 0 32%;
		min-height: 120px;
		position: relative;
		padding: 0 var(--spacing-sm, 8px) var(--spacing-xs, 4px);
	}

	/* Tall panels (portrait phones): invert the space contract. The stage pins
	   to a width-square (capped so it can never starve the strip) and the
	   notation strip absorbs ALL remaining height - the pictographs fill what
	   used to be void. 8-count at 2 columns = 2x4, which lands within a few px
	   of the available strip height on a typical phone. */
	@container fuse-panel (max-aspect-ratio: 3/4) {
		.stage {
			flex: 0 0 auto;
			height: min(100cqw, 60cqh);
		}

		.strip {
			flex: 1 1 auto;
			min-height: 0;
		}
	}

	/* Definite box for ChoreoCard's contain-fit (it aspect-fits + centers its
	   grid inside this box itself); long cards overflow-scroll. */
	.choreo-card-wrap {
		width: 100%;
		height: 100%;
		overflow-y: auto;
	}

	/* ── Bottom actions (shuffle) ───────────────────────────────── */

	/* Contained pill control on padded ground - not an edge-to-edge strip */
	.panel-actions {
		flex-shrink: 0;
		display: flex;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-sm, 8px) 10px;
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

	.shuffle-btn:active:not(:disabled) i {
		transform: rotate(180deg);
	}

	.shuffle-btn i {
		transition: transform 300ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
	}

	.shuffle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.shuffle-label {
		letter-spacing: 0.03em;
	}

	/* ── Shared states ──────────────────────────────────────────── */

	.state-msg {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: var(--spacing-sm, 8px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-sm, 14px);
		text-align: center;
	}

	.hint {
		font-size: var(--font-size-compact, 12px);
	}

	@media (prefers-reduced-motion: reduce) {
		.shuffle-btn {
			transition: none;
		}

		.shuffle-btn i {
			transition: none;
		}

		.stage-enter,
		.stage-enter::after {
			animation: none;
		}
	}
</style>
