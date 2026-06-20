/**
 * RetroSoundManager - 8-bit synthesized UI sounds via Web Audio API
 *
 * Every sound is built from scratch using oscillators and gain nodes.
 * No audio files, no samples, no dependencies. The AudioContext is
 * lazy-initialized on the first call that actually plays sound, which
 * satisfies the browser autoplay policy (requires a user gesture to
 * start an AudioContext).
 *
 * SSR-safe: all browser API access is guarded behind runtime checks.
 */

export class RetroSoundManager {
	private ctx: AudioContext | null = null;
	private volume = 0.3;
	private muted = false;

	// ---------- public API ----------

	click(): void {
		this.playTone({
			frequency: 800,
			type: "square",
			durationMs: 30,
			envelope: "sharp",
		});
	}

	error(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		this.scheduleNote(ctx, {
			frequency: 400,
			type: "square",
			startTime: now,
			durationMs: 100,
			gain,
			envelope: "sharp",
		});

		this.scheduleNote(ctx, {
			frequency: 200,
			type: "square",
			startTime: now + 0.1,
			durationMs: 100,
			gain,
			envelope: "sharp",
		});
	}

	ding(): void {
		this.playTone({
			frequency: 1000,
			type: "sine",
			durationMs: 150,
			envelope: "decay",
		});
	}

	startup(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Classic Win95-style ascending chord: C4 → E4 → G4 → C5
		const notes: [number, number][] = [
			[262, 150],  // C4
			[330, 150],  // E4
			[392, 150],  // G4
			[523, 300],  // C5 - held longer at the top
		];

		let offset = 0;
		for (const [frequency, durationMs] of notes) {
			this.scheduleNote(ctx, {
				frequency,
				type: "sine",
				startTime: now + offset,
				durationMs,
				gain,
				envelope: "smooth",
			});
			offset += durationMs / 1000;
		}
	}

	beep(): void {
		this.playTone({
			frequency: 440,
			type: "square",
			durationMs: 100,
			envelope: "sharp",
		});
	}

	windowOpen(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Ascending two-note sine chord - airy, welcoming
		this.scheduleNote(ctx, {
			frequency: 400,
			type: "sine",
			startTime: now,
			durationMs: 50,
			gain,
			envelope: "smooth",
		});
		this.scheduleNote(ctx, {
			frequency: 600,
			type: "sine",
			startTime: now + 0.05,
			durationMs: 80,
			gain,
			envelope: "smooth",
		});
	}

	windowClose(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Descending two-note - closing, but not alarming
		this.scheduleNote(ctx, {
			frequency: 500,
			type: "sine",
			startTime: now,
			durationMs: 50,
			gain,
			envelope: "smooth",
		});
		this.scheduleNote(ctx, {
			frequency: 300,
			type: "sine",
			startTime: now + 0.05,
			durationMs: 80,
			gain,
			envelope: "smooth",
		});
	}

	minimize(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume * 0.7;

		// Short downward frequency sweep - like shrinking
		const osc = ctx.createOscillator();
		const gainNode = ctx.createGain();

		osc.type = "sine";
		osc.frequency.setValueAtTime(480, now);
		osc.frequency.exponentialRampToValueAtTime(240, now + 0.1);

		gainNode.gain.setValueAtTime(0.001, now);
		gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
		gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

		osc.connect(gainNode);
		gainNode.connect(ctx.destination);

		osc.start(now);
		osc.stop(now + 0.1);
		osc.onended = () => {
			osc.disconnect();
			gainNode.disconnect();
		};
	}

	maximize(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume * 0.7;

		// Short upward frequency sweep - like expanding
		const osc = ctx.createOscillator();
		const gainNode = ctx.createGain();

		osc.type = "sine";
		osc.frequency.setValueAtTime(240, now);
		osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);

		gainNode.gain.setValueAtTime(0.001, now);
		gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
		gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

		osc.connect(gainNode);
		gainNode.connect(ctx.destination);

