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
  sequenceIds = $state<string[]>([]);
  isBulk = $state(false);
  sequenceLabel = $state<string | undefined>(undefined);
  /**
   * The collection the user is browsing when the picker was opened, if any.
   * The picker marks that tile "Currently here" so unticking it reads as a
   * deliberate removal rather than an unexplained disappearance.
   */
  currentCollectionId = $state<string | null>(null);
  private onBulkComplete: (() => void) | undefined;

  open(opts: {
    sequenceId: string;
    sequenceLabel?: string;
    currentCollectionId?: string | null;
  }): void {
    this.sequenceIds = [opts.sequenceId];
    this.isBulk = false;
    this.sequenceLabel = opts.sequenceLabel;
    this.currentCollectionId = opts.currentCollectionId ?? null;
    this.onBulkComplete = undefined;
    this.finishOpen();
  }

  openBulk(opts: {
    sequenceIds: readonly string[];
    onComplete?: () => void;
  }): void {
    const uniqueIds = [...new Set(opts.sequenceIds)];
    if (uniqueIds.length === 0) return;
    this.sequenceIds = uniqueIds;
    this.isBulk = true;
    this.sequenceLabel = undefined;
    this.currentCollectionId = null;
    this.onBulkComplete = opts.onComplete;
    this.finishOpen();
  }

  private finishOpen(): void {
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

  completeBulk(): void {
    this.isOpen = false;
    const callback = this.onBulkComplete;
    this.onBulkComplete = undefined;
    callback?.();
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

/** Open the picker to add one gallery selection to a collection. */
export function openCollectionPickerForSequences(opts: {
  sequenceIds: readonly string[];
  onComplete?: () => void;
}): void {
  collectionPickerState.openBulk(opts);
}
