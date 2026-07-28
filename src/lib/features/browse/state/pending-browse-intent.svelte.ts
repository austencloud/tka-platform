/**
 * Pending Browse Intent
 *
 * A handoff INTO Browse from another module, expressed as intent rather than
 * as a URL. Browse is a keep-alive module panel: its gallery sub-screen lives
 * in component state and sessionStorage, and nothing in that path reads query
 * params — so a caller cannot say "open Browse showing X" by navigating to a
 * link. This is the seam that lets it, matching the existing
 * `pending-sequence.svelte.ts` pattern.
 *
 * The profile's Archive doorway is the first caller. It promises a count above
 * a button, so where that button lands is not cosmetic: the destination has to
 * hold the same pool the count was read from.
 *
 * Set the intent BEFORE switching modules. Browse consumes it reactively (not
 * in `onMount`) because it stays mounted across module switches, so a second
 * handoff would otherwise be silently dropped.
 */

/** Another creator's published work: the community gallery, OWNER-filtered. */
export type CreatorGalleryIntent = {
  kind: "creator-gallery";
  /** The engine's OWNER filter matches on `ownerDisplayName`, not on uid. */
  ownerName: string;
};

/** Your own library: Browse > Library > the All shelf, whose pool is
 *  `getSequences()` — the same call the profile Archive counts. */
export type OwnLibraryIntent = { kind: "own-library" };

/** One of the Library's three Art shelves (tunnels / 3D scenes / mandalas),
 *  which mount inside the Library detail pane rather than at a route. */
export type ArtShelfIntent = {
  kind: "art-shelf";
  /** An id from `MyCollectionsPanel`'s ART_DETAIL: art_tunnels | art_scenes |
   *  art_mandala. */
  shelfId: string;
  label: string;
};

export type BrowseIntent = CreatorGalleryIntent | OwnLibraryIntent | ArtShelfIntent;

let pending = $state<BrowseIntent | null>(null);

export function setPendingBrowseIntent(intent: BrowseIntent): void {
  pending = intent;
}

/** Reactive read that does NOT clear — for a consumer that wants to act inside
 *  an effect and clear on its own terms. */
export function peekPendingBrowseIntent(): BrowseIntent | null {
  return pending;
}

export function clearPendingBrowseIntent(): void {
  pending = null;
}
