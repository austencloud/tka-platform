/**
 * DosSoundManager - PC speaker square-wave beeps via Web Audio API
 *
 * Emulates the single-channel piezoelectric speaker found in IBM PCs.
 * All sounds use square-wave oscillators with hard on/off transitions
 * (no gain envelope), exactly as a real PC speaker behaves: it can only
 * produce a square wave at a given frequency, toggled on or off.
 *
 * The AudioContext is lazy-initialized on the first audible call,
 * satisfying the browser autoplay policy (requires a user gesture).
 *
 * SSR-safe: all browser API access is guarded behind runtime checks.
 */

export class DosSoundManager {
	private ctx: AudioContext | null = null;
	private volume = 0.3;
	private muted = false;

	// ---------- public API ----------

	/** General confirmation beep. 800 Hz, 50ms. */
	beep(): void {
		this.playTone(800, 50);
	}

	/** Error/denied buzzer. 200 Hz, 200ms. */
	error(): void {
		this.playTone(200, 200);
	}

	/** Boot-complete fanfare. 400 -> 600 -> 800 Hz, 100ms each. */
	startup(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const step = 0.1; // 100ms per note

		this.scheduleSquare(ctx, 400, now, 100);
		this.scheduleSquare(ctx, 600, now + step, 100);
		this.scheduleSquare(ctx, 800, now + step * 2, 100);
	}

	/** Keystroke click. 1200 Hz, 10ms. */
	keyclick(): void {
		this.playTone(1200, 10);
	}

	/** Menu item selection. 600 Hz, 30ms. */
	menuSelect(): void {
		this.playTone(600, 30);
	}

	/** Access denied alarm. 300 -> 200 Hz, 150ms each. */
	accessDenied(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const step = 0.15; // 150ms per note

		this.scheduleSquare(ctx, 300, now, 150);
		this.scheduleSquare(ctx, 200, now + step, 150);
	}

	setVolume(level: number): void {
		this.volume = Math.max(0, Math.min(1, level));
	}

	getVolume(): number {
		return this.volume;
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
	}

	isMuted(): boolean {
		return this.muted;
	}

	// ---------- internals ----------

	/**
	 * Lazy-create the AudioContext. Returns null when running
	 * server-side or if the browser lacks Web Audio support.
	 */
	private ensureContext(): AudioContext | null {
		if (typeof window === "undefined") return null;

		if (!this.ctx) {
			const Ctor =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext;
			if (!Ctor) return null;
			this.ctx = new Ctor();
		}

		if (this.ctx.state === "suspended") {
			this.ctx.resume();
		}

		return this.ctx;
	}

	/** Convenience wrapper for single-tone sounds. */
	private playTone(frequency: number, durationMs: number): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		this.scheduleSquare(ctx, frequency, ctx.currentTime, durationMs);
	}

	/**
	 * Schedule a single square-wave tone with hard on/off.
	 *
	 * A real PC speaker has no volume control - it's either on or off.
	 * We approximate this with a constant gain that snaps to zero at
	 * the stop time, with no attack/release shaping.
	 */
	private scheduleSquare(
		ctx: AudioContext,
		frequency: number,
		startTime: number,
		durationMs: number,
	): void {
		const osc = ctx.createOscillator();
		const gainNode = ctx.createGain();

		osc.type = "square";
		osc.frequency.value = frequency;

		const end = startTime + durationMs / 1000;

		// Hard on/off: constant gain, then immediate zero
		gainNode.gain.setValueAtTime(this.volume, startTime);
		gainNode.gain.setValueAtTime(0, end);

		osc.connect(gainNode);
		gainNode.connect(ctx.destination);

		osc.start(startTime);
		osc.stop(end);

		osc.onended = () => {
			osc.disconnect();
			gainNode.disconnect();
		};
	}
}
