# Audit: Mandala Phase 7 — Audio-Reactive Mode

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase7-audio-reactive-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT

**CONDITIONAL PASS** — The spec is solid on architecture and codebase integration. The audio pipeline design, parameter mapping, and smoothing approach are all sound. However, there are two critical FFT math errors, an incomplete mobile story, and the export section underestimates real-world complexity. Fix the critical issues before implementation.

---

## STRENGTHS

1. **Clean codebase integration.** The spec correctly identifies the existing animation parameters (`animatePeriod`, `animateMax`, `animateRotation`, `colorPhase`, `strokeWidth`) in `SequenceMandala.svelte` and `MandalaPane.svelte`. The proposed `computeAudioParams` function maps band energies to exactly these parameters. The existing RAF loop structure (lines 175-216 of `SequenceMandala.svelte`, lines 126-142 of `MandalaPane.svelte`) is the right injection point.

2. **Existing infrastructure reuse.** The spec correctly references:
   - `realtime-bpm-analyzer` (confirmed in `package.json` at `^5.0.0`, used by `src/lib/features/compose/compose/phases/audio/bpm-analyzer.ts`)
   - `h264-mp4-encoder` (confirmed in `package.json` at `^1.0.12`, used by `MandalaPane.svelte` line 248)
   - The existing `svgToCanvas` helper (confirmed at `MandalaPane.svelte` line 195)
   - `MandalaViewerControls.svelte` as the control surface (confirmed at `src/lib/shared/sequence-viewer/components/MandalaViewerControls.svelte`)

3. **Correct mic feedback prevention.** Not connecting mic source to `AudioContext.destination` is the right call and is consistent with the existing `AudioAnalyzer.ts` (line 36: "Don't connect analyser to destination").

4. **Manual per-band smoothing over `smoothingTimeConstant`.** Setting `AnalyserNode.smoothingTimeConstant = 0` and doing EMA manually per-band is correct practice. Different bands genuinely benefit from different smoothing rates (sub-bass is inherently slower-moving than transients in the highs).

5. **Spectral flux for real-time beat detection.** Lightweight, runs in the main thread RAF loop without blocking, and well-suited for onset detection where precise BPM tracking is not needed (the spec correctly offloads BPM to `realtime-bpm-analyzer` for file sources).

6. **No checkboxes.** The spec explicitly calls out "button + toggle-indicator pattern" for beat snap toggles. Consistent with codebase rules.

7. **Scope exclusions are well-reasoned.** System audio, MIDI, saving to Firebase, and sharing are all correctly deferred.

---

## ISSUES

### CRITICAL

**C1: FFT bin resolution calculation is wrong.**

The spec states:
> "FFT_SIZE = 2048 -> 1024 frequency bins. With typical 44.1 kHz sample rate, each bin = 43 Hz."

Then two lines later:
> "Bin resolution at 44.1 kHz, FFT_SIZE 2048: each bin covers ~21.5 Hz."

Both cannot be right, and neither is. The correct calculation:

- `frequencyBinCount = fftSize / 2 = 1024` (correct)
- Bin resolution = `sampleRate / fftSize = 44100 / 2048 = 21.533 Hz` per bin

So 21.5 Hz is correct and 43 Hz is wrong. The first statement ("each bin = 43 Hz") must be removed. It appears to confuse `sampleRate / frequencyBinCount` (43 Hz) with `sampleRate / fftSize` (21.5 Hz). The bin index formula `floor(Hz / (sampleRate / fftSize))` in the table header is correct.

**C2: FFT bin range table has an off-by-one overlap and wrong upper bins.**

The table shows:
- Mids end at bin 93, High-mids start at bin 93 (overlap)
- Highs: bins 279-465

Corrections needed:
- Mids should end at bin 92, High-mids starts at bin 93 (no overlap)
- At 44.1 kHz: 20000 Hz / 21.533 Hz = bin 928, not bin 465. The spec appears to have computed `20000 / 43 = 465` using the wrong bin resolution. With the correct 21.5 Hz resolution, the Highs band should be bins 279-928 (which is still within the 1024-bin range)
- Similarly, verify all bin boundaries: 60 Hz / 21.533 = bin 2.8 -> bins 1-2 (correct for sub-bass); 250 Hz / 21.533 = bin 11.6 -> bins 3-11 (correct for bass); 2000 Hz / 21.533 = bin 92.9 -> bins 12-92 (should be 12-92, not 12-93); 6000 Hz / 21.533 = bin 278.6 -> bins 93-278 (should be 93-278, not 93-279)

The implementation says it will compute bin indices dynamically from `audioContext.sampleRate`, which is good. But the reference table in the spec is wrong and will mislead implementers.

### IMPORTANT

**I1: `captureStream()` does not work on SVG-injected-via-`{@html}`.**

