// src/lib/features/lab/pronunciation-recorder/domain/wav-encoder.ts
const BYTES_PER_SAMPLE = 3;
const HEADER_BYTES = 44;
const FULL_SCALE = 8_388_607; // 2^23 - 1

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index++) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/**
 * Mono 24-bit PCM WAV. 24-bit rather than 32-bit float because the aligner's
 * chain reaches Kaldi, whose WAV reader is reliable on integer PCM and is not
 * on IEEE-float WAV; and integer rather than 16-bit because these files are the
 * source the token bank is cut from, not a transcription input.
 */
export function encodeWav24(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, 24, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = HEADER_BYTES;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index] ?? 0;
    const clamped = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0));
    const value = Math.round(clamped * FULL_SCALE);
    view.setUint8(offset, value & 0xff);
    view.setUint8(offset + 1, (value >> 8) & 0xff);
    view.setUint8(offset + 2, (value >> 16) & 0xff);
    offset += BYTES_PER_SAMPLE;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
