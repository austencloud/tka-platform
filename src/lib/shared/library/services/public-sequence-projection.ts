/**
 * public-sequence-projection — the ONE builder for a `publicSequences/{id}`
 * document.
 *
 * Today the public mirror is a hand-written object literal inside
 * `public-index-syncer.ts:148-198`. Every field-loss bug in the public corpus
 * traces to that literal: a field nobody remembered to add there simply does not
 * exist on the wire, and the consumer that reads it silently falls back to a
 * default. Six such fields are live right now (see the ledger below). The
 * declared model even shipped a constructor for this exact job —
 * `createPublicSequenceIndex()` (`public-sequence-index.ts:161`) — with zero
 * call sites, which is precisely how the declared interface and the real writer
 * drifted apart.
 *
 * This module replaces the literal. It is the only sanctioned way to produce a
 * public document. Callers may not assemble public maps by hand.
 *
 * ## What it is not
 *
 * Pure. No Firestore, no network, no UI, no cache. It reads a
 * `NormalizedSequenceWrite` (already hydrated, word-validated, counted, and
 * hashed by `sequence-persistence-normalizer.ts`) plus an already-settled
 * context, and returns a plain object. Deterministic except for the single
 * timestamp the caller supplies. Safe to run before a transaction, inside one,
 * and from Admin/Node migration tooling.
 *
 * =========================================================================
 * FIELD-COVERAGE LEDGER
 * =========================================================================
 *
 * Two read paths exist, and they do not read the same fields. Deriving this
 * schema from the main gallery alone — the obvious approach — silently breaks
 * prop configuration on saved LOOPs, start-cell rendering, and the "already
 * saved" badge, and only when a user opens a public collection.
 *
 *   Path A — main Browse gallery:
 *     `mapPublicIndexToSequenceData` (`public-sequences-loader.ts:294-371`)
 *   Path B — public collection view:
 *     `batchFetchPublicSequences` (`collection-firestore-mapper.ts:180-221`),
 *     a raw `...data` spread validated by `LibrarySequenceDocSchema`
 *     (`library-schemas.ts:43-108`) and mapped by `mapDocToSequence`
 *
 * Ownership buckets (spec section 4):
 *   SRC  — sequence source. Rebuilt from the normalized sequence every time.
 *   PRO  — user profile. Refreshed from context.
 *   ENG  — public engagement. Preserved from `existing`, never reset here.
 *   PUB  — publication lifecycle. Set once, preserved on resync.
 *   WRT  — projection writer. Changes only with projection content.
 *
 * | Field | Bucket | Read by |
 * | --- | --- | --- |
 * | `id` | SRC | `public-sequences-loader.ts:268` (doc id), `collection-firestore-mapper.ts:196` |
 * | `sourceRef` | SRC | `public-sequences-loader.ts:276-283` (lazy full-doc fetch), `loop-labeler/services/sequence-loader.ts:33` |
 * | `ownerId` | SRC | `public-sequences-loader.ts:332`, `public-collection-loader.ts:126` (`where("ownerId","==")`), `loop-labeler/services/sequence-loader.ts:34` |
 * | `ownerDisplayName` | PRO | `public-sequences-loader.ts:333`, `feed-loader.ts:152` |
 * | `ownerAvatarUrl` | PRO | `public-sequences-loader.ts:334`, `feed-loader.ts:153` |
 * | `name` | SRC | `public-sequences-loader.ts:310,278`, `content-query-analyzer.ts:54` |
 * | `displayName` | SRC | `public-sequences-loader.ts:311` (via the ad-hoc cast at `:301-306`), `feed-loader.ts:150` |
 * | `intendedWord` | SRC | `browse-filter.ts:196` — **never written today; contains-letters search silently ignores intended-word matches** |
 * | `word` | SRC | `public-sequences-loader.ts:312`, `orderBy("word","asc")` at `:261` and `loop-labeler/services/sequence-loader.ts:24`, `content-query-analyzer.ts:55` |
 * | `thumbnails` | SRC | `public-sequences-loader.ts:314`, `feed-loader.ts:149`, `loop-labeler/services/sequence-loader.ts:42` |
 * | `sequenceLength` | SRC | `public-sequences-loader.ts:315`, `loop-labeler/services/sequence-loader.ts:43` |
 * | `difficultyLevel` | SRC | `public-sequences-loader.ts:316-317` |
 * | `level` | SRC | `public-sequences-loader.ts:316` |
 * | `gridMode` | SRC | `browse-filter.ts:459`, `loop-labeler/services/sequence-loader.ts:44` — **never written today; the Grid Mode filter is dead for every gallery sequence** |
 * | `reversalPattern` | SRC | `browse-filter.ts:654` — **never written today; the reversal filter cannot differentiate, everything defaults to `continuous`** |
 * | `isCircular` | SRC | `public-sequences-loader.ts:323`, `loop-labeler/services/sequence-loader.ts:40` |
 * | `loopType` | SRC | `public-sequences-loader.ts:318`, `loop-labeler/services/sequence-loader.ts:41` |
 * | `period` | SRC | `public-sequences-loader.ts:319`, `loop-display-resolver.ts:307` |
 * | `components` | SRC | `public-sequences-loader.ts:320` -> `loop-display-resolver.ts:295-298` |
 * | `componentDomains` | SRC | `public-sequences-loader.ts:321` -> `loop-display-resolver.ts:301` — **never written today; LOOP component-domain display always falls back to `location`** |
 * | `loopSpec` | SRC | `loop-display-resolver.ts:203-229` (spec-driven branch, preferred over `components`) |
 * | `tags` | SRC | `public-sequences-loader.ts:324`, `feed-loader.ts:160` |
 * | `isForked` | SRC | `public-sequences-loader.ts:344` |
 * | `originalCreatorId` | SRC | `public-sequences-loader.ts:347` |
 * | `originalCreatorName` | SRC | `public-sequences-loader.ts:348` |
 * | `contentHash` | SRC | path B only (`library-schemas.ts:74`); `where("contentHash","==")` dedup at `public-index-syncer.ts:111`. Path A drops it. |
 * | `contentHashVersion` | SRC | path B only (`library-schemas.ts:76`). Validated, never branched on — kept so the public (hash, version) pair cannot diverge from the owner doc. |
 * | `encoderHash` | SRC | `where("encoderHash","==")` in `public-sequence-hash-matcher.ts:36`. Dormant (its only caller has no call sites), but the hash-claim work depends on the same basis. |
 * | `blueSoloProp` | SRC | `public-sequences-loader.ts:336,355` (hydration input) |
 * | `redSoloProp` | SRC | `public-sequences-loader.ts:337,355` |
 * | `stepPairings` | SRC | `public-sequences-loader.ts:338,355` |
 * | `bluePathHash` | SRC | `public-sequences-loader.ts:339` |
 * | `redPathHash` | SRC | `public-sequences-loader.ts:340` |
 * | `blueSoloHash` | SRC | `public-sequences-loader.ts:341` |
 * | `redSoloHash` | SRC | `public-sequences-loader.ts:342` |
 * | `startPosition` | SRC | path B only (passthrough -> `mapDocToSequence` -> `hydrate`). Not derivable from the compositional fields; dropping it is what emptied start cells in the 2026-06 corpus. |
 * | `creatorIntent` | SRC | path B only (passthrough). Drives prop config on saved LOOPs. |
 * | `animatedSequenceUrl` | SRC | `feed-loader.ts:105,107,141,148` — **never written today; the Watch feed's animation-versus-pictograph split can never fire, every public sequence resolves to `pictograph`** |
 * | `animationFormat` | SRC | companion to `animatedSequenceUrl`; the URL is ambiguous without it |
 * | `birthday` | SRC | `public-sequences-loader.ts:328-329`, `mapDocToSequence` (card footer calls `.getFullYear()`) |
 * | `forkCount` | ENG | path B only (`library-schemas.ts:68`) |
 * | `viewCount` | ENG | path B only (`library-schemas.ts:69`) |
 * | `starCount` | ENG | path B only (`library-schemas.ts:70`) |
 * | `publicPerformanceCount` | ENG | server-reconciled public-video discovery count |
 * | `latestPublicPerformanceAt` | ENG | server-reconciled newest public-video timestamp |
 * | `publishedAt` | PUB | `public-sequences-loader.ts:328` (fallback when `birthday` is absent) |
 * | `updatedAt` | WRT | `public-sequences-loader.ts:330` |
 * | `publicProjectionRevision` | WRT | new — pairs with the owner doc's copy |
 * | `publicProjectionSchemaVersion` | WRT | new — Browse accepts only schema 2 after the compatibility window |
 * | `publicProjectionDigest` | WRT | new — self-containment / drift detection |
 *
 * ### Consumed but deliberately NOT produced
 *
 * `views`, `creatorName`, `creatorId` (`content-query-analyzer.ts:56,58,59`)
 * are ghost fields. Nothing has ever written them, so the admin "top sequences
 * by views" panel and its `orderBy("views","desc")` (`:40`) are non-functional. They are
 * misspellings of `viewCount`, `ownerDisplayName`, and `ownerId`, all of which
 * this projection does write. Adding the ghosts would enshrine the typo; the
 * analyzer is what needs fixing.
 *
 * ### Deliberately excluded from the public document
 *
 * | Field | Why |
 * | --- | --- |
 * | `notes` | Private. User-authored tagline/notes, never public. |
 * | `performanceVideoUrl`, `performanceVideoPath`, `animatedSequencePath` | Private storage paths. `animatedSequenceUrl` is the one public render URL; the `*Path` fields exist only so the owner can delete the object. |
 * | `metadata` | Extensible bag (`sequence-data.ts:130-132`). The spec forbids copying it; an allowlisted typed shape would be the alternative, and nothing needs one — no consumer anywhere reads `metadata.pathShape` or `metadata.wallFeasibility` off a sequence, and path A already hardcodes `metadata: {}` (`public-sequences-loader.ts:325`). |
 * | `steps` | Derived on read from the compositional fields; never persisted anywhere (`sequence-data.ts:48-50`). |
 * | `startingPosition`, `startingPositionGroup` | Dead legacy aliases of `startPosition`. |
 * | `syncStatus`, `pendingSyncMetadata` | Dexie-local sync bookkeeping (`sequence-data.ts:203-227`). The normalizer already strips them. |
 * | `visibility`, `isDeleted`, `deletedAt`, `_version`, `collectionIds`, `tagIds`, `sequenceTags` | Owner-document bookkeeping. A public document's existence IS its visibility (invariants 2 and 3); mirroring the flag invites the two to disagree. `tags` carries resolved tag NAMES for filtering; raw ids are meaningless to another user. |
 * | `effortTimeline`, `intendedProp` | Superseded by `creatorIntent`, which is projected. |
 * | `isFavorite` | Per-viewer state, not a property of the sequence (`sequence-data.ts:75-78`). |
 * | `canonicalSignature`, `canonicalOffset`, `canonicalHandPath`, `canonicalWord` | Offline equivalence-analysis fields. No public consumer; the four cross-tier hashes cover public equivalence queries. |
 * | `author`, `timeSignature`, `orientationCycleCount`, `dateAdded`, `lastAccessedAt`, `createdAt` | No public consumer. `orientationCycleCount` is deprecated in favour of `period`; `birthday` carries the public creation date and already falls back to `createdAt`. |
 */

