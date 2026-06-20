/**
 * Repair the pre-baked Mandala Rosetta loop clips by dropping their spurious
 * first frame, then re-muxing as a fragmented MP4 for the seamless-loop player.
 *
 * Why: each baked clip's frame 0 is the sequence's static START-POSITION snapshot
 * (club at its home/north orientation), which sits OFF the continuous mandala
 * curve — frames 1..N-1 are the real motion and already wrap cleanly (frame N-1 →
 * frame 1). At every MSE loop seam the player presents that off-curve frame 0 for
 * one frame: a north "flash" at the low-point boundary. Under decoder load the
 * frame is sometimes dropped, which is why it reads as intermittent.
 *
 * Dropping frame 0 yields a clean 119-frame loop (≈3.97 s @ 30 fps) with no spike.
 * This is a decode→re-encode pass; it never touches the animation engine / WebGL,
 * so it can't hit the offscreen GL-context leak that crashes a full re-bake. All
 * cells drop the same single frame, so they stay the same length and in sync.
 */
import {
  Input,
  BufferSource,
  ALL_FORMATS,
  VideoSampleSink,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedPacket,
} from "mediabunny";

export interface RepairOptions {
  fps?: number;
  /** Output bitrate override; defaults to the source's measured bitrate (×1.1). */
  bitrate?: number;
  /** How many leading frames to drop (default 1 — the start-position snapshot). */
  dropLeading?: number;
}

/**
 * Decode every frame of a clip to an ImageBitmap (presentation order). Debug-only
 * helper for inspecting the baked frames. Caller owns closing the bitmaps.
 */
export async function decodeClipFrames(
  bytes: ArrayBuffer,
): Promise<{ total: number; frames: { index: number; t: number; bmp: ImageBitmap }[] }> {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(new Uint8Array(bytes)) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track");
    const sink = new VideoSampleSink(track);
    const frames: { index: number; t: number; bmp: ImageBitmap }[] = [];
    let i = 0;
    for await (const sample of sink.samples()) {
      const vf = sample.toVideoFrame();
      frames.push({ index: i, t: sample.timestamp, bmp: await createImageBitmap(vf) });
      vf.close();
      sample.close();
      i++;
    }
    return { total: i, frames };
  } finally {
    await input.dispose?.();
  }
}

/**
 * Rotate a baked loop clip so its MSE seam lands on the frame of MAXIMUM motion
 * (club mid-whip) instead of a posed cardinal (e.g. club vertical at north),
 * which reads as a flash when the loop restarts there.
 *
 * The clip is a closed periodic loop, so every consecutive frame pair —
 * including the wrap — is already continuous. Rotating the start index just
 * chooses WHERE the wrap sits; placing it at peak motion makes the restart
 * indistinguishable from any other fast frame step, and moves the slow cardinal
 * poses to the interior (a natural pass-through). No re-render, no geometry
 * change, trail continuity preserved.
 */
