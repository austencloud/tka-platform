/**
 * Server-side preparation for the QR scan's first visual.
 *
 * The public short-code record already contains everything needed to decode a
 * scannable card. Doing that work here keeps the browser's critical path free
 * of Firebase, the shortcode resolver, the sequence hydrator, and the local
 * pictograph renderer. The returned image URLs point at the same canonical
 * per-cell objects verified when the QR was minted.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  getSequenceMotionProfile,
  getSequenceMotionVisibility,
} from "$lib/shared/foundation/services/sequence-motion-profile";
import { loopDetector } from "$lib/shared/create/services/loop-detector";
import {
  decodeSequenceFromQR,
  isInlineEncoded,
} from "$lib/shared/navigation/services/sequence-encoder";
import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
import {
  hydrateSelfContainedShortCodePayload,
  shortCodeSoloTitle,
} from "$lib/shared/qr/services/short-code-payload-hydrator";
import type { ShortCodeData } from "$lib/shared/qr/services/types";
import {
  resolveScanPropConfig,
  type ScanPropCandidate,
  type ScanPropConfig,
} from "$lib/shared/qr/services/scan-prop-resolver";
import {
  CANONICAL_CARD_VISIBILITY,
  CANONICAL_CELL_SIZE,
  deriveCloudCellHash,
} from "$lib/shared/render/services/cloud-cell-key";
import { cellPublicUrl } from "$lib/shared/render/services/pictograph-cloud-cache";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
import { detectMixedDurations } from "$lib/shared/choreo-card/services/step-durations";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type {
  PreparedScanCard,
  PreparedScanCell,
} from "$lib/shared/qr/domain/prepared-scan-card";

export interface PreparedScanPayload {
  sequence: SequenceData;
  card: PreparedScanCard;
  propConfig: ScanPropConfig;
}

async function resolveSelfContainedSequence(
  code: string,
  record: ShortCodeData | null
): Promise<SequenceData | null> {
  if (record) {
    return hydrateSelfContainedShortCodePayload(code, record);
  }
  if (!isInlineEncoded(code)) return null;

  try {
    return await decodeSequenceFromQR(code);
  } catch {
    return null;
  }
}

function renderOptionsFor(
  sequence: SequenceData,
  propConfig: ScanPropConfig
): PreviewCellRenderOptions {
  const motionVisibility = getSequenceMotionVisibility(sequence);
  return {
    ...CANONICAL_CARD_VISIBILITY,
    size: CANONICAL_CELL_SIZE,
    showStepNumbers: false,
    bluePropType: propConfig.bluePropType,
    redPropType: propConfig.redPropType,
    catDogModeEnabled: propConfig.catDogMode,
    showBlueMotion: motionVisibility.showBlueMotion,
    showRedMotion: motionVisibility.showRedMotion,
    probeCloud: true,
    cloudOnly: true,
  };
}

async function prepareCell(
  index: number,
  data: PictographData,
  duration: number,
  mixedDurations: boolean,
  options: PreviewCellRenderOptions
): Promise<PreparedScanCell> {
  const widthMultiplier = mixedDurations && duration !== 1 ? duration : 1;
  const cellOptions =
    widthMultiplier === 1 ? options : { ...options, widthMultiplier };
  const hash = await deriveCloudCellHash(data, true, cellOptions);

  return {
    index,
    label: index < 0 ? "Start" : String(index + 1),
    imageUrl: cellPublicUrl(hash),
    duration,
    widthMultiplier,
  };
}

/**
 * Decode, hydrate, and map a public short-code payload to canonical cell URLs.
 * Returns null when a legacy record requires the browser's lookup ladder.
 */
export async function prepareScanPayload(
  code: string,
  record: ShortCodeData | null,
  ...scanCandidates: readonly (ScanPropCandidate | null | undefined)[]
): Promise<PreparedScanPayload | null> {
  const decoded = await resolveSelfContainedSequence(code, record);
  if (!decoded) return null;

  const sequence = await hydrateSequence(decoded, { loopDetector });
  if (!sequence.steps?.length) return null;

  const propConfig = resolveScanPropConfig(sequence, ...scanCandidates, record);
  const options = renderOptionsFor(sequence, propConfig);
  const mixedDurations = detectMixedDurations(sequence.steps);
  const start = startPositionDeriver.getOrDeriveStartPosition(sequence);
  const cellPromises: Promise<PreparedScanCell>[] = [];

  if (start) {
    cellPromises.push(prepareCell(-1, start, 1, mixedDurations, options));
  }
  sequence.steps.forEach((step, index) => {
    const duration = step.duration ?? 1;
    cellPromises.push(
      prepareCell(index, step, duration, mixedDurations, options)
    );
  });

  const profile = getSequenceMotionProfile(sequence);
  return {
    sequence,
    card: {
      word:
        profile.kind === "solo" && record
          ? shortCodeSoloTitle(record)
          : sequence.word ||
            sequence.displayName ||
            sequence.name ||
            "Sequence",
      isSolo: profile.kind === "solo",
      cells: await Promise.all(cellPromises),
      hasMixedDurations: mixedDurations,
    },
    propConfig,
  };
}