import type { FieldValue, Timestamp } from "firebase/firestore";

import { canonicalDigest } from "$lib/shared/foundation/utils/canonical-digest";
import { getUserSequencePath } from "$lib/shared/library/data/firestore-paths";
import { PUBLIC_PROJECTION_SCHEMA_VERSION } from "$lib/shared/foundation/domain/models/public-sequence-wire-schema";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import type { NormalizedSequenceWrite } from "$lib/shared/library/services/sequence-persistence-normalizer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Wire-format version of a public document. Declared ONCE, in
 * `public-sequence-wire-schema.ts` (the reader side must agree with the writer
 * by construction, not by parallel constants); re-exported here so writer-side
 * callers need only this module.
 *
 * 2 = self-contained projection (this builder). 1 / absent = a legacy document
 * written by the hand-built literal in `public-index-syncer.ts`, which may be
 * missing any of the fields marked "never written today" in the ledger above.
 * After the corpus migration and compatibility window, Browse accepts only
 * schema 2.
 */
export { PUBLIC_PROJECTION_SCHEMA_VERSION };

/**
 * Preview thumbnails carried on the public document.
 *
 * Matches the `.slice(0, 3)` the syncer applies today at
 * `public-index-syncer.ts:157` and `:284`. Named here because the projection is
 * now the only place that decides it.
 */
