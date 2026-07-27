import { collectionsState } from "./collections-state.svelte";

/**
 * collection-picker-state — the app-level opener for the collections picker.
 *
 * The picker used to be mounted inside ChoreoCardThumbnail, so the drawer was a
 * child of the very card it edits. Unticking the collection you were browsing
 * dropped the sequence from that collection's member list, the card unmounted,
 * and the drawer went with it — the user was thrown out mid-flow and couldn't
 * file the sequence anywhere else. Hoisting the sheet to a single always-mounted
 * host (CollectionPickerHost in MainApplication) makes the drawer outlive the
 * card, the same way the send-sequence sheet already outlives it.
 */
class CollectionPickerState {
	isOpen = $state(false);
	sequenceId = $state<string | null>(null);
	sequenceLabel = $state<string | undefined>(undefined);
	/**
	 * The collection the user is browsing when the picker was opened, if any.
	 * The picker marks that tile "Currently here" so unticking it reads as a
	 * deliberate removal rather than an unexplained disappearance.
	 */
	currentCollectionId = $state<string | null>(null);

	open(opts: {
		sequenceId: string;
		sequenceLabel?: string;
		currentCollectionId?: string | null;
	}): void {
		this.sequenceId = opts.sequenceId;
		this.sequenceLabel = opts.sequenceLabel;
		this.currentCollectionId = opts.currentCollectionId ?? null;
		// The picker reads membership straight off the live subscription, so it
		// has to be running before the first paint.
		collectionsState.ensureStarted();
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
		// Target ids stay put until the next open: clearing them here would blank
		// the sheet's contents mid-exit-transition.
	}
}

export const collectionPickerState = new CollectionPickerState();

/** Open the collections picker for a saved sequence. */
export function openCollectionPicker(opts: {
	sequenceId: string;
	sequenceLabel?: string;
	currentCollectionId?: string | null;
}): void {
	collectionPickerState.open(opts);
}
