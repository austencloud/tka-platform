import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { SoloPropData } from "../domain/models/SoloPropData";
import type { SoloPropStepData } from "../domain/models/SoloPropStepData";
import type { SequenceData } from "../domain/models/SequenceData";

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(bytes: Uint8Array): string {
  let result = "";
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  while (value > 0n) {
    result = BASE62_CHARS[Number(value % 62n)] + result;
    value = value / 62n;
  }
  return result.padStart(22, "0");
}

function serializeStep(step: SoloPropStepData): string {
  let s = `${step.startLocation}:${step.endLocation}:${step.motionType}:${step.rotationDirection}:${step.turns}:${step.startOrientation}:${step.endOrientation}`;
  if (step.handPath != null) {
    s += `:${step.handPath}`;
    if (step.skewSteps != null) {
      s += `:${step.skewSteps}:${step.skewDir ?? ""}`;
    }
  }
  return s;
}

// FNV-1a 128-bit via dual 64-bit hashing. Deterministic and synchronous.
function hash128(input: string): string {
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x100000001b3n;
  const FNV_PRIME = 0x00000100000001b3n;
  for (let i = 0; i < input.length; i++) {
    const c = BigInt(input.charCodeAt(i));
    h1 ^= c;
    h1 = (h1 * FNV_PRIME) & 0xffffffffffffffffn;
    h2 ^= c;
    h2 = (h2 * (FNV_PRIME + 2n)) & 0xffffffffffffffffn;
  }
  const bytes = new Uint8Array(16);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(h1 & 0xffn);
    h1 >>= 8n;
    bytes[i + 8] = Number(h2 & 0xffn);
    h2 >>= 8n;
  }
  return toBase62(bytes);
}

export function hashHandPath(locations: readonly GridLocation[]): string {
  const canonical = locations.join("|");
  return hash128(canonical);
}

export function hashSoloProp(soloProp: Pick<SoloPropData, "startLocation" | "startOrientation" | "steps">): string {
  const parts = [`${soloProp.startLocation}:${soloProp.startOrientation}`];
  for (const step of soloProp.steps) {
    parts.push(serializeStep(step));
  }
  return hash128(parts.join("|"));
}

/** Every field that affects how a choreo-card pictograph renders for a node. */
interface HashableNode {
  letter?: unknown;
  startPosition?: unknown;
  endPosition?: unknown;
  gridPosition?: unknown;
  blueReversal?: boolean;
  redReversal?: boolean;
  motions?: { blue?: MotionData; red?: MotionData };
}

function serializeMotion(m?: MotionData): string {
  if (!m) return "-";
  return `${m.motionType}:${m.rotationDirection}:${m.startLocation}:${m.endLocation}:${m.turns}:${m.startOrientation}:${m.endOrientation}`;
}

function serializeChoreoNode(node: HashableNode): string {
  return [
    node.letter ?? "",
    node.startPosition ?? node.gridPosition ?? "",
    node.endPosition ?? "",
    serializeMotion(node.motions?.blue),
    serializeMotion(node.motions?.red),
    node.blueReversal ? "B" : "",
    node.redReversal ? "R" : "",
  ].join(":");
}

/**
 * Content fingerprint of a sequence's render-relevant state: word, start
 * position, and every step's letter, both motions, and reversal flags.
 *
 * Use as a render-cache discriminator. Any transform that changes what the
 * card draws (reversal flips, re-derived letters, recomputed orientations)
 * yields a different hash, so caches self-invalidate — no manual version bumps,
 * and reversal variants that reuse a base sequence's id never collide.
 */
export function hashSequenceContent(
  seq: Pick<SequenceData, "word" | "steps" | "startPosition">,
): string {
  const parts: string[] = [String(seq.word ?? "")];
  if (seq.startPosition) {
    parts.push("sp|" + serializeChoreoNode(seq.startPosition as HashableNode));
  }
  for (const step of seq.steps ?? []) {
    parts.push(serializeChoreoNode(step as HashableNode));
  }
  return hash128(parts.join("~"));
}