export const PUBLIC_THUMBNAIL_LIMIT = 3;

/**
 * Fields the projection digest does NOT cover, and why each one is out.
 *
 * The digest answers one question: "has the projected CONTENT changed?" So it
 * covers every source-owned and profile-owned field, and nothing else.
 *
 * - `forkCount`, `viewCount`, `starCount` — engagement bucket. A star must not
 *   look like a content edit, or every counter operation forces a projection
 *   revision (spec section 4).
 * - `publicPerformanceCount`, `latestPublicPerformanceAt` — server-owned
 *   discovery metadata. A video event must not masquerade as a sequence edit.
 * - `publishedAt`, `updatedAt`, `birthday` — timestamps. Excluded by the spec,
 *   and independently unusable: `canonicalJSON` emits `{}` for `Date`,
 *   Firestore `Timestamp`, and `FieldValue` alike (see `canonical-digest.ts`),
 *   so including them would silently contribute nothing while looking covered.
 * - `publicProjectionRevision`, `publicProjectionDigest` — writer bucket; the
 *   digest cannot contain itself.
 * - `blueSoloProp`, `redSoloProp`, `stepPairings` — NOT because they are
 *   unimportant, but because they are not stable across normalization passes:
 *   `ensureComposition` rebuilds them through `solo-prop-factory.ts:39`, which
 *   mints a fresh `crypto.randomUUID()` for each solo prop and hand path on
 *   every call. Digesting them would produce a new digest on every republish of
 *   unchanged content, which makes "a notes-only edit must not bump the
 *   revision" unsatisfiable. Their CONTENT identity is digested — via
 *   `blueSoloHash`, `redSoloHash`, `bluePathHash`, `redPathHash`, and
 *   `contentHash`, all of which are computed from the same data and are stable
 *   (proven in `sequence-persistence-normalizer.test.ts`).
 */
