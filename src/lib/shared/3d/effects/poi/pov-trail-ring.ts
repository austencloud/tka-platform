/**
 * A single snapshot of all LED positions + colors at one moment in time.
 * Used to accumulate persistence-of-vision trail ghosts.
 */
export interface PovTrailSnapshot {
  /** Flat array of LED world positions: [x0, y0, z0, x1, y1, z1, ...] */
  positions: Float32Array;
  /** Flat array of LED colors: [r0, g0, b0, r1, g1, b1, ...] (0–255) */
  colors: Uint8Array;
  /** Time this snapshot was recorded (seconds) */
  timestamp: number;
}

/**
 * Ring buffer that stores recent LED position/color snapshots for
 * persistence-of-vision trail rendering. Each push stores the full
 * strip state (all 200 LEDs) at one frame.
 *
 * The oldest snapshot is overwritten when the buffer is full.
 */
export class PovTrailRing {
  private buffer: PovTrailSnapshot[];
  private head = 0;
  private _count = 0;
  readonly capacity: number;
  private readonly ledCount: number;

  constructor(ledCount: number, capacity: number) {
    this.ledCount = ledCount;
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    // Pre-allocate all snapshot slots to avoid GC pressure
    for (let i = 0; i < capacity; i++) {
      this.buffer[i] = {
        positions: new Float32Array(ledCount * 3),
        colors: new Uint8Array(ledCount * 3),
        timestamp: 0,
      };
    }
  }

  get count(): number {
    return this._count;
  }

  /**
   * Record a new snapshot. Copies the provided data into the ring buffer.
   */
  push(snapshot: PovTrailSnapshot): void {
    // Capacity 0 is the bulbs-only tier: nothing to remember.
    if (this.capacity <= 0) return;
    const slot = this.buffer[this.head]!;
    slot.positions.set(snapshot.positions);
    slot.colors.set(snapshot.colors);
    slot.timestamp = snapshot.timestamp;
    this.head = (this.head + 1) % this.capacity;
    if (this._count < this.capacity) this._count++;
  }

  /**
   * Get all stored snapshots in chronological order (oldest first).
   */
  getSnapshots(): PovTrailSnapshot[] {
    if (this._count === 0) return [];
    const result: PovTrailSnapshot[] = [];
    const start = this._count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx]!);
    }
    return result;
  }

  /**
   * Get only snapshots newer than a given timestamp (oldest first).
   */
  getSnapshotsNewerThan(minTimestamp: number): PovTrailSnapshot[] {
    return this.getSnapshots().filter((s) => s.timestamp >= minTimestamp);
  }

  clear(): void {
    this.head = 0;
    this._count = 0;
  }
}
