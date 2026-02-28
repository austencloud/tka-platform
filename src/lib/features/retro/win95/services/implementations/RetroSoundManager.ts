/**
 * RetroSoundManager — 8-bit synthesized UI sounds via Web Audio API
 *
 * Every sound is built from scratch using oscillators and gain nodes.
 * No audio files, no samples, no dependencies. The AudioContext is
 * lazy-initialized on the first call that actually plays sound, which
 * satisfies the browser autoplay policy (requires a user gesture to
 * start an AudioContext).
 *
 * SSR-safe: all browser API access is guarded behind runtime checks.
 */

import type { IRetroSoundManager } from "../contracts/IRetroSoundManager";

export class RetroSoundManager implements IRetroSoundManager {
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
		const noteDuration = 150;

		// C4 -> E4 -> G4
		const notes = [261.63, 329.63, 392.0] as const;

		for (const [i, frequency] of notes.entries()) {
			this.scheduleNote(ctx, {
				frequency,
				type: "sine",
				startTime: now + i * (noteDuration / 1000),
				durationMs: noteDuration,
				gain,
				envelope: "smooth",
			});
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
		if (this.ctx.state === "suspended") {
			this.ctx.resume();
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
