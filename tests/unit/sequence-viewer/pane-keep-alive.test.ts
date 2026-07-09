import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { createPaneKeepAliveHarness } from './pane-keep-alive-harness.svelte';

/**
 * Keep-alive visibility for the viewer's companion panes (Card / Videos /
 * Mandala / Tunnel in ViewerSplitPane).
 *
 * Regression under test: scanning a QR code on a phone whose last-used viewer
 * mode was Tunnel booted /q on the tunnel pane for one frame before the scan
 * page reset to the split view. The pane's reveal ran on requestAnimationFrame
 * and used to fire unconditionally — so the already-deselected tunnel pane
 * turned visible anyway and sat painted over the split view's animation pane
 * until the user toggled views by hand.
 */
describe('createPaneKeepAlive', () => {
	let rafQueue: FrameRequestCallback[] = [];

	beforeEach(() => {
		rafQueue = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function fireAnimationFrame() {
		const queue = rafQueue;
		rafQueue = [];
		for (const cb of queue) cb(0);
	}

	it('mounts hidden and reveals on the next animation frame', () => {
		const harness = createPaneKeepAliveHarness();
		expect(harness.pane.mounted).toBe(false);
		expect(harness.pane.shown).toBe(false);

		harness.setActive(true);
		flushSync();
		expect(harness.pane.mounted).toBe(true);
		expect(harness.pane.shown).toBe(false);

		fireAnimationFrame();
		expect(harness.pane.shown).toBe(true);

		harness.dispose();
	});

	it('does NOT reveal when the pane is deselected before the frame fires (QR-scan tunnel leak)', () => {
		const harness = createPaneKeepAliveHarness();

		// Boot lands on the persisted mode (e.g. Tunnel) for one render...
		harness.setActive(true);
		flushSync();
		expect(harness.pane.mounted).toBe(true);

		// ...then the /q scan host resets to the split view before the frame.
		harness.setActive(false);
		flushSync();

		fireAnimationFrame();
		expect(harness.pane.shown).toBe(false);
		// Keep-alive still holds: the pane stays mounted for instant re-entry.
		expect(harness.pane.mounted).toBe(true);

		harness.dispose();
	});

	it('re-activating an already-mounted pane shows it without waiting for a frame', () => {
		const harness = createPaneKeepAliveHarness();

		harness.setActive(true);
		flushSync();
		fireAnimationFrame();
		harness.setActive(false);
		flushSync();
		expect(harness.pane.shown).toBe(false);

		harness.setActive(true);
		flushSync();
		expect(harness.pane.shown).toBe(true);

		harness.dispose();
	});

	it('deselect-then-reselect before the frame still ends visible', () => {
		const harness = createPaneKeepAliveHarness();

		harness.setActive(true);
		flushSync();
		harness.setActive(false);
		flushSync();
		harness.setActive(true);
		flushSync();

		// The pane was mounted on the first activation, so the reselect takes the
		// direct path; the stale frame callback must not flip it back off either way.
		fireAnimationFrame();
		expect(harness.pane.shown).toBe(true);

		harness.dispose();
	});
});