The spec claims `MandalaPane.svelte` has a `svgToCanvas` helper "already handling SVG->Canvas conversion per-frame." This is true for the export path (line 195-221 of `MandalaPane.svelte`), but that function is only called during the `handleDownload` flow — it is not called every RAF tick during normal viewing.

The current rendering path is: `SequenceMandala` generates an SVG string via `renderMandalaSVG`, injects it as `{@html svgString}` into a `<div>` (line 262-269 of `SequenceMandala.svelte`). There is no canvas in the live rendering path. The spec acknowledges this ("requires a minor refactor") but underestimates the complexity:

1. Calling `svgToCanvas` per-frame means creating a `Blob`, `URL.createObjectURL`, loading an `Image`, drawing to canvas, revoking the URL — all per frame. At 60fps that is 60 image loads per second. This will cause GC pressure and frame drops.
2. A better approach: use `OffscreenCanvas` with `createImageBitmap(blob)` which avoids the `Image` element and its layout-triggering load cycle. Or render the SVG directly to canvas via `canvg` / `resvg-js` (WASM).
3. The spec should specify which approach to use, not leave it as "minor refactor."

**I2: `canvas.captureStream(30)` at 60fps RAF is a mismatch.**

The spec proposes `captureStream(30)` for recording but the RAF loop runs at 60fps. `captureStream(fps)` tells the browser to capture at that rate from the canvas. If the visual update loop runs at 60fps but capture runs at 30fps, every other frame is dropped. This is probably intentional for file size, but the spec should state it explicitly. For live performance recordings, 30fps may produce visible choppiness.

The codebase already has a pattern for this: `VideoPreRenderer.ts` uses `captureStream(0)` with manual `requestFrame()` calls for precise frame control (line 257). The spec should reference this pattern.

**I3: WebM-only export is limiting for the target audience.**

The spec states MediaRecorder cannot produce MP4 in the browser. This is correct for native MediaRecorder. However, the codebase already has `WebCodecsVideoEncoder.ts` which uses the WebCodecs API + mediabunny for MP4 container output. This encoder is frame-by-frame (not real-time), but could be adapted for a "record then encode" workflow: capture raw frames during the live session, then encode to MP4 after recording stops. The spec should at minimum reference this existing capability as an option.

WebM files cannot be shared on Instagram, TikTok, or iMessage — all key distribution channels for festival projection material. For the stated use case ("festival projection material"), MP4 is almost mandatory. The "scripted preview" MP4 path helps but it cannot capture a live mic session.

**I4: No AudioContext resume handling.**

Browsers (especially mobile) suspend `AudioContext` until a user gesture. The spec says "Created on first source activation" but does not mention calling `audioContext.resume()` after creation or on the button click that activates audio. The existing `AudioAnalyzer.ts` creates the context inside `startWithStream` (which is called from a user gesture), but the spec's `MandalaAudioEngine` should explicitly document this: create the `AudioContext` inside the user-gesture-triggered `startMic()`/`startFile()` methods.

**I5: Missing error handling for mic permission denial and re-request.**

The spec says: "If denied, show an inline error state." But:
- After a hard deny, `getUserMedia` throws `NotAllowedError` immediately on subsequent calls. The user must go to browser settings to re-enable.
- The spec should specify: show the error message AND a "How to re-enable" link/tooltip pointing to browser permission settings.
- On iOS Safari, mic permission is per-page-load — refreshing the page resets it. This platform difference should be documented.

**I6: The EMA alpha convention is non-standard and confusing.**

The spec defines alpha as: "0 = no smoothing / instant response, 1 = frozen." This is the *opposite* of the standard EMA convention where alpha is the weight of the NEW value (alpha=1 means instant response). The formula in the spec confirms the reversed convention:

```
smoothed = smoothed * alpha + raw * (1 - alpha)
```

Here `alpha` is the weight of the OLD value. This works mathematically but will confuse any developer familiar with standard EMA. The spec should either:
- Rename to `smoothingFactor` or `decay` to avoid confusion with standard alpha
- Or flip the convention to match standard EMA: `smoothed = smoothed * (1-alpha) + raw * alpha`

### MINOR

**M1: 48 kHz bin indices are mentioned but not shown.**

The spec says "bin indices are computed dynamically, not hardcoded, to handle 48 kHz sources" — good. But the reference table only shows 44.1 kHz values. Adding a 48 kHz column (or noting the bin shift: at 48 kHz, bin resolution = 23.44 Hz, so all upper bin indices decrease by ~8%) would help implementers verify their dynamic calculation.

**M2: `COLOR_CYCLE_BREATHS` interaction is underspecified.**

The existing `MandalaPane.svelte` uses `COLOR_CYCLE_BREATHS = 3` (line 122) to tie color cycling to the breathing period. The spec's "color phase rate" formula adds a multiplier on top, but doesn't specify what happens to the base `COLOR_CYCLE_BREATHS` relationship. Does audio mode replace the breathing-linked color cycle entirely, or modulate its speed?

**M3: Beat detection running average window assumes 60fps.**

