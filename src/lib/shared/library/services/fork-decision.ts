/**
 * fork-decision — the version-aware "is this save a content fork?" rule.
 *
 * Fork detection compares an incoming sequence's identity hash to the stored
 * doc's hash for the same id. When they differ the save forks into a new
 * variation; when they match it's a metadata-only update.
 *
 * The subtlety this module owns: `incomingHash` is computed under the ACTIVE
 * hash version, but the stored doc may have been hashed under an OLDER version
 * (see HASH_VERSION_V1 / HASH_VERSION_V2 in `sequence-content-hasher`). A basis
 * change alone must NOT look like a content change — otherwise flipping the hash
 * version would fork every unmigrated doc on its next save. So on a version
 * mismatch we recompute the STORED content's hash at the active version and
 * compare on that common basis; a true content change still forks, a mere
 * version bump does not (the caller then lazy-rehashes the doc to the active
 * version on the update path).
 *
 * Pure + injectable so the corruption-sensitive decision is unit-tested directly
 * (see fork-decision.test.ts) rather than replicated inline.
 */

export interface ForkDecisionInput {
  /** Hash of the sequence being saved, computed at `activeVersion`. */
  readonly incomingHash: string | undefined;
  /** Hash currently stored on the doc (computed under `existingVersion`). */
  readonly existingHash: string | undefined;
  /** Hash version the stored doc was written under (absent === V1 upstream). */
  readonly existingVersion: number;
  /** The active hash version `incomingHash` was computed under. */
  readonly activeVersion: number;
  /**
   * Recompute the STORED content's hash at the active version. Invoked ONLY on a
   * version mismatch, so the common-basis comparison is fair. Returns undefined
   * if the stored content can't be rehashed (then we never fork — a spurious
   * fork is worse than a missed one; the doc just takes the update path).
   */
  readonly recomputeExistingAtActiveVersion: () => Promise<string | undefined>;
}

export interface ForkDecision {
  /** True → save as a new forked variation; false → metadata-only update. */
  readonly fork: boolean;
  /** Stored hash on a basis comparable to incomingHash (recomputed on mismatch). */
  readonly comparableExistingHash: string | undefined;
}

export async function decideFork(
  input: ForkDecisionInput
): Promise<ForkDecision> {
  let comparableExistingHash = input.existingHash;

  // Only pay the recompute when the bases actually differ. At V1 with no stored
  // version (existingVersion === activeVersion) this is skipped entirely, so the
  // decision is byte-identical to the pre-versioning behavior.
  if (input.existingHash && input.existingVersion !== input.activeVersion) {
    comparableExistingHash = await input.recomputeExistingAtActiveVersion();
  }

  const fork = !!(
    input.incomingHash &&
    comparableExistingHash &&
    comparableExistingHash !== input.incomingHash
  );

  return { fork, comparableExistingHash };
}
