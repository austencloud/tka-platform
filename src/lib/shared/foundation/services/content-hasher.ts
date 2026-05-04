import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SoloPropData } from "../domain/models/SoloPropData";
import type { SoloPropStepData } from "../domain/models/SoloPropStepData";

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