The spec says "2-second window (120 frames at 60fps)." On lower-end devices running at 30fps, this becomes a 4-second window, making beat detection less responsive. The running average should be time-based (2 seconds of wall-clock time), not frame-count-based.

**M4: Formation integration data model uses `3x gain` magic number.**

The "primary band gets 3x gain multiplier" is stated without justification. During implementation, this should be a tunable constant, not a hardcoded value. The spec should note it as a starting point that needs perceptual tuning.

**M5: 30-minute recording cap may be too short.**

For festival/DJ set recording, 30 minutes is limiting. At VP9 quality with 1080p canvas, a 30-minute recording is approximately 300-500 MB. The concern about browser memory is valid, but the cap could be raised to 60 minutes with a warning at 30 minutes. Or use `MediaRecorder.requestData()` periodically to flush chunks to IndexedDB (the codebase already has the IndexedDB infrastructure in `VideoRecorder.ts`).

**M6: Spectrum overlay SVG on top of SVG mandala.**

The spectrum bars are "rendered as SVG overlay on top of the mandala canvas." But the mandala itself is SVG injected via `{@html}`. Layering two SVG elements with z-index works but may cause event handling issues. Since the overlay is purely decorative, this is minor.

---

## RECOMMENDATIONS

1. **Fix the bin resolution math (C1, C2) before implementation.** Remove the "43 Hz" claim. Recalculate the bin range table with the correct 21.5 Hz resolution. Fix the Mids/High-mids overlap.

2. **Specify the per-frame SVG-to-canvas strategy (I1).** Two options worth evaluating:
   - `createImageBitmap(new Blob([svgString], {type: 'image/svg+xml'}))` per frame — avoids `Image` element overhead
   - `resvg-js` WASM — renders SVG to pixels directly without browser image loading pipeline; ~200KB WASM, fast for simple SVGs

   Benchmark both against the existing `svgToCanvas` approach at 60fps before choosing.

3. **Use `captureStream(0)` + manual `requestFrame()` for recording (I2).** This matches the existing `VideoPreRenderer.ts` pattern and gives frame-precise control. The implementer can decide which frames to capture.

4. **Add a post-recording MP4 transcode option (I3).** After recording WebM, offer an optional "Convert to MP4" step using the existing `WebCodecsVideoEncoder` infrastructure. This keeps the live recording simple (WebM) while providing the distribution-friendly format.

5. **Make the running average time-based, not frame-based (M3).** Track timestamps, not frame counts.

6. **Rename `alpha` to `decay` or `smoothingDecay` (I6).** Avoids confusion with standard EMA convention.

7. **Consider Meyda for feature extraction.** The spec rolls its own band energy extraction and spectral flux. Meyda (MIT, ~15KB gzipped, no WASM) provides `rms`, `spectralFlux`, `spectralCentroid`, and `chroma` out of the box with an `AnalyserNode`-compatible interface. It would replace `audio-band-extractor.ts` and `spectral-flux-detector.ts` with a maintained library. Not a blocker — the hand-rolled approach is simple enough — but worth evaluating for maintenance burden.

8. **AudioWorklet is not needed here.** The spec correctly uses `AnalyserNode` on the main thread. AudioWorklet would be overkill for read-only FFT analysis — `getByteFrequencyData()` is non-blocking and fast. AudioWorklet is for custom DSP processing (synthesis, effects), not for reading frequency data. The spec's choice is correct for 2026.

9. **Add explicit `audioContext.resume()` calls (I4)** inside `startMic()` and `startFile()`, guarded by `if (audioContext.state === 'suspended')`.

10. **Document iOS Safari mic restrictions (I5).** Mic access requires HTTPS, resets on page reload, and the `AudioContext` must be created inside the `getUserMedia` success callback on older iOS versions (iOS 16-). iOS 17+ relaxed this but the spec should handle both.

---

## MOBILE PLATFORM MATRIX

| Feature | Chrome Android | Safari iOS 17+ | Safari iOS 16 | Firefox Android |
|---------|---------------|----------------|---------------|-----------------|
| `getUserMedia` (mic) | Yes | Yes (HTTPS) | Yes (HTTPS, per-load) | Yes |
| `AnalyserNode` FFT | Yes | Yes | Yes | Yes |
| `AudioContext` auto-resume | No (needs gesture) | No (needs gesture) | No (stricter) | No (needs gesture) |
| `canvas.captureStream()` | Yes | No | No | Yes |
| `MediaRecorder` | Yes (VP8/VP9) | Yes (H.264, iOS 15.4+) | Limited | Yes (VP8) |
| WebCodecs | Yes | Yes (Safari 16.4+) | Partial | No |

**Key risk:** `canvas.captureStream()` is not supported in Safari (any version). The recording feature will not work on iOS at all. The spec must either:
- Document this limitation explicitly
- Provide a fallback (frame-by-frame capture to WebCodecs, which Safari 16.4+ does support)
