import type { PlaqueContent } from "../domain/archive-types";

export function createArchiveState() {
	let activePlaqueContent = $state<PlaqueContent | null>(null);
	let interactionTargetId = $state<string | null>(null);
	let isOverlayOpen = $state(false);

	return {
		get activePlaqueContent() {
			return activePlaqueContent;
		},
		get interactionTargetId() {
			return interactionTargetId;
		},
		get isOverlayOpen() {
			return isOverlayOpen;
		},

		setInteractionTarget(id: string | null) {
			interactionTargetId = id;
		},

		openPlaque(content: PlaqueContent) {
			activePlaqueContent = content;
			isOverlayOpen = true;
		},

		closePlaque() {
			isOverlayOpen = false;
			activePlaqueContent = null;
		},

		reset() {
			activePlaqueContent = null;
			interactionTargetId = null;
			isOverlayOpen = false;
		},
	};
}

export type ArchiveState = ReturnType<typeof createArchiveState>;
