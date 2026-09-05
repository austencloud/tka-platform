//
// Pre-warm the OffscreenCanvas card-render pool the moment a deck's sequences
// are known (before the print preview mounts), so the ~5s asset-bundle seed
// overlaps the user's navigation and every cold deck — small or large — hits the
// warm worker path. Fire-and-forget; any failure leaves canUseWorker()===false
// and the render falls back to the main thread (no regression).

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { CompositionDispatcher } from "./composition-dispatcher";
import { getCompositionDispatcher } from "../get-composition-dispatcher";
import { getCardAssetBundle } from "./get-card-asset-bundle";
import { buildOverridePlacementBundle } from "./override-placement-bundle";

export interface PrewarmOptions {
  sequences: SequenceData[];
  leftPropType: PropType;
  rightPropType: PropType;
  theme: string;
  iconPaths?: string[];
  /** Seed HAND and hand-path arrow assets instead of the operator's live props. */
  handPathMode?: boolean;
}

// Bumped when the worker render contract changes in a way that invalidates a
// seeded pool. Mirrors the spirit of PrintPreviewPages' CARD_RENDER_SCHEMA.
const SEED_SCHEMA = "v1";

/**
 * Deterministic signature of the asset bundle a deck needs. Sequence order does
 * not matter (ids are sorted); prop types and the seed schema do. Two decks with
 * the same signature can share a seeded pool; a different signature forces a
 * re-seed.
 */
export function computeBundleSignature(opts: {
  sequences: SequenceData[];
  leftPropType: PropType;
  rightPropType: PropType;
  handPathMode?: boolean;
}): string {
  const propTypes = resolvePrewarmPropTypes(opts);
  const ids = opts.sequences
    .map((s) => s.id ?? s.word ?? "")
    .filter(Boolean)
    .sort()
    .join(",");
  return [
    SEED_SCHEMA,
    propTypes.leftPropType,
    propTypes.rightPropType,
    ids,
  ].join("|");
}

export function resolvePrewarmPropTypes(
  opts: Pick<PrewarmOptions, "leftPropType" | "rightPropType" | "handPathMode">
): { leftPropType: PropType; rightPropType: PropType } {
  return opts.handPathMode
    ? { leftPropType: PropType.HAND, rightPropType: PropType.HAND }
    : {
        leftPropType: opts.leftPropType,
        rightPropType: opts.rightPropType,
      };
}

/**
 * Fire-and-forget: probe worker support, build + seed the deck's asset bundle
 * into the pool. Idempotent — a second call for the same deck signature is a
 * no-op; a different signature terminates the stale pool and re-seeds. Never
 * throws (errors are swallowed → main-thread fallback).
 */
export function prewarmCardPool(opts: PrewarmOptions): void {
  if (opts.sequences.length === 0) return;

  const dispatcher = getCompositionDispatcher();
  const signature = computeBundleSignature(opts);
  const propTypes = resolvePrewarmPropTypes(opts);
  if (dispatcher.getSeededSignature() === signature) return; // already hot

  // Reserve the seed SYNCHRONOUSLY — raise the gate (and tear down a stale-deck
  // pool) the instant prewarm is called, BEFORE any await. This guarantees a
  // composeFrontBitmap that races in (e.g. the preview mounting) waits for this
  // bundle via the gate in ensureInitialized instead of seeding the pool empty.
  const finishSeed = dispatcher.beginSeed(signature);

  void (async () => {
    let seeded = false;
    try {
      const ok = await CompositionDispatcher.probeWorkerSupport();
      if (!ok) return; // worker unusable → main-thread fallback (finally opens gate)
      const bundle = await getCardAssetBundle(opts.sequences, {
        leftPropType: propTypes.leftPropType,
        rightPropType: propTypes.rightPropType,
        theme: opts.theme,
        iconPaths: opts.iconPaths,
      });
      dispatcher.setAssetBundle(bundle);
      dispatcher.setOverrideBundle(buildOverridePlacementBundle());
      seeded = true;
    } catch (err) {
      console.warn(
        "[prewarmCardPool] pre-warm failed (main-thread fallback stays):",
        err
      );
    } finally {
      finishSeed(); // open the gate so neither prewarm nor a racer hangs
    }
    if (seeded) await dispatcher.ensureInitialized();
  })();
}
