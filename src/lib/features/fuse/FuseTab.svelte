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

	const state = createFuseState({
		sequenceFuser: container.items.sequenceFuser,
	});

	setFuseContext({ state });
</script>

{#if state.phase === "result"}
	<FuseResultView />
{:else}
	<FuseLayout />
{/if}
