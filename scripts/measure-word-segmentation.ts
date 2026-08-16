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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

/** Read a mono or interleaved PCM WAV. Non-PCM encodings are rejected loudly. */
function decodeWav(bytes: Buffer): DecodedWav {
  if (bytes.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a RIFF file");
  }
  if (bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAVE file");
  }

  let cursor = 12;
  let sampleRate = 0;
  let channels = 1;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataLength = 0;

  while (cursor + 8 <= bytes.length) {
    const id = bytes.toString("ascii", cursor, cursor + 4);
    const size = bytes.readUInt32LE(cursor + 4);
    const body = cursor + 8;

    if (id === "fmt ") {
      const format = bytes.readUInt16LE(body);
      if (format !== 1) {
        throw new Error(`Only PCM WAV is supported, found format ${format}`);
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

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame++) {
    const offset = dataStart + frame * bytesPerSample * channels;
    if (bitsPerSample === 16) {
      samples[frame] = bytes.readInt16LE(offset) / 32_768;
    } else if (bitsPerSample === 24) {
      const raw =
        bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
      samples[frame] = (raw & 0x800000 ? raw - 0x1000000 : raw) / 8_388_608;
    } else if (bitsPerSample === 32) {
      samples[frame] = bytes.readFloatLE(offset);
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

function main(): void {
  const directory = process.argv[2];
  if (!directory) {
    console.error("Usage: tsx scripts/measure-word-segmentation.ts <directory>");
    process.exit(1);
  }

  const entries = JSON.parse(
    readFileSync(join(directory, "words.json"), "utf8")
  ) as WordEntry[];

  const sliceDirectory = join(directory, "slices");
  mkdirSync(sliceDirectory, { recursive: true });

  let matched = 0;
  for (const entry of entries) {
    const plan = createPronunciationPlan(entry.word);
    if (!plan) {
      console.log(`${entry.file}  ${entry.word}  SKIPPED: not a valid TKA word`);
      continue;
    }

    const { samples, sampleRate } = decodeWav(
      readFileSync(join(directory, entry.file))
    );
    const expected = plan.cues.length;
    const segments = segmentWordByEnergy(samples, sampleRate);
    const isExact = segments.length === expected;
    if (isExact) matched += 1;

    console.log(
      `${entry.file}  ${entry.word}  expected ${expected}  found ${segments.length}  ${
        isExact ? "MATCH" : "MISMATCH"
      }`
    );

    segments.forEach((segment, index) => {
      const start = Math.floor(segment.startSeconds * sampleRate);
      const end = Math.floor(segment.endSeconds * sampleRate);
      const label = plan.cues[index]?.assetKey ?? `extra-${index}`;
      writeFileSync(
        join(sliceDirectory, `${entry.file}.${index}.${label}.wav`),
        encodeWav(samples.slice(start, end), sampleRate)
      );
    });
  }

  console.log(`\n${matched}/${entries.length} words segmented exactly.`);
  console.log(`Slices written to ${sliceDirectory}. Listen before deciding.`);
}

main();
