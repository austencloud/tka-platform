/**
 * Phase 0 harness for the pronunciation corpus design.
 *
 * Usage:
 *   pnpm exec tsx scripts/measure-word-segmentation.ts <directory>
 *
 * The directory holds one WAV per read word plus a words.json of the form
 *   [{ "file": "01.wav", "word": "AΣ-Ωβ" }]
 *
 * Reports how often energy segmentation finds exactly one island per letter and
 * writes every slice to <directory>/slices so the cuts can be auditioned.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";

import { segmentWordByEnergy } from "../src/lib/features/lab/pronunciation-recorder/domain/voice-activity-trimmer";
import { createPronunciationPlan } from "../src/lib/shared/pronunciation/pronunciation-plan";

interface WordEntry {
  file: string;
  word: string;
}

interface DecodedWav {
  samples: Float32Array;
  sampleRate: number;
}

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_IEEE_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/**
 * Read a mono or interleaved PCM/IEEE-float WAV, including
 * WAVE_FORMAT_EXTENSIBLE containers. For interleaved multi-channel audio,
 * only channel 0 is decoded — the other channels' bytes are skipped, not
 * mixed in. Any other encoding is rejected loudly.
 */
function decodeWav(bytes: Buffer, fileLabel: string): DecodedWav {
  if (bytes.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a RIFF file");
  }
  if (bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAVE file");
  }

  let cursor = 12;
  let sampleRate = 0;
  let channels = 1; // placeholder — always overwritten once the fmt chunk below is read
  let bitsPerSample = 16; // placeholder — always overwritten once the fmt chunk below is read
  let format = 0;
  let dataStart = -1;
  let dataLength = 0;

  while (cursor + 8 <= bytes.length) {
    const id = bytes.toString("ascii", cursor, cursor + 4);
    const size = bytes.readUInt32LE(cursor + 4);
    const body = cursor + 8;

    if (id === "fmt ") {
      format = bytes.readUInt16LE(body);
      if (format === WAVE_FORMAT_EXTENSIBLE) {
        if (size < 26) {
          throw new Error(
            "WAVE_FORMAT_EXTENSIBLE fmt chunk is too short to contain a SubFormat"
          );
        }
        format = bytes.readUInt16LE(body + 24);
      }
      if (format !== WAVE_FORMAT_PCM && format !== WAVE_FORMAT_IEEE_FLOAT) {
        throw new Error(
          `Only PCM or IEEE float WAV is supported, found format ${format}`
        );
      }
      channels = bytes.readUInt16LE(body + 2);
      sampleRate = bytes.readUInt32LE(body + 4);
      bitsPerSample = bytes.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataStart = body;
      dataLength = size;
    }

    cursor = body + size + (size % 2);
  }

  if (dataStart < 0 || sampleRate === 0) {
    throw new Error("WAV is missing a fmt or data chunk");
  }

  // A data chunk claiming more bytes than the file actually holds means a
  // truncated take. Clamp it instead of letting reads past the buffer end
  // silently coerce to fabricated zero (silent) samples.
  const availableBytes = Math.max(0, bytes.length - dataStart);
  if (dataLength > availableBytes) {
    console.warn(
      `  warning: ${fileLabel} data chunk claims ${dataLength} bytes but only ${availableBytes} are present — this take is truncated`
    );
    dataLength = availableBytes;
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame++) {
    const offset = dataStart + frame * bytesPerSample * channels;
    if (format === WAVE_FORMAT_IEEE_FLOAT) {
      samples[frame] = bytes.readFloatLE(offset);
    } else if (bitsPerSample === 16) {
      samples[frame] = bytes.readInt16LE(offset) / 32_768;
    } else if (bitsPerSample === 24) {
      const raw =
        bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
      samples[frame] = (raw & 0x800000 ? raw - 0x1000000 : raw) / 8_388_608;
    } else if (bitsPerSample === 32) {
      samples[frame] = bytes.readInt32LE(offset) / 2_147_483_648;
    } else {
      throw new Error(`Unsupported bit depth ${bitsPerSample}`);
    }
  }

  return { samples, sampleRate };
}

