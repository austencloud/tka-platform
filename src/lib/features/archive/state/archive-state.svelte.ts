import type { PlaqueContent } from "../domain/archive-types";

export interface ArchiveState {
	readonly activePlaqueContent: PlaqueContent | null;
	readonly interactionTargetId: string | null;
	readonly isOverlayOpen: boolean;
	setInteractionTarget(id: string | null): void;
	openPlaque(content: PlaqueContent): void;
	closePlaque(): void;
	reset(): void;
}

export function createArchiveState(): ArchiveState {
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
