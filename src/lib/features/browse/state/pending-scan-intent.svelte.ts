/**
 * Pending Scan Intent
 *
 * One-shot handoff for "open the card scanner as soon as this collection
 * loads." Set when the app boots from a scan deep link
 * (/browse/collections/[id]?scan=1 — the QR a desktop shows so a phone can
 * take over scanning); consumed once by CollectionDetailView. One-shot so a
 * refresh or a later visit to the same collection doesn't reopen the scanner.
 */

let pendingScanCollectionId = $state<string | null>(null);

/** Stash a request to auto-open the scan sheet for a collection. */
export function setPendingScanIntent(collectionId: string): void {
	pendingScanCollectionId = collectionId;
}

/** Read and clear the pending scan intent. */
export function consumePendingScanIntent(): string | null {
	const id = pendingScanCollectionId;
	pendingScanCollectionId = null;
	return id;
}
