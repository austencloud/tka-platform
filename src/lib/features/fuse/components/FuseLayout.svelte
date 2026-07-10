<script lang="ts">
	/**
	 * Fuse Layout
	 *
	 * Shuffle-to-discover: pick a step length, shuffle cards on each side,
	 * hit Fuse when you like what's showing. The fused sequence opens in the
	 * shared sequence viewer drawer (save/export/practice come with it).
	 *
	 * Under 700px the panels go animation-first: two live animations side by
	 * side, notation grids behind per-panel drawer buttons (see FusePanel).
	 */

	import { Popover } from "bits-ui";
	import { getFuseContext } from "../context/fuse-context";
	import FusePanel from "./FusePanel.svelte";
	import BpmQuickPopover from "$lib/shared/animation-engine/components/controls/BpmQuickPopover.svelte";
	import { fuseSequences } from "../services/sequence-fuser";
	import { deriveLettersForSequence } from "$lib/shared/navigation/services/letter-deriver";
	import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
	import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
	import { hasOpenDrawers } from "$lib/shared/foundation/ui/drawer/drawer-stack";
	import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

	const { state: fuseState } = getFuseContext();

	const LENGTHS = [2, 4, 8, 12, 16, 24, 32];

	let fuseLength = $state(8);
	let lengthOpen = $state(false);
	let bpmOpen = $state(false);

	// Animation-first breakpoint - measured on the layout itself so the tab
	// responds to its actual slot, not the viewport.
	let layoutWidth = $state(0);
	const compact = $derived(layoutWidth > 0 && layoutWidth < 700);

	// Track what each panel is currently showing
	let leftBrowsingSeq = $state<SequenceData | null>(null);
	let rightBrowsingSeq = $state<SequenceData | null>(null);

	// Fusable only when both sides carry compositional solo-prop data
	// (older public-index entries may lack it).
	const canFuse = $derived(
		!!leftBrowsingSeq?.blueSoloProp && !!rightBrowsingSeq?.redSoloProp
	);

	function selectLength(len: number) {
		fuseLength = len;
		lengthOpen = false;
	}

	async function handleFuse() {
		const blue = leftBrowsingSeq?.blueSoloProp;
		const red = rightBrowsingSeq?.redSoloProp;
		if (!blue || !red) return;

		try {
			let result = fuseSequences(blue, red, {
				maxSteps: Math.min(
					leftBrowsingSeq!.steps?.length || 8,
					rightBrowsingSeq!.steps?.length || 8
				),
			});

			// Derive letters so the fused sequence has a word (best effort)
			try {
				result = await deriveLettersForSequence(result);
			} catch {
				// Letters are nice-to-have, don't block on failure
			}

			openSequenceViewer(result, {
				returnPath: "/app/create",
				returnLabel: "Fuse",
				initialBpm: fuseState.bpm,
			});
		} catch (err) {
			console.error("[Fuse] Failed to fuse sequences:", err);
			showToast("These two didn't fuse - shuffle and try again", "error");
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === " " && !hasOpenDrawers()) {
			event.preventDefault();
			fuseState.toggleClock();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet panels()}
	<div class="fuse-panels">
		<FusePanel
			side="left"
			bpm={fuseState.bpm}
			onControllerReady={(ctrl) => fuseState.registerController("left", ctrl)}
			length={fuseLength}
			currentStep={fuseState.currentStep}
			onCurrentSequenceChange={(seq) => (leftBrowsingSeq = seq)}
			{compact}
		/>
		<FusePanel
			side="right"
			bpm={fuseState.bpm}
			onControllerReady={(ctrl) => fuseState.registerController("right", ctrl)}
			length={fuseLength}
			currentStep={fuseState.currentStep}
			onCurrentSequenceChange={(seq) => (rightBrowsingSeq = seq)}
			{compact}
		/>
	</div>
{/snippet}

{#snippet lengthChip()}
	<Popover.Root bind:open={lengthOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="chip-trigger"
							type="button"
							aria-label="Change step length, currently {fuseLength} steps"
						>
							<!-- Ghost-sized to the widest value so the bar never shifts -->
							<span class="chip-sizer" aria-hidden="true">
								<span class="chip-value">32</span>
								<span class="chip-unit">steps <i class="fas fa-caret-up"></i></span>
							</span>
							<span class="chip-live">
								<span class="chip-value">{fuseLength}</span>
								<span class="chip-unit">steps <i class="fas fa-caret-up" aria-hidden="true"></i></span>
							</span>
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content side="top" align="center" sideOffset={12} collisionPadding={12} class="fuse-pop">
						<div class="length-options" role="radiogroup" aria-label="Step length">
							{#each LENGTHS as len}
								<button
									class="length-option"
									class:active={fuseLength === len}
									role="radio"
									aria-checked={fuseLength === len}
									onclick={() => selectLength(len)}
								>{len}</button>
							{/each}
						</div>
					</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{/snippet}

{#snippet bpmChip()}
	<Popover.Root bind:open={bpmOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="chip-trigger"
							type="button"
							aria-label="Set tempo, currently {fuseState.bpm} BPM"
						>
							<span class="chip-sizer" aria-hidden="true">
								<span class="chip-value">300</span>
								<span class="chip-unit">BPM <i class="fas fa-caret-up"></i></span>
							</span>
							<span class="chip-live">
								<span class="chip-value">{fuseState.bpm}</span>
								<span class="chip-unit">BPM <i class="fas fa-caret-up" aria-hidden="true"></i></span>
							</span>
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Portal>
					<Popover.Content side="top" align="center" sideOffset={12} collisionPadding={12} class="fuse-pop">
						<BpmQuickPopover
							bpm={fuseState.bpm}
							min={10}
							max={300}
							onBpmChange={(v) => fuseState.setBpm(v)}
							onClose={() => (bpmOpen = false)}
						/>
					</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
{/snippet}

{#snippet playBtn()}
	<button
		class="play-btn"
		onclick={() => fuseState.toggleClock()}
		aria-label={fuseState.clockRunning ? "Pause" : "Play"}
	>
		{#if fuseState.clockRunning}
			<svg viewBox="0 0 24 24" fill="currentColor">
				<path d="M6 4h4v16H6zm8 0h4v16h-4z" />
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="currentColor">
				<path d="M8 5v14l11-7z" />
			</svg>
		{/if}
	</button>
{/snippet}

<div class="fuse-layout" bind:clientWidth={layoutWidth}>
	{@render panels()}

	{#if compact}
		<!-- Phone: Fuse is THE hero action, settings are a quiet row below -->
		<div class="fuse-actions-compact">
			<button
				class="fuse-button fuse-hero"
				disabled={!canFuse}
				onclick={handleFuse}
			>
				<i class="fas fa-fire" aria-hidden="true"></i>
				<span>Fuse</span>
			</button>
			<div class="fuse-settings-row">
				{@render lengthChip()}
				{@render bpmChip()}
				{@render playBtn()}
			</div>
		</div>
	{:else}
		<!-- Desktop: floating pill dock — length | bpm | play | fuse -->
		<div class="fuse-bottom">
			{@render lengthChip()}
			{@render bpmChip()}
			{@render playBtn()}
			<button
				class="fuse-button"
				disabled={!canFuse}
				onclick={handleFuse}
			>
				<i class="fas fa-fire" aria-hidden="true"></i>
				<span>Fuse</span>
			</button>
		</div>
	{/if}
</div>

<style>
	/* Shared Fuse brand gradient — defined once, referenced by every fuse
	   accent surface here. */
	.fuse-layout {
		--fuse-gradient: linear-gradient(
			135deg,
			var(--fuse-accent-light, #fb923c) 0%,
			var(--fuse-accent, #f97316) 50%,
			var(--fuse-accent-deep, #ea580c) 100%
		);
	}

	.fuse-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		container-type: inline-size;
		container-name: fuse-layout;
		position: relative;
	}

	/* Panels always sit side by side - blue | red is the tab's identity.
	   Cells are capped and the pair centered, so panels stay proportioned on
	   ultrawide instead of leaving dead columns inside stretched boxes.
	   Below 700px each panel switches itself to animation-first (compact). */
	.fuse-panels {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 560px));
		justify-content: center;
		gap: var(--spacing-md, 16px);
		padding: var(--spacing-md, 16px) var(--spacing-md, 16px) var(--spacing-sm, 8px);
	}

	@container fuse-layout (max-width: 700px) {
		/* Bottom-anchor the cluster: panels sit right above the hero Fuse
		   button, in thumb reach. The void (if any) goes to the top. */
		.fuse-panels {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-auto-rows: min-content;
			align-content: end;
			gap: var(--spacing-sm, 8px);
			padding: var(--spacing-sm, 8px) var(--spacing-sm, 8px) var(--spacing-xs, 4px);
		}
	}

	/* ── Compact actions: hero Fuse + quiet settings row ────────── */

	.fuse-actions-compact {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-md, 16px) var(--spacing-md, 16px);
	}

	.fuse-hero {
		width: 100%;
		max-width: 420px;
		min-height: 56px;
		font-size: var(--font-size-md, 16px);
	}

	.fuse-settings-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
	}

	.fuse-panels > :global(*) {
		min-height: 0;
		min-width: 0;
	}

	/* ── Bottom bar: floating control dock ──────────────────────── */

	.fuse-bottom {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		width: fit-content;
		max-width: calc(100% - 2 * var(--spacing-sm, 8px));
		margin: var(--spacing-xs, 4px) auto var(--spacing-sm, 8px);
		padding: var(--spacing-sm, 8px) var(--spacing-sm, 8px);
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.7));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-radius: 999px;
		box-shadow:
			0 12px 32px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	@container fuse-layout (max-width: 480px) {
		.fuse-bottom {
			gap: var(--spacing-xs, 4px);
			padding: 6px;
		}
	}

	/* Length + BPM triggers share one chip shape. Ghost-sizer technique:
	   the widest possible value sits invisible under the live value so the
	   chip never changes width (no-layout-shift). */
	.chip-trigger {
		display: inline-grid;
		align-items: center;
		min-height: 48px;
		padding: 6px 16px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 999px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text, #ffffff);
		cursor: pointer;
		transition: border-color 150ms ease, background 150ms ease;
	}

	.chip-trigger:hover {
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		background: rgba(255, 255, 255, 0.07);
	}

	.chip-sizer,
	.chip-live {
		grid-area: 1 / 1;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 4px;
		white-space: nowrap;
	}

	.chip-sizer {
		visibility: hidden;
	}

	.chip-value {
		font-size: var(--font-size-sm, 14px);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.chip-unit {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.chip-unit i {
		font-size: 9px;
		opacity: 0.8;
	}

	/* Popover surface (portalled - needs :global). BpmQuickPopover brings its
	   own surface; the length options get one here. */
	:global(.fuse-pop) {
		z-index: var(--z-dropdown, 1000);
		transform-origin: bottom center;
	}

	:global(.fuse-pop[data-state="open"]) {
		animation: fuse-pop-in 170ms var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
	}

	@keyframes fuse-pop-in {
		from { opacity: 0; transform: translateY(8px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.length-options {
		display: flex;
		gap: 2px;
		padding: 4px;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
		border-radius: var(--radius-md, 8px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}

	.length-option {
		min-width: 44px;
		min-height: 44px;
		border: none;
		border-radius: var(--radius-sm, 6px);
		background: transparent;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
		font-size: var(--font-size-sm, 14px);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease;
	}

	.length-option:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.length-option.active {
		background: var(--theme-accent, #6366f1);
		color: #ffffff;
	}

	.play-btn {
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			var(--theme-accent, #3b82f6) 0%,
			color-mix(in srgb, var(--theme-accent, #3b82f6) 80%, black) 100%
		);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}

	.play-btn svg {
		width: 24px;
		height: 24px;
	}

	.play-btn:hover {
		transform: scale(1.05);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent);
	}

	.play-btn:active {
		transform: scale(0.98);
	}

	.fuse-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm, 8px);
		min-height: 48px;
		padding: var(--spacing-sm, 8px) var(--spacing-xl, 32px);
		border: none;
		border-radius: 999px;
		background: var(--fuse-gradient);
		color: #ffffff;
		font-size: var(--font-size-min, 14px);
		font-weight: 700;
		letter-spacing: 0.02em;
		cursor: pointer;
		box-shadow: 0 4px 20px color-mix(in srgb, var(--fuse-accent, #f97316) 30%, transparent);
		transition: box-shadow 0.15s ease, filter 0.15s ease, transform 0.1s ease;
	}

	@container fuse-layout (max-width: 480px) {
		.fuse-button {
			padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
		}
	}

	.fuse-button:hover:not(:disabled) {
		filter: brightness(1.08);
		box-shadow: 0 4px 28px color-mix(in srgb, var(--fuse-accent, #f97316) 45%, transparent);
	}

	.fuse-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.fuse-button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
		box-shadow: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-trigger,
		.play-btn,
		.fuse-button,
		.length-option {
			transition: none;
		}
		:global(.fuse-pop[data-state="open"]) {
			animation: none;
		}
	}
</style>
