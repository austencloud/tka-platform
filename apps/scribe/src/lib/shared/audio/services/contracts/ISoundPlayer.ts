/**
 * Sound Player Interface
 *
 * Plays audio feedback for quiz interactions.
 * Respects user preferences and system mute state.
 */

export type SoundType = 'pop' | 'chime' | 'whoosh' | 'fanfare' | 'error';

export interface ISoundPlayer {
	/**
	 * Initialize the sound player (preload audio files).
	 * Call once when entering quiz mode.
	 */
	initialize(): Promise<void>;

	/**
	 * Play a sound effect.
	 * Does nothing if sounds are disabled or system is muted.
	 */
	play(sound: SoundType): void;

	/**
	 * Set whether sounds are enabled.
	 */
	setEnabled(enabled: boolean): void;

	/**
	 * Check if sounds are enabled.
	 */
	isEnabled(): boolean;

	/**
	 * Set volume (0-1).
	 */
	setVolume(volume: number): void;

	/**
	 * Clean up resources.
	 */
	dispose(): void;
}
