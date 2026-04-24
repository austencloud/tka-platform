<script lang="ts">
	/**
	 * Fuse Tab Root
	 *
	 * Owns its own state (does not participate in CreateModuleState).
	 * Creates the fuse state factory, sets context, and renders the
	 * appropriate view based on the current phase.
	 */

	import { onDestroy } from "svelte";
	import { fade } from "svelte/transition";
	import { getSequenceFuser } from "./getSequenceFuser";
	import { createFuseState } from "./state/fuse-state.svelte";
	import { setFuseContext } from "./context/fuse-context";
	import FuseLayout from "./components/FuseLayout.svelte";
	import FuseResultView from "./components/FuseResultView.svelte";

	function init(): { state: ReturnType<typeof createFuseState>; error: null } | { state: null; error: string } {
		try {
			const sequenceFuser = getSequenceFuser();
			const state = createFuseState({ sequenceFuser });
			setFuseContext({ state });
			return { state, error: null };
		} catch (err) {
			console.error("[FuseTab] Failed to initialize:", err);
			return { state: null, error: err instanceof Error ? err.message : String(err) };
		}
	}

	const { state: fuseState, error: initError } = init();

	onDestroy(() => {
		fuseState?.dispose();
	});
</script>

{#if initError}
	<div class="fuse-error">
		<p>Fuse tab failed to load</p>
		<p class="error-detail">{initError}</p>
	</div>
{:else if fuseState}
	{#if fuseState.phase === "result"}
		<div class="fuse-view" in:fade={{ duration: 300, delay: 150 }} out:fade={{ duration: 150 }}>
			<FuseResultView />
		</div>
	{:else}
		<div class="fuse-view" in:fade={{ duration: 300, delay: 150 }} out:fade={{ duration: 150 }}>
			<FuseLayout />
		</div>
	{/if}
{:else}
	<div class="fuse-error">
		<p>Fuse tab initializing...</p>
	</div>
{/if}

<style>
	.fuse-view {
		height: 100%;
		width: 100%;
	}

	.fuse-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 8px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-min, 14px);
		padding: var(--spacing-lg, 24px);
		text-align: center;
	}

	.error-detail {
		font-size: var(--font-size-compact, 12px);
		color: var(--semantic-error, #fca5a5);
		max-width: 400px;
		word-break: break-word;
	}
</style>
