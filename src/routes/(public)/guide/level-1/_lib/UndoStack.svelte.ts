// In-memory snapshot undo stack. Generic over the snapshot type so it can
// hold a PageSidecar (or any other immutable state object). Each snapshot
// is a reference; the caller is responsible for ensuring snapshots are
// immutable (e.g., structuredClone before recording).

export class UndoStack<T> {
	private undoBuf: T[] = $state([]);
	private redoBuf: T[] = $state([]);
	private readonly maxSize: number;
	private current: T | undefined = undefined;

	constructor(maxSize: number) {
		if (!Number.isInteger(maxSize) || maxSize < 1) {
			throw new Error(`UndoStack maxSize must be a positive integer; got ${maxSize}`);
		}
		this.maxSize = maxSize;
	}

	get canUndo(): boolean {
		return this.undoBuf.length > 0;
	}

	get canRedo(): boolean {
		return this.redoBuf.length > 0;
	}

	/**
	 * Record a new snapshot. Becomes the "current" state. The previous
	 * current state is pushed onto the undo buffer. Redo buffer clears
	 * (any forward history is invalidated by a new edit).
	 */
	record(snapshot: T): void {
		if (this.current !== undefined) {
			this.undoBuf.push(this.current);
			while (this.undoBuf.length > this.maxSize) {
				this.undoBuf.shift();
			}
		}
		this.current = snapshot;
		this.redoBuf = [];
	}

	/**
	 * Pop the most recent snapshot from the undo buffer. The current state
	 * moves to the redo buffer. Returns undefined if no undo available.
	 */
	undo(): T | undefined {
		if (this.undoBuf.length === 0) return undefined;
		if (this.current !== undefined) {
			this.redoBuf.push(this.current);
		}
		this.current = this.undoBuf.pop();
		return this.current;
	}

	/**
	 * Pop from redo buffer back to current. Inverse of undo().
	 */
	redo(): T | undefined {
		if (this.redoBuf.length === 0) return undefined;
		if (this.current !== undefined) {
			this.undoBuf.push(this.current);
		}
		this.current = this.redoBuf.pop();
		return this.current;
	}

	clear(): void {
		this.undoBuf = [];
		this.redoBuf = [];
		this.current = undefined;
	}
}
