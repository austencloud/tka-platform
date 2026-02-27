/**
 * IRetroSoundManager — Contract for 8-bit synthesized UI sounds
 *
 * Provides Web Audio API synthesized sound effects that evoke a
 * mid-90s operating system. All sounds are generated procedurally
 * from oscillators — no audio files needed.
 *
 * Domain: Retro Desktop Shell
 */

export interface IRetroSoundManager {
	/** Short 800Hz square wave click. 30ms, sharp attack/release. */
	click(): void;

	/** Two-tone descending buzz. 400Hz then 200Hz, 100ms each, square wave. */
	error(): void;

	/** 1000Hz sine chime with exponential decay. 150ms. */
	ding(): void;

	/** Ascending C-E-G chord (261.63 / 329.63 / 392 Hz). Sine wave, 150ms per note. */
	startup(): void;

	/** 440Hz square wave tone. 100ms. */
	beep(): void;

	/** Set master volume. Clamped to 0.0 - 1.0. */
	setVolume(level: number): void;

	/** Current master volume (0.0 - 1.0). */
	getVolume(): number;

	/** Mute or unmute all sounds without changing the volume setting. */
	setMuted(muted: boolean): void;

	/** Whether sound output is currently muted. */
	isMuted(): boolean;
}