export const PROJECTION_DIGEST_EXCLUDED_KEYS = [
  "forkCount",
  "viewCount",
  "starCount",
  "publicPerformanceCount",
  "latestPublicPerformanceAt",
  "publishedAt",
  "updatedAt",
  "birthday",
  "publicProjectionRevision",
  "publicProjectionDigest",
  "blueSoloProp",
  "redSoloProp",
  "stepPairings",
] as const;

/**
 * Recompute the projection digest from a STORED schema-2 document.
 *
 * Digest parity with the builder holds because a schema-2 document is written
 * by `buildPublicSequenceProjection` via a full `setDoc` — its keys are exactly
 * the projection's keys, minus optionals that were absent (which the builder
 * also omitted from its digest input). Every excluded key is dropped here the
 * same way the builder never digested it, and every timestamp is excluded, so
 * the Firestore `Timestamp`-serializes-to-`{}` trap (see `canonical-digest.ts`)
 * cannot fire.
 *
 * NOT valid for legacy (pre-schema-2) documents: they carry hand-literal key
 * sets that never matched the projection, so a digest over them describes
 * nothing. Callers must check `publicProjectionSchemaVersion` first.
 *
 * Used by the narrow thumbnail transaction (patch a field, restamp the digest
 * without re-normalizing the whole sequence) and by the parity audit (compare
 * stored digest against recomputed digest to detect out-of-band edits).
 */
export async function computeStoredProjectionDigest(
  document: Record<string, unknown>
): Promise<string> {
  const excluded = new Set<string>(PROJECTION_DIGEST_EXCLUDED_KEYS);
  const digestable: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (!excluded.has(key) && value !== undefined) {
      digestable[key] = value;
    }
  }
  return canonicalDigest(digestable);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Any value a caller may hand the builder for a timestamp field.
 *
 * The builder never inspects one — it only decides WHICH timestamp a field
 * gets. A repository passes `serverTimestamp()`; migration tooling passes a
 * real `Date` or a `Timestamp` read straight off a document. The
 * `firebase/firestore` import is type-only, so it is erased at compile time and
 * this module stays loadable from plain Node (`npx tsx scripts/migrations/*`).
 */
export type PublicProjectionTimestamp = Date | Timestamp | FieldValue;

/**
 * The sequence shape a projection can be built from.
 *
 * `SequenceData` plus the four `LibrarySequence` fields the public document
 * needs, all optional. A `NormalizedSequenceWrite<LibrarySequence>` (the
 * repository's case) satisfies this, and so does a normalization of a bare
 * `SequenceData` read out of a raw document by migration tooling.
 */
export type ProjectionSourceSequence = SequenceData &
  Partial<
    Pick<
      LibrarySequence,
      "source" | "forkAttribution" | "forkCount" | "viewCount" | "starCount"
    >
  >;

