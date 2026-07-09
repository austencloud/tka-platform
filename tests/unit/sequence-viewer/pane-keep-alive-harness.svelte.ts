import { createPaneKeepAlive, type PaneKeepAlive } from '$lib/shared/sequence-viewer/components/pane-keep-alive.svelte';

/**
 * Runs createPaneKeepAlive inside a fresh effect root (the factory registers a
 * $effect, which needs a root to exist at call time) and exposes a writable
 * `active` flag standing in for "this pane is the selected split content".
 */
export function createPaneKeepAliveHarness(): {
	pane: PaneKeepAlive;
	setActive: (value: boolean) => void;
	dispose: () => void;
} {
	let active = $state(false);
	let pane!: PaneKeepAlive;
	const stop = $effect.root(() => {
		pane = createPaneKeepAlive(() => active);
	});
	return {
		pane,
		setActive: (value: boolean) => {
			active = value;
		},
		dispose: stop
	};
}
