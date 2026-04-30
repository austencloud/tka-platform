import { getContext, setContext } from "svelte";
import type { SoundscapePlayer } from "./soundscape-player.svelte";

const KEY = Symbol("museum-soundscape");

export function setSoundscapeContext(player: SoundscapePlayer): void {
	setContext(KEY, player);
}

export function getSoundscapeContext(): SoundscapePlayer {
	const player = getContext<SoundscapePlayer | undefined>(KEY);
	if (!player) {
		throw new Error(
			"getSoundscapeContext called outside MuseumModule - no soundscape player available.",
		);
	}
	return player;
}

export function getSoundscapeContextOptional(): SoundscapePlayer | null {
	return getContext<SoundscapePlayer | undefined>(KEY) ?? null;
}
