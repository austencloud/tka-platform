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
	private inFlight: Promise<void> | null = null;

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
	 * Force any pending save to run now and return its promise.
	 * Useful for "save before navigate away" flows.
	 */
	async flushNow(): Promise<void> {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		await this.runSave();
	}

	private async runSave(): Promise<void> {
		if (this.inFlight) {
			await this.inFlight;
		}
		this.status = 'saving';
		this.lastError = null;
		const promise = this.saveFn()
			.then(() => {
				this.status = 'saved';
				this.lastSavedAt = Date.now();
			})
			.catch((err: unknown) => {
				this.status = 'error';
				this.lastError = err instanceof Error ? err : new Error(String(err));
			})
			.finally(() => {
				this.inFlight = null;
			});
		this.inFlight = promise;
		await promise;
	}
}