/** LOOP data, already detected. The builder does not detect anything itself. */
export interface PublicProjectionLoopData {
  readonly isCircular: boolean;
  readonly loopType: string | null;
  readonly period?: number;
  readonly components?: SequenceData["components"];
  readonly componentDomains?: SequenceData["componentDomains"];
  readonly loopSpec?: SequenceData["loopSpec"];
}

/**
 * Everything the projection needs that is NOT on the sequence itself: resolved
 * profile data, resolved tag names, a computed encoder hash, detected LOOP
 * data, and calculated difficulty.
 *
 * Every field is settled before the builder runs. There is no optional
 * "we couldn't work it out" state: an untagged sequence resolves to an empty
 * `tagNames`, and a FAILED tag read is a different thing entirely — it must stop
 * the caller, not arrive here as an empty list (spec section 5).
 */
export interface PublicProjectionContext {
  /**
   * The publishing user.
   *
   * Deliberately NOT read off the sequence. `public-index-syncer.ts:150-151`
   * builds both `ownerId` and `sourceRef` from the authenticated caller, and a
   * forked sequence can still be carrying the original creator's id. A bare
   * `SequenceData` may have no `ownerId` at all.
   *
   * (Not in the spec's interface sketch; the sketch has no source for it.)
   */
  readonly ownerId: string;
  readonly ownerDisplayName: string;
  readonly ownerAvatarUrl?: string;
  /** Resolved tag NAMES, not ids. Empty means untagged, never "lookup failed". */
  readonly tagNames: readonly string[];
  /** SHA-256 of the encoder output, for URL-to-library matching. */
  readonly encoderHash: string;
  readonly loop: PublicProjectionLoopData;
  readonly difficultyLevel?: string;
  readonly level?: number;
  /**
   * The single timestamp this write stamps. `serverTimestamp()` from a
   * repository, a real `Date` from migration tooling.
   *
   * (Not in the spec's interface sketch. The spec says the builder is
   * "deterministic except for timestamps supplied by the writer" but gives the
   * timestamps no way in, while also requiring the builder to own the
   * set-once-then-preserve rule for `publishedAt`. It needs a value to set.)
   */
  readonly now: PublicProjectionTimestamp;
}

/**
 * The fields of an EXISTING public document that a refresh must not clobber.
 *
 * Read the current public document and pass what it holds (wrapped in a
 * `{ kind: "existing", fields }` {@link PublicProjectionPriorState}); the
 * projection preserves it. First publications assert
 * `{ kind: "first-publication" }` instead — there is no implicit default.
 */
export interface ExistingPublicOwnedFields {
  /**
   * Publication lifecycle. Set once, preserved forever after.
   *
   * `public-index-syncer.ts:174` sets `publishedAt: serverTimestamp()` in the
   * literal UNCONDITIONALLY and writes it with a full `setDoc`, so every
   * republish has already destroyed the original publication time corpus-wide.
   * That defect must not survive this builder.
   *
   * Widened from the spec's `Timestamp` so migration tooling can reconstruct a
   * lost value from the owner document's `birthday`/`createdAt`, which are
   * `Date`s.
   */
  readonly publishedAt?: PublicProjectionTimestamp;
  readonly forkCount?: number;
  readonly viewCount?: number;
  readonly starCount?: number;
  readonly publicPerformanceCount?: number;
  readonly latestPublicPerformanceAt?: PublicProjectionTimestamp;
  /**
   * The stored digest, revision, and update time.
   *
   * (Not in the spec's interface sketch.) Supplying them is what makes the
   * projection idempotent: when the recomputed digest matches the stored one,
   * nothing about the content changed, so `updatedAt` and
   * `publicProjectionRevision` carry forward unchanged and the whole document
   * is byte-identical to what is already stored. That is the ownership table's
   * "change only with projection content" and the spec's "a notes-only update
   * must not force a public projection revision", enforced by the builder
   * instead of trusted to each caller.
   */
  readonly updatedAt?: PublicProjectionTimestamp;
  readonly publicProjectionRevision?: number;
  readonly publicProjectionDigest?: string;
}

