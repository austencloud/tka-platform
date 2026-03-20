<script lang="ts">
	/**
	 * Fuse Tab Root
	 *
	 * Owns its own state (does not participate in CreateModuleState).
	 * Creates the fuse state factory, sets context, and renders the
	 * appropriate view based on the current phase.
	 */

	import { container } from "$lib/shared/di";
	import { createFuseState } from "./state/fuse-state.svelte";
	import { setFuseContext } from "./context/fuse-context";
	import FuseLayout from "./components/FuseLayout.svelte";
	import FuseResultView from "./components/FuseResultView.svelte";

	let initError: string | null = $state(null);

	let state: ReturnType<typeof createFuseState> | null = $state(null);

	try {
		const sequenceFuser = container.items.sequenceFuser;
		state = createFuseState({ sequenceFuser });
		setFuseContext({ state });
	} catch (err) {
		console.error("[FuseTab] Failed to initialize:", err);
		initError = err instanceof Error ? err.message : String(err);
	}
</script>

{#if initError}
	<div class="fuse-error">
		<p>Fuse tab failed to load</p>
		<p class="error-detail">{initError}</p>
	</div>
{:else if state}
	{#if state.phase === "result"}
		<FuseResultView />
	{:else}
		<FuseLayout />
	{/if}
{:else}
	<div class="fuse-error">
		<p>Fuse tab initializing...</p>
	</div>
{/if}

<style>
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