/** Write mono 16-bit PCM so the slices can be played in any audio tool. */
function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let index = 0; index < samples.length; index++) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    buffer.writeInt16LE(Math.round(clamped * 32_767), 44 + index * 2);
  }
  return buffer;
}

function readWordEntries(directory: string): WordEntry[] {
  if (!existsSync(directory)) {
    console.error(`Directory not found: ${directory}`);
    process.exit(1);
  }

  const wordsPath = join(directory, "words.json");
  if (!existsSync(wordsPath)) {
    console.error(`words.json not found in ${directory}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(wordsPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`words.json is not valid JSON: ${message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    console.error(
      `words.json must be a JSON array, found ${typeof parsed}`
    );
    process.exit(1);
  }

  const entries = parsed as WordEntry[];
  if (entries.length === 0) {
    console.error("words.json is empty — nothing to do.");
    process.exit(1);
  }

  return entries;
}

function main(): void {
  const directory = process.argv[2];
  if (!directory) {
    console.error("Usage: tsx scripts/measure-word-segmentation.ts <directory>");
    process.exit(1);
  }

  const entries = readWordEntries(directory);

  const sliceDirectory = join(directory, "slices");
  rmSync(sliceDirectory, { recursive: true, force: true });
  mkdirSync(sliceDirectory, { recursive: true });

  let matched = 0;
  let attempted = 0;
  let skipped = 0;
  let failed = 0;

  for (const [entryIndex, entry] of entries.entries()) {
    try {
      const plan = createPronunciationPlan(entry.word);
      if (!plan) {
        skipped += 1;
        console.log(`${entry.file}  ${entry.word}  SKIPPED: not a valid TKA word`);
        continue;
      }

      const { samples, sampleRate } = decodeWav(
        readFileSync(join(directory, entry.file)),
        entry.file
      );
      const expected = plan.cues.length;
      const segments = segmentWordByEnergy(samples, sampleRate);
      const isExact = segments.length === expected;
      attempted += 1;
      if (isExact) matched += 1;

      console.log(
        `${entry.file}  ${entry.word}  expected ${expected}  found ${segments.length}  ${
          isExact ? "MATCH" : "MISMATCH"
        }`
      );

      if (!isExact) {
        const expectedLetters = plan.cues.map((cue) => cue.assetKey).join(", ");
        console.log(`  expected letters: ${expectedLetters}`);
      }

      const baseName = basename(entry.file, extname(entry.file));
      segments.forEach((segment, index) => {
        const start = Math.floor(segment.startSeconds * sampleRate);
        const end = Math.floor(segment.endSeconds * sampleRate);
        // A mismatched count means the letter-to-island pairing can't be
        // trusted — labelling a slice with a letter the tool never verified
        // would be a confident wrong label, worse than no label at all.
        const label = isExact
          ? plan.cues[index]?.assetKey ?? `extra-${index}`
          : "unaligned";
        const sliceName = `${entryIndex}.${baseName}.${index}.${label}.wav`;
        writeFileSync(
          join(sliceDirectory, sliceName),
          encodeWav(samples.slice(start, end), sampleRate)
        );
        if (!isExact) {
          console.log(
            `    segment ${index}: ${segment.startSeconds.toFixed(2)}s - ${segment.endSeconds.toFixed(2)}s`
          );
        }
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`${entry.file}  ${entry.word}  FAILED: ${message}`);
    }
  }

  let summary = `${matched}/${attempted} words segmented exactly.`;
  const extras: string[] = [];
  if (skipped > 0) extras.push(`${skipped} skipped`);
  if (failed > 0) extras.push(`${failed} failed`);
  if (extras.length > 0) summary += ` (${extras.join(", ")})`;

  console.log(`\n${summary}`);
  console.log(`Slices written to ${sliceDirectory}. Listen before deciding.`);
}

main();
