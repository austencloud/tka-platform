// Debounced autosave coordinator. Wraps a user-provided async save
// function. Tracks status as reactive $state for UI binding.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SaveFn = () => Promise<void>;

export class AutosaveCoordinator {
	status: SaveStatus = $state('idle');
	lastSavedAt: number | null = $state(null);
	lastError: Error | null = $state(null);

	private readonly saveFn: SaveFn;
	private readonly debounceMs: number;
	private timer: ReturnType<typeof setTimeout> | null = null;
	// Serialized save chain. New saves attach to the tail so the network
	// only ever sees one in-flight PUT per coordinator. Always reads fresh
	// state inside `saveFn` because each link runs after the previous one
	// resolves.
	private tail: Promise<void> = Promise.resolve();

	constructor(saveFn: SaveFn, debounceMs: number) {
		this.saveFn = saveFn;
		this.debounceMs = debounceMs;
	}

	/**
	 * Signal that the underlying state changed. Schedules a debounced save.
	 * Multiple calls within debounceMs collapse to a single save.
	 */
	notifyEdit(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
		}
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.runSave();
		}, this.debounceMs);
	}

	/**
	 * Force any pending save to run now and return its promise. Resolves
	 * after the entire save chain (including this newly-enqueued save)
	 * settles. Useful for "save before navigate away" flows.
	 */
	async flushNow(): Promise<void> {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		await this.runSave();
	}

	private runSave(): Promise<void> {
		const next = this.tail.then(async () => {
			this.status = 'saving';
			this.lastError = null;
			try {
				await this.saveFn();
				this.status = 'saved';
				this.lastSavedAt = Date.now();
			} catch (err: unknown) {
				this.status = 'error';
				this.lastError = err instanceof Error ? err : new Error(String(err));
			}
		});
		// Swallow rejections on the chain itself so a single failure doesn't
		// poison the tail. saveFn errors are captured into status above.
		this.tail = next.catch(() => {});
		return next;
	}
}