/**
 * A complete `publicSequences/{id}` document, as WRITTEN.
 *
 * Self-contained by construction: everything Browse, the sequence viewer, the
 * public collection view, the Watch feed, and the offline cache read is here.
 * `sourceRef` is provenance, not a rendering dependency.
 *
 * Deliberately distinct from `PublicSequenceProjection` in
 * `public-sequence-wire-schema.ts`: that is the READ-side application model
 * (dates already converted to `Date`), this is the write shape (timestamps may
 * still be `serverTimestamp()` sentinels). One name per side; do not merge them
 * — a `FieldValue` must never appear in reader code, and a converted `Date`
 * must never be mistaken for what a writer sends.
 */
export interface PublicSequenceProjectionWrite {
  // --- identity ---
  readonly id: string;
  readonly sourceRef: string;
  readonly ownerId: string;

  // --- owner projection (PRO) ---
  readonly ownerDisplayName: string;
  readonly ownerAvatarUrl?: string;

  // --- presentation ---
  readonly name: string;
  readonly displayName?: string;
  readonly intendedWord?: string;
  /** The exact word: one notation token per beat. Never a name or auto-title. */
  readonly word: string;
  readonly thumbnails: readonly string[];

  // --- canonical count and difficulty ---
  readonly sequenceLength: number;
  readonly difficultyLevel?: string;
  readonly level?: number;

  // --- browse filters ---
  readonly gridMode?: SequenceData["gridMode"];
  readonly reversalPattern?: string;

  // --- LOOP metadata ---
  readonly isCircular: boolean;
  readonly loopType: string | null;
  readonly period?: number;
  readonly components?: SequenceData["components"];
  readonly componentDomains?: SequenceData["componentDomains"];
  readonly loopSpec?: SequenceData["loopSpec"];

  // --- categorization ---
  readonly tags: readonly string[];

  // --- fork attribution ---
  readonly isForked: boolean;
  readonly originalCreatorId?: string;
  readonly originalCreatorName?: string;

  // --- identity hashes ---
  readonly contentHash: string;
  readonly contentHashVersion: number;
  readonly encoderHash: string;

  // --- compositional data (self-contained rendering) ---
  readonly blueSoloProp?: SequenceData["blueSoloProp"];
  readonly redSoloProp?: SequenceData["redSoloProp"];
  readonly stepPairings?: SequenceData["stepPairings"];
  readonly bluePathHash?: string;
  readonly redPathHash?: string;
  readonly blueSoloHash?: string;
  readonly redSoloHash?: string;
  readonly startPosition?: SequenceData["startPosition"];

  // --- creator intent ---
  readonly creatorIntent?: NonNullable<SequenceData["creatorIntent"]>;

  // --- media ---
  readonly animatedSequenceUrl?: string;
  readonly animationFormat?: SequenceData["animationFormat"];

  // --- engagement (ENG) ---
  readonly forkCount: number;
  readonly viewCount: number;
  readonly starCount: number;
  readonly publicPerformanceCount: number;
  readonly latestPublicPerformanceAt?: PublicProjectionTimestamp;

  // --- timestamps ---
  readonly birthday?: PublicProjectionTimestamp;
  /** Publication lifecycle (PUB). Set once, preserved on every resync. */
  readonly publishedAt: PublicProjectionTimestamp;

  // --- projection writer (WRT) ---
  readonly updatedAt: PublicProjectionTimestamp;
  readonly publicProjectionRevision: number;
  readonly publicProjectionSchemaVersion: number;
  readonly publicProjectionDigest: string;
}

/**
 * The spec (section 3) names the builder's return type
 * `PublicSequenceIndexWriteData`. That name has never existed in the codebase —
 * `grep -rn "PublicSequenceIndexWriteData" src/` returns nothing. Kept as an
 * alias so a reader following the spec finds the type, matching the
 * `LibrarySequenceWriteData` precedent in `sequence-persistence-normalizer.ts`.
 */
export type PublicSequenceIndexWriteData = PublicSequenceProjectionWrite;

/** Everything the digest covers: the projection minus the excluded buckets. */
type DigestedProjection = Omit<
  PublicSequenceProjectionWrite,
  (typeof PROJECTION_DIGEST_EXCLUDED_KEYS)[number]
>;