export async function rotateClipToBestSeam(
  bytes: ArrayBuffer,
  opts: RepairOptions = {},
): Promise<{ buffer: ArrayBuffer; frames: number; seamAt: number }> {
  const fps = opts.fps ?? 30;

  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(new Uint8Array(bytes)) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track in clip");
    const width = track.displayWidth || track.codedWidth;
    const height = track.displayHeight || track.codedHeight;
    const codec = (await track.getCodecParameterString()) ?? "avc1.64001f";
    let bitrate = opts.bitrate ?? 0;
    if (!bitrate) {
      try {
        const stats = await track.computePacketStats();
        bitrate = Math.round((stats.averageBitrate || 6_000_000) * 1.1);
      } catch {
        bitrate = 8_000_000;
      }
    }

    // Pass 1 — STREAM the clip computing a 64×64 blue-channel signature per
    // frame (close each frame immediately so the decoder pool never backs up),
    // plus the presentation timestamps. Cyclic per-frame motion = blue delta
    // from the previous frame; peak motion = club moving fastest = not posed.
    const sink = new VideoSampleSink(track);
    const sigs: Uint8ClampedArray[] = [];
    const stamps: number[] = [];
    const sc = new OffscreenCanvas(64, 64);
    const sx = sc.getContext("2d", { willReadFrequently: true })!;
    for await (const sample of sink.samples()) {
      const vf = sample.toVideoFrame();
      sx.clearRect(0, 0, 64, 64);
      sx.drawImage(vf, 0, 0, 64, 64);
      sigs.push(sx.getImageData(0, 0, 64, 64).data.slice());
      stamps.push(sample.timestamp);
      vf.close();
      sample.close();
    }
    const N = sigs.length;
    const motion = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
      let s = 0;
      for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i + 2] - b[i + 2]);
      return s;
    };
    let seamAt = 0;
    let best = -1;
    for (let k = 0; k < N; k++) {
      const v = motion(sigs[(k - 1 + N) % N]!, sigs[k]!);
      if (v > best) { best = v; seamAt = k; }
    }
    const seamTs = stamps[seamAt]!;

    // Pass 2 — STREAM the frames in rotated order (seamAt..end, then 0..seamAt)
    // and re-encode B-frame-free + fragmented, holding one frame at a time.
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "fragmented" }),
      target: new BufferTarget(),
    });
    const source = new EncodedVideoPacketSource("avc");
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();
    let encoderError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => { void source.add(EncodedPacket.fromEncodedChunk(chunk), meta); },
      error: (e) => { encoderError = e; },
    });
    encoder.configure({ codec, width, height, bitrate, framerate: fps, latencyMode: "quality", bitrateMode: "constant" });
    const frameDurMicros = Math.round(1_000_000 / fps);
    let n = 0;
    const encodeRange = async (start: number, end?: number) => {
      for await (const sample of sink.samples(start, end)) {
        if (encoderError) { sample.close(); break; }
        const src = sample.toVideoFrame();
        const frame = new VideoFrame(src, { timestamp: n * frameDurMicros, duration: frameDurMicros });
        src.close();
        sample.close();
        encoder.encode(frame, { keyFrame: n === 0 });
        frame.close();
        n++;
      }
    };
    await encodeRange(seamTs);          // seamAt … last
    await encodeRange(0, seamTs);       // first … seamAt-1
    await encoder.flush();
    encoder.close();
    if (encoderError) throw encoderError;
    await output.finalize();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer || buffer.byteLength === 0) throw new Error("rotate produced empty output");
    return { buffer, frames: N, seamAt };
  } finally {
    await input.dispose?.();
  }
}

/**
 * Re-encode a clip dropping the leading frame(s), output as a fragmented MP4.
 * Returns { buffer, inFrames, outFrames } so the caller can assert the drop.
 */
export async function repairLoopClip(
  bytes: ArrayBuffer,
  opts: RepairOptions = {},
): Promise<{ buffer: ArrayBuffer; inFrames: number; outFrames: number }> {
  const fps = opts.fps ?? 30;
  const dropLeading = opts.dropLeading ?? 1;

  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(new Uint8Array(bytes)) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track in clip");

    const width = track.displayWidth || track.codedWidth;
    const height = track.displayHeight || track.codedHeight;
    const codec = (await track.getCodecParameterString()) ?? "avc1.64001f";

    let bitrate = opts.bitrate ?? 0;
    if (!bitrate) {
      try {
        const stats = await track.computePacketStats();
        bitrate = Math.round((stats.averageBitrate || 6_000_000) * 1.1);
      } catch {
        bitrate = 8_000_000;
      }
    }

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "fragmented" }),
      target: new BufferTarget(),
    });
    const source = new EncodedVideoPacketSource("avc");
    output.addVideoTrack(source, { frameRate: fps });
    await output.start();

    let encoderError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        void source.add(EncodedPacket.fromEncodedChunk(chunk), meta);
      },
      error: (e) => {
        encoderError = e;
      },
    });
    // `quality` matches the original bake (no frames dropped). The baked clips
    // carry no B-frame reordering, so this concatenates cleanly under MSE.
    encoder.configure({
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      latencyMode: "quality",
      bitrateMode: "constant",
    });

    const sink = new VideoSampleSink(track);
    const frameDurMicros = Math.round(1_000_000 / fps);
    let inFrames = 0;
    let outFrames = 0;
    for await (const sample of sink.samples()) {
      const idx = inFrames++;
      if (encoderError) {
        sample.close();
        break;
      }
      if (idx < dropLeading) {
        sample.close();
        continue;
      }
      const src = sample.toVideoFrame();
      // Re-stamp to a clean monotonic PTS from 0 so the dropped-frame gap closes.
      const frame = new VideoFrame(src, {
        timestamp: outFrames * frameDurMicros,
        duration: frameDurMicros,
      });
      src.close();
      sample.close();
      encoder.encode(frame, { keyFrame: outFrames === 0 });
      frame.close();
      outFrames++;
    }

    await encoder.flush();
    encoder.close();
    if (encoderError) throw encoderError;
    await output.finalize();

    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer || buffer.byteLength === 0) throw new Error("repair produced empty output");
    return { buffer, inFrames, outFrames };
  } finally {
    await input.dispose?.();
  }
}
