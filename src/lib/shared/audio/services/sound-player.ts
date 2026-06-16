/**
 * Sound Player Implementation
 *
 * Uses Web Audio API for low-latency playback.
 * Falls back gracefully if audio is unavailable.
 *
 * Audio files should be placed in /static/sounds/
 * - pop.mp3
 * - chime.mp3
 * - whoosh.mp3
 * - fanfare.mp3
 * - error.mp3
 */

import type { SoundType } from "./types";

// Sound file paths (relative to /static/)
const SOUND_FILES: Record<SoundType, string> = {
	pop: '/sounds/pop.mp3',
	chime: '/sounds/chime.mp3',
	whoosh: '/sounds/whoosh.mp3',
	fanfare: '/sounds/fanfare.mp3',
	error: '/sounds/error.mp3'
};

export class SoundPlayer {
	private audioContext: AudioContext | null = null;
	private buffers: Map<SoundType, AudioBuffer> = new Map();
	private enabled = true;
	private volume = 0.5;
	private initialized = false;

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Create audio context (lazy, on user interaction)
			this.audioContext = new (window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

			// Preload all sounds in parallel
			const loadPromises = Object.entries(SOUND_FILES).map(async ([type, path]) => {
				try {
					const response = await fetch(path);
					if (!response.ok) {
						console.warn(`[SoundPlayer] Sound not found: ${path}`);
						return;
					}
					const arrayBuffer = await response.arrayBuffer();
					const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
					this.buffers.set(type as SoundType, audioBuffer);
				} catch (error) {
					// Silently fail for missing sounds - they're optional
					console.warn(`[SoundPlayer] Failed to load ${type}:`, error);
				}
			});

			await Promise.all(loadPromises);
			this.initialized = true;
		} catch (error) {
			// Audio not supported - fail gracefully
			console.warn('[SoundPlayer] Web Audio API not available:', error);
		}
	}

	play(sound: SoundType): void {
		if (!this.enabled || !this.audioContext || !this.initialized) return;

		const buffer = this.buffers.get(sound);
		if (!buffer) {
			// Sound not loaded - silently skip
			return;
		}

		try {
			// Resume context if suspended (browsers require user interaction).
			// resume() is async; route a rejection to the same graceful-degradation
			// path rather than letting it surface as an unhandled rejection.
			if (this.audioContext.state === 'suspended') {
				this.audioContext.resume().catch((error) => {
					console.warn(`[SoundPlayer] Failed to resume audio context:`, error);
				});
			}

			// Create buffer source
			const source = this.audioContext.createBufferSource();
			source.buffer = buffer;

			// Create gain node for volume control
			const gainNode = this.audioContext.createGain();
			gainNode.gain.value = this.volume;

			// Connect: source -> gain -> destination
			source.connect(gainNode);
			gainNode.connect(this.audioContext.destination);

			// Play
			source.start(0);
		} catch (error) {
			console.warn(`[SoundPlayer] Failed to play ${sound}:`, error);
		}
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	setVolume(volume: number): void {
		this.volume = Math.max(0, Math.min(1, volume));
	}

	dispose(): void {
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
		this.buffers.clear();
		this.initialized = false;
	}
}
