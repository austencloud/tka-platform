/**
 * Turn cut tokens into the v2 bank the player loads.
 *
 * Run: pnpm exec tsx scripts/build-token-bank.ts <session-dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { measureTokenFeatures } from "../src/lib/shared/pronunciation/domain/audio-features";
import { getLetterPronunciation } from "../src/lib/shared/pronunciation/pronunciation-plan";
import type {
  PronunciationPosition,
  PronunciationTokenBank,
} from "../src/lib/shared/pronunciation/pronunciation-plan";

export interface PartialToken {
  letter: string;
  path: string;
  position: PronunciationPosition;
  previousLetter: string | null;
  nextLetter: string | null;
  sourceWord: string;
  indexInWord: number;
  groupLength: number;
  startSeconds: number;
  endSeconds: number;
}

export interface DecodedToken {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Bank keys are asset keys ("sigma-dash"); neighbour fields are letter VALUES
 * ("Σ-"), because the selector compares them against `PronunciationCue.letter`.
 * The manifest parser enforces that neighbours normalise to real letters for
 * exactly this reason — an asset key there parses and then mismatches on every
 * join in the bank, silently.
 */
export function assembleBank(
  tokens: readonly PartialToken[],
  decode: (token: PartialToken) => DecodedToken
): PronunciationTokenBank {
  const bank: PronunciationTokenBank = { version: 2, tokens: {} };

  for (const token of tokens) {
    const assetKey = getLetterPronunciation(token.letter as never)?.assetKey;
    if (!assetKey) {
      throw new Error(`${token.path}: "${token.letter}" is not a TKA letter`);
    }

    const decoded = decode(token);
    // Destructured rather than spread: measureTokenFeatures also returns
    // rmsStartDb/rmsEndDb, which the token type does not carry and the parser
    // ignores. Spreading them would write two dead fields per token into every
    // bank — TypeScript does not flag excess properties that arrive by spread.
    const { durationMs, rmsDb, f0StartHz, f0EndHz } = measureTokenFeatures(
      decoded.samples,
      decoded.sampleRate
    );

    (bank.tokens[assetKey] ??= []).push({
      path: token.path,
      position: token.position,
      previousLetter: token.previousLetter,
      nextLetter: token.nextLetter,
      sourceWord: token.sourceWord,
      indexInWord: token.indexInWord,
      groupLength: token.groupLength,
      durationMs,
      rmsDb,
      f0StartHz,
      f0EndHz,
    });
  }

  return bank;
}

function decodeWav24(path: string): DecodedToken {
  const buffer = readFileSync(path);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  if (bits !== 24) throw new Error(`${path}: expected 24-bit PCM, found ${bits}`);

  const dataBytes = view.getUint32(40, true);
  const samples = new Float32Array(dataBytes / 3);
  for (let index = 0; index < samples.length; index++) {
    const offset = 44 + index * 3;
    const raw =
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16);
    const signed = raw >= 0x800000 ? raw - 0x1000000 : raw;
    samples[index] = signed / 8_388_607;
  }
  return { samples, sampleRate };
}

function main(): void {
  const session = process.argv[2];
  if (!session) {
    console.error("usage: build-token-bank.ts <session-dir>");
    process.exit(1);
  }

  const partial: PartialToken[] = JSON.parse(
    readFileSync(join(session, "tokens-partial.json"), "utf-8")
  );
  const bank = assembleBank(partial, (token) => decodeWav24(join(session, token.path)));
  const output = join(session, "pronunciation-bank.json");

  writeFileSync(output, `${JSON.stringify(bank, null, 2)}\n`);
  console.log(`wrote ${partial.length} tokens to ${output}`);
}

if (process.argv[1]?.endsWith("build-token-bank.ts")) main();
