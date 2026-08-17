// src/lib/features/lab/pronunciation-recorder/domain/sample-ring.ts
/**
 * Fixed-capacity sample ring with an absolute sample clock.
 *
 * Capture runs for the whole session, but a word is a span of it. Holding the
 * session as one buffer costs half a gigabyte; holding it as chunks puts a
 * decode between two words. A ring does neither: memory is flat, and every
 * sample keeps a monotonic index, so the boundary the detector reports is
 * directly the boundary the encoder cuts at.
 */
export class SampleRing {
  private readonly buffer: Float32Array;
  private written = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  /** Total samples ever written — the absolute clock. */
  get writtenSamples(): number {
    return this.written;
  }

  write(chunk: Float32Array): void {
    // A chunk longer than the ring can only leave its tail behind, and copying
    // the head first would leave the ring holding the wrong end of it.
    const from = Math.max(0, chunk.length - this.capacity);
    for (let index = from; index < chunk.length; index++) {
      this.buffer[(this.written + index) % this.capacity] = chunk[index] ?? 0;
    }
    this.written += chunk.length;
  }

  /**
   * Samples in `[fromAbsolute, toAbsolute)`, or null when the span is not
   * entirely present — either already overwritten or not yet recorded. Null is
   * the honest answer; returning a partial span would emit a truncated word
   * that looks complete.
   */
  read(fromAbsolute: number, toAbsolute: number): Float32Array | null {
    const oldest = Math.max(0, this.written - this.capacity);
    if (fromAbsolute < oldest || toAbsolute > this.written) return null;
    if (toAbsolute <= fromAbsolute) return new Float32Array(0);

    const out = new Float32Array(toAbsolute - fromAbsolute);
    for (let index = 0; index < out.length; index++) {
      out[index] = this.buffer[(fromAbsolute + index) % this.capacity] ?? 0;
    }
    return out;
  }
}