/**
 * What the caller knows about the CURRENT public document, stated explicitly.
 *
 * This is deliberately not an optional `existing?` parameter. With an optional,
 * a caller whose read of the public document FAILED (offline, permission,
 * transient) could fall through to `undefined` and the builder would treat the
 * failure as a first publication — resetting the engagement counters and
 * re-stamping `publishedAt`, which is the exact corpus-wide defect
 * (`public-index-syncer.ts:174`) this builder exists to end. The discriminant
 * forces the caller to assert which world it is in:
 *
 * - `first-publication` — the caller VERIFIED no public document exists
 *   (a completed read returned nothing). Never the answer to a failed read.
 * - `existing` — the current document was read; its public-owned fields are
 *   passed through so the builder can preserve them.
 *
 * A failed read has no representation here on purpose: abort the write and
 * surface the error. There is no safe projection to build without knowing
 * which world you are in.
 */
export type PublicProjectionPriorState =
  | { readonly kind: "first-publication" }
  | { readonly kind: "existing"; readonly fields: ExistingPublicOwnedFields };

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build the public document for a normalized sequence.
 *
 * Deterministic except for `context.now`: the same normalized sequence, the
 * same context, and the same `existing` always produce the same document, and
 * always the same `publicProjectionDigest`.
 *
 * The ownership split is enforced here rather than left to callers:
 *
 * - SRC / PRO fields are rebuilt on every call. A field that drifted on the
 *   public document is repaired by the next projection, unconditionally.
 * - ENG counters come from the existing document first. Only on a first
 *   publication do they fall back to the owner document's counts (what the
 *   syncer does today), then to 0.
 * - `publishedAt` comes from the existing document if it has one, otherwise
 *   `context.now`. It is never re-stamped.
 * - `updatedAt` and `publicProjectionRevision` move only when the digest moves.
 *
 * `prior` is a required discriminant, not an optional — see
 * {@link PublicProjectionPriorState} for why a failed read must never reach
 * this function.
 *
 * No `undefined` value ever reaches the returned object — every optional field
 * is added by a conditional spread, never assigned `undefined`. That is required
 * twice over: Firestore rejects `undefined`, and `canonicalJSON` serializes an
 * explicit `undefined` as `null` rather than omitting the key, so a digest
 * computed over an object carrying `undefined` would not survive a round trip
 * (see `canonical-digest.ts`).
 */
