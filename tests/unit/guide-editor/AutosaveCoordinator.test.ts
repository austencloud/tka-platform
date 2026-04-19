import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutosaveCoordinator } from '../../../src/routes/(public)/guide/level-1/_lib/AutosaveCoordinator.svelte';

describe('AutosaveCoordinator', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts in idle state', () => {
		const c = new AutosaveCoordinator(async () => {}, 800);
		expect(c.status).toBe('idle');
		expect(c.lastSavedAt).toBeNull();
		expect(c.lastError).toBeNull();
	});

	it('debounces rapid edits, only saving once after debounce window', async () => {
		const save = vi.fn(async () => {});
		const c = new AutosaveCoordinator(save, 800);
		c.notifyEdit();
		c.notifyEdit();
		c.notifyEdit();
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(800);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('reports saving then saved status', async () => {
		const save = vi.fn(async () => {});
		const c = new AutosaveCoordinator(save, 100);
		c.notifyEdit();
		await vi.advanceTimersByTimeAsync(100);
		// Microtasks for save resolution
		await vi.runAllTimersAsync();
		expect(c.status).toBe('saved');
		expect(c.lastSavedAt).not.toBeNull();
	});

	it('reports error status when save throws', async () => {
		const save = vi.fn(async () => {
			throw new Error('disk full');
		});
		const c = new AutosaveCoordinator(save, 100);
		c.notifyEdit();
		await vi.advanceTimersByTimeAsync(100);
		await vi.runAllTimersAsync();
		expect(c.status).toBe('error');
		expect(c.lastError?.message).toBe('disk full');
	});

	it('flushes pending save immediately on flushNow()', async () => {
		const save = vi.fn(async () => {});
		const c = new AutosaveCoordinator(save, 800);
		c.notifyEdit();
		expect(save).not.toHaveBeenCalled();
		await c.flushNow();
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('serializes overlapping saves (does not run two at once)', async () => {
		let resolveFirst: (() => void) | null = null;
		const order: string[] = [];
		const save = vi.fn(() => {
			order.push('start');
			return new Promise<void>((resolve) => {
				if (!resolveFirst) {
					resolveFirst = () => {
						order.push('end-1');
						resolve();
					};
				} else {
					order.push('end-2');
					resolve();
				}
			});
		});
		const c = new AutosaveCoordinator(save, 50);
		c.notifyEdit();
		await vi.advanceTimersByTimeAsync(50);
		// First save running, not yet resolved.
		c.notifyEdit();
		await vi.advanceTimersByTimeAsync(50);
		// Second debounce fires; second save waits for first.
		expect(order).toEqual(['start']);
		resolveFirst!();
		await vi.runAllTimersAsync();
		expect(order).toEqual(['start', 'end-1', 'start', 'end-2']);
	});
});