		osc.start(now);
		osc.stop(now + 0.1);
		osc.onended = () => {
			osc.disconnect();
			gainNode.disconnect();
		};
	}

	menuOpen(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume * 0.5;

		// Soft pop - subtle, not distracting
		this.scheduleNote(ctx, {
			frequency: 660,
			type: "sine",
			startTime: now,
			durationMs: 40,
			gain,
			envelope: "decay",
		});
	}

	startMenu(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Iconic two-tone ascending chime - recognizable as "Start"
		this.scheduleNote(ctx, {
			frequency: 523,  // C5
			type: "sine",
			startTime: now,
			durationMs: 100,
			gain,
			envelope: "smooth",
		});
		this.scheduleNote(ctx, {
			frequency: 784,  // G5
			type: "sine",
			startTime: now + 0.08,
			durationMs: 150,
			gain,
			envelope: "smooth",
		});
	}

	floppySeek(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume * 0.6;

		// Six rapid clicks at irregular intervals - mechanical floppy drive
		const clickOffsets = [0, 0.06, 0.13, 0.185, 0.26, 0.32];
		const frequencies = [120, 180, 140, 160, 110, 150];

		for (let i = 0; i < clickOffsets.length; i++) {
			this.scheduleNote(ctx, {
				frequency: frequencies[i]!,
				type: "square",
				startTime: now + clickOffsets[i]!,
				durationMs: 20,
				gain,
				envelope: "sharp",
			});
		}
	}

	recycle(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Hollow thud - item dropped into bin
		// Low rumble followed by a short high knock
		this.scheduleNote(ctx, {
			frequency: 80,
			type: "sine",
			startTime: now,
			durationMs: 120,
			gain: gain * 0.8,
			envelope: "decay",
		});
		this.scheduleNote(ctx, {
			frequency: 440,
			type: "square",
			startTime: now + 0.04,
			durationMs: 30,
			gain: gain * 0.4,
			envelope: "sharp",
		});
	}

	loginSuccess(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Welcoming ascending arpeggio - A4, C#5, E5
		const notes: [number, number, number][] = [
			[440, 0,    100],  // A4
			[554, 0.09, 100],  // C#5
			[659, 0.18, 200],  // E5 - held
		];

		for (const [frequency, offset, durationMs] of notes) {
			this.scheduleNote(ctx, {
				frequency,
				type: "sine",
				startTime: now + offset,
				durationMs,
				gain,
				envelope: "smooth",
			});
		}
	}

	loginFail(): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		const now = ctx.currentTime;
		const gain = this.volume;

		// Harsh descending buzz - unmistakably wrong
		this.scheduleNote(ctx, {
			frequency: 320,
			type: "square",
			startTime: now,
			durationMs: 100,
			gain,
			envelope: "sharp",
		});
		this.scheduleNote(ctx, {
			frequency: 200,
			type: "square",
			startTime: now + 0.1,
			durationMs: 200,
			gain,
			envelope: "decay",
		});
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

		// Resume a suspended context (happens when created before a user gesture).
		// resume() rejects if the context is closing; swallow + log rather than
		// leak an unhandled rejection.
		if (this.ctx.state === "suspended") {
			this.ctx.resume().catch(console.warn);
		}

		return this.ctx;
	}

	/**
	 * Convenience wrapper for single-tone sounds.
	 */
	private playTone(opts: {
		frequency: number;
		type: OscillatorType;
		durationMs: number;
		envelope: NoteEnvelope;
	}): void {
		const ctx = this.ensureContext();
		if (!ctx || this.muted) return;

		this.scheduleNote(ctx, {
			frequency: opts.frequency,
			type: opts.type,
			startTime: ctx.currentTime,
			durationMs: opts.durationMs,
			gain: this.volume,
			envelope: opts.envelope,
		});
	}

	/**
	 * Core scheduling primitive. Creates an oscillator + gain pair,
	 * shapes the gain envelope, starts/stops at the requested times,
	 * and disconnects everything once the oscillator finishes.
	 */
	private scheduleNote(
		ctx: AudioContext,
		opts: {
			frequency: number;
			type: OscillatorType;
			startTime: number;
			durationMs: number;
			gain: number;
			envelope: NoteEnvelope;
		},
	): void {
		const osc = ctx.createOscillator();
		const gainNode = ctx.createGain();

		osc.type = opts.type;
		osc.frequency.value = opts.frequency;

		const start = opts.startTime;
		const durationSec = opts.durationMs / 1000;
		const end = start + durationSec;

		switch (opts.envelope) {
			case "sharp":
				gainNode.gain.setValueAtTime(opts.gain, start);
				gainNode.gain.setValueAtTime(0, end);
				break;

			case "decay":
				gainNode.gain.setValueAtTime(opts.gain, start);
				gainNode.gain.exponentialRampToValueAtTime(0.001, end);
				break;

			case "smooth": {
				const attack = durationSec * 0.1;
				const release = durationSec * 0.3;
				gainNode.gain.setValueAtTime(0.001, start);
				gainNode.gain.exponentialRampToValueAtTime(opts.gain, start + attack);
				gainNode.gain.setValueAtTime(opts.gain, end - release);
				gainNode.gain.exponentialRampToValueAtTime(0.001, end);
				break;
			}
		}

		osc.connect(gainNode);
		gainNode.connect(ctx.destination);

		osc.start(start);
		osc.stop(end);

		osc.onended = () => {
			osc.disconnect();
			gainNode.disconnect();
		};
	}
}

// ---------- internal types ----------

type NoteEnvelope = "sharp" | "decay" | "smooth";