export async function buildPublicSequenceProjection(
  normalized: NormalizedSequenceWrite<ProjectionSourceSequence>,
  context: PublicProjectionContext,
  revision: number,
  prior: PublicProjectionPriorState
): Promise<PublicSequenceProjectionWrite> {
  const source = normalized.ownerData;
  const { loop } = context;
  const existing = prior.kind === "existing" ? prior.fields : undefined;

  // Everything the digest covers, built first so the digest is computed from
  // the document itself rather than from a hand-maintained parallel field list.
  // A field added to the projection is covered by the digest automatically; the
  // only way out is an explicit entry in PROJECTION_DIGEST_EXCLUDED_KEYS.
  const digested: DigestedProjection = {
    // identity
    id: source.id,
    sourceRef: getUserSequencePath(context.ownerId, source.id),
    ownerId: context.ownerId,

    // owner projection
    ownerDisplayName: context.ownerDisplayName,
    ...(context.ownerAvatarUrl !== undefined && {
      ownerAvatarUrl: context.ownerAvatarUrl,
    }),

    // presentation
    name: source.name,
    ...(source.displayName !== undefined && {
      displayName: source.displayName,
    }),
    ...(source.intendedWord !== undefined && {
      intendedWord: source.intendedWord,
    }),
    // The exact word from strict derivation. NOT `source.word`, and never a
    // name or auto-title — `library-repository.ts:708`'s
    // `word: sequence.word || metadata.name` is how "Assemble Sequence" became
    // a stored word.
    word: normalized.exactWord,
    thumbnails: (source.thumbnails ?? []).slice(0, PUBLIC_THUMBNAIL_LIMIT),

    // canonical count and difficulty
    // From the normalizer, NOT `steps?.length ?? 0` — that expression at
    // `public-index-syncer.ts:158` is why three live public documents carry
    // `sequenceLength: 0`.
    sequenceLength: normalized.sequenceLength,
    ...(context.difficultyLevel !== undefined && {
      difficultyLevel: context.difficultyLevel,
    }),
    ...(context.level !== undefined && { level: context.level }),

    // browse filters
    ...(source.gridMode !== undefined && { gridMode: source.gridMode }),
    ...(source.reversalPattern !== undefined && {
      reversalPattern: source.reversalPattern,
    }),

    // LOOP metadata
    isCircular: loop.isCircular,
    loopType: loop.loopType,
    ...(loop.period !== undefined && { period: loop.period }),
    ...(loop.components !== undefined && { components: loop.components }),
    ...(loop.componentDomains !== undefined && {
      componentDomains: loop.componentDomains,
    }),
    ...(loop.loopSpec !== undefined && { loopSpec: loop.loopSpec }),

    // categorization
    tags: context.tagNames,

    // fork attribution
    isForked: source.source === "forked",
    ...(source.forkAttribution?.originalCreatorId !== undefined && {
      originalCreatorId: source.forkAttribution.originalCreatorId,
    }),
    ...(source.forkAttribution?.originalCreatorName !== undefined && {
      originalCreatorName: source.forkAttribution.originalCreatorName,
    }),

    // identity hashes
    contentHash: normalized.contentHash,
    contentHashVersion: normalized.contentHashVersion,
    encoderHash: context.encoderHash,

    // compositional structure minus the three excluded-from-digest members,
    // which are added after the digest is computed
    ...(source.bluePathHash !== undefined && {
      bluePathHash: source.bluePathHash,
    }),
    ...(source.redPathHash !== undefined && {
      redPathHash: source.redPathHash,
    }),
    ...(source.blueSoloHash !== undefined && {
      blueSoloHash: source.blueSoloHash,
    }),
    ...(source.redSoloHash !== undefined && {
      redSoloHash: source.redSoloHash,
    }),
    ...(source.startPosition !== undefined && {
      startPosition: source.startPosition,
    }),

    // creator intent. `null` means "legacy, none recorded" and is dropped
    // rather than stored, matching `public-index-syncer.ts:194`.
    ...(source.creatorIntent != null && {
      creatorIntent: source.creatorIntent,
    }),

    // media
    ...(source.animatedSequenceUrl !== undefined && {
      animatedSequenceUrl: source.animatedSequenceUrl,
    }),
    ...(source.animationFormat !== undefined && {
      animationFormat: source.animationFormat,
    }),

    publicProjectionSchemaVersion: PUBLIC_PROJECTION_SCHEMA_VERSION,
  };

  const publicProjectionDigest = await canonicalDigest(digested);

  // An identical digest means no projected content changed, so the writer-owned
  // stamps hold still. Without this, a notes-only owner edit would bump the
  // public revision and `updatedAt`, and every "has anything changed?" check
  // downstream would answer yes.
  const contentUnchanged =
    existing?.publicProjectionDigest !== undefined &&
    existing.publicProjectionDigest === publicProjectionDigest;

  return {
    ...digested,

    // Compositional structures. Excluded from the digest because their ids are
    // regenerated on every `ensureComposition`, present on the document because
    // Browse hydrates from them (`public-sequences-loader.ts:355`).
    ...(source.blueSoloProp !== undefined && {
      blueSoloProp: source.blueSoloProp,
    }),
    ...(source.redSoloProp !== undefined && {
      redSoloProp: source.redSoloProp,
    }),
    ...(source.stepPairings !== undefined && {
      stepPairings: source.stepPairings,
    }),

    // ENG — preserved. Only a first publication reads the owner's counts.
    forkCount: existing?.forkCount ?? source.forkCount ?? 0,
    viewCount: existing?.viewCount ?? source.viewCount ?? 0,
    starCount: existing?.starCount ?? source.starCount ?? 0,
    publicPerformanceCount: existing?.publicPerformanceCount ?? 0,
    ...(existing?.latestPublicPerformanceAt !== undefined && {
      latestPublicPerformanceAt: existing.latestPublicPerformanceAt,
    }),

    // The real creation date, so the gallery shows a birthday rather than a
    // bulk-publish date (`public-index-syncer.ts:172-173`).
    ...((source.birthday ?? source.createdAt) !== undefined && {
      birthday: source.birthday ?? source.createdAt,
    }),

    // PUB — set once, preserved forever after.
    publishedAt: existing?.publishedAt ?? context.now,

    // WRT — move only with projection content.
    updatedAt:
      contentUnchanged && existing?.updatedAt !== undefined
        ? existing.updatedAt
        : context.now,
    publicProjectionRevision:
      contentUnchanged && existing?.publicProjectionRevision !== undefined
        ? existing.publicProjectionRevision
        : revision,
    publicProjectionDigest,
  };
}
