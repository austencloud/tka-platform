# Phase 7: Audio-Reactive — Web Research Audit

Audited against spec: `docs/superpowers/specs/2026-05-25-mandala-phase7-audio-reactive-design.md`
Research date: 2026-05-25

---

## Findings

---

### 1. Beat Detection

**Spec says:** Hand-rolled spectral flux in `spectral-flux-detector.ts`. Previous-frame comparison across bass bins (1–30), running average over 2-second window, `beatSensitivity` multiplier. `realtime-bpm-analyzer` used only for informational BPM badge on file sources.

**2026 SOTA:**
Spectral flux is still the consensus sweet spot for real-time beat onset in the browser — academic literature and DJ tools alike use it. The recommended window is 1024-sample Hann with 50% overlap (not the raw FFT frame grab the spec describes). The key distinction: the spec does a frame-to-frame bin diff using the raw AnalyserNode output, which gives coarser timing resolution than running a proper STFT with overlapping windows.

**Meyda.js** ships a `spectralFlux` feature extractor with the correct windowed-STFT architecture. It runs in a `ScriptProcessorNode`/`AudioWorklet` pipeline and returns the flux value ready for thresholding. The library benchmarks at 288 ops/sec (3.34× real-time) and is maintained. However: the `spectralFlux` feature is in Meyda's feature list but its GitHub issue tracker shows a long-open ticket (Issue #30) noting that the Meyda spectral flux implementation does not apply the half-wave rectification (positive flux only) that onset detection requires. This means Meyda's flux feature fires on energy drops too, producing false positives. Workaround exists (clamp to 0 in userland) but it is not yet fixed in the library.

**`realtime-bpm-analyzer`** (already in `package.json`) can actually do live onset detection via a microphone stream — its README documents streaming BPM from `getUserMedia`. The spec only uses it for file-source BPM badges, but it could provide the onset signal too, eliminating a hand-rolled implementation.

**Essentia.js** has `BeatTrackerMultiFeature` using complex spectral difference (more accurate than simple flux), but it ships as a large WASM binary and is overkill for a single-parameter impulse on a mandala.

**Verdict:** ⚠️ Better approach exists

**Recommendation:** Keep the hand-rolled spectral flux approach but apply the standard onset-detection correction: use a Hann window on the current frame's bins before computing the frame-to-frame diff. The current approach reads raw `getByteFrequencyData` output, which is already windowed by the AnalyserNode's Blackman window — that's adequate, but computing flux across all bins rather than only the bass band (bins 1–30) is the standard practice and will be more robust for non-kick percussion (hi-hats in the highs register). Consider expanding the flux computation to all bins but weighting bass bins 3× before summing. Avoid adopting Meyda for beat detection only — the spectral flux bug means you'd still need the same hand-roll logic on top.

---

### 2. AudioWorklet vs AnalyserNode

**Spec says:** `AnalyserNode` with `fftSize = 2048`, read in the RAF loop on the main thread. `smoothingTimeConstant = 0` (manual per-band EMA). No AudioWorklet involvement.

**2026 SOTA:**
The current consensus is: **AnalyserNode is the right choice for visualization use cases** specifically. AudioWorklet runs on the dedicated audio thread, is ideal for custom DSP and low-latency processing, but requires postMessage or SharedArrayBuffer to get data back to the main thread for rendering. At 60fps, the cost of postMessage for a 1024-element Float32Array is non-trivial in terms of serialization and scheduling.

The recommended 2026 pattern for visualization work is:
- Use `AnalyserNode` for frequency data (it already runs on the audio graph thread; `getByteFrequencyData` does a zero-copy read into a pre-allocated TypedArray)
- If peak detection / smoothing is expensive, offload to an `AudioWorklet` using a `SharedArrayBuffer` ring buffer, but for 5-band averaging over 1024 bins, the math is ~5 microseconds and does not justify the architecture

One genuine concern with the spec's current design: calling `getByteFrequencyData()` on the main thread in the RAF loop introduces timing jitter — the FFT frame the AnalyserNode computed may be anywhere from 0–128 samples stale (one audio processing quantum = 128 samples ≈ 2.9ms at 44.1 kHz). For mandala visualization, 3ms timing jitter is completely imperceptible. This is not a problem the spec needs to solve.

**The only GC concern** in the spec is the per-band EMA smoothing on a Float32Array: if you pre-allocate the arrays (smoothed values, raw FFT buffer) in the constructor and reuse them every frame, there is no GC pressure. The spec does not specify this but it should be enforced in implementation.

**Verdict:** ✅ Spec is current

**Recommendation:** Confirm in `MandalaAudioEngine.ts` that the FFT output buffer (`Uint8Array`) and smoothed band values are allocated once in the constructor. Add a code note: `// Pre-allocated — never reassign inside the RAF tick`. No architectural change needed.

---

### 3. Web Audio API Safari / iOS Limitations

**Spec says:** `captureStream()` is not supported on Safari (any version). Mentions Safari iOS 16 and older have stricter AudioContext resume requirements. Recommends creating the AudioContext after `getUserMedia` resolves on Safari iOS.

**2026 SOTA — critical additions the spec is missing:**

**captureStream:** Confirmed still unsupported as of May 2026 (Safari Technology Preview 243/244 release notes contain no captureStream work). WebKit Bug 181663 (canvas captureStream freezes on MediaRecorder stop) is unresolved. The spec's detection check (`typeof canvas.captureStream !== 'function'`) is correct — but note that some WebKit builds expose `captureStream` as a function that returns a non-functional stream without throwing. A defensive check should test `typeof canvas.captureStream === 'function' && canvas.captureStream !== null` and also guard the resulting stream's track count: if `stream.getVideoTracks().length === 0` after calling `captureStream(30)`, treat it as unsupported.

**MediaRecorder format:** Safari only supports MP4 + H.264 + AAC in MediaRecorder. It does NOT support `video/webm; codecs=vp9,opus`. The spec's `{ mimeType: 'video/webm; codecs=vp9,opus' }` will throw a `NotSupportedError` on Safari. The correct guard is `MediaRecorder.isTypeSupported()` before constructing — falling back to `video/mp4` on Safari. This is not mentioned in the spec and is a real bug for Safari desktop users (who have no captureStream issue, but who will hit this mimeType failure).

**Audio output routing on iOS:** When `getUserMedia({ audio: true })` is active, iOS Safari reroutes audio output from headphones/Bluetooth to the built-in speaker. This affects file-source playback (the user hears the audio file through the phone speaker while they expected headphones). This is a known WebKit bug with no fix. The spec should acknowledge this and recommend displaying a warning if the mic source is active while a file source is playing audio.

**Multiple getUserMedia calls:** If `startMic()` and `startFile()` share the same AudioContext and the user switches sources, triggering a second `getUserMedia` call while a prior stream is active causes the previous track's `muted` to be silently set `true` in WebKit. `MandalaAudioEngine.stop()` must explicitly stop all previous stream tracks (`track.stop()`) before calling `getUserMedia` again.

**getUserMedia in non-Safari iOS browsers (Chrome, Firefox on iOS):** As of 2026, Chrome and Firefox on iOS still use WKWebView, and `getUserMedia` is not reliably exposed in WKWebView contexts without explicit entitlement from the embedding app. For progressive web app contexts (direct Safari browser), getUserMedia works. For apps embedded in Chrome iOS, it may silently fail. The spec does not mention this.

**AudioContext user gesture — current state:** The spec correctly states that AudioContext must be created inside a user gesture handler. The additional detail that still applies in 2026: on Safari iOS, `audioContext.resume()` must also be called within the same synchronous gesture handler call stack — not in a `.then()` of a promise initiated from a gesture. The spec's recommendation to await `audioContext.resume()` after `getUserMedia` resolves is correct but the timing is tight. Best practice: call `audioContext.resume()` synchronously inside the button click handler before awaiting `getUserMedia`.

**Verdict:** ⚠️ Better approach exists (the spec covers the surface-level limitation but misses several edge cases)

**Recommendation:** Add to spec / implementation notes:
1. After `captureStream(30)`, check `stream.getVideoTracks().length > 0` before proceeding
2. Use `MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')` and fall back to `'video/mp4'` for Safari desktop
3. Add iOS speaker-routing warning when mic active + file playing
4. Call `audioContext.resume()` synchronously in the click handler, not in the `getUserMedia` promise chain
5. Stop all prior stream tracks explicitly before re-calling `getUserMedia`

---

### 4. WebCodecs for Recording (MP4)

**Spec says:** Uses `MediaRecorder` → WebM (VP9+Opus). Mentions a future "Convert to MP4" step using existing `WebCodecsVideoEncoder` infrastructure. Phase 7 scope is WebM only; MP4 post-transcode is deferred.

**2026 SOTA:**
WebCodecs is now significantly more mature than the spec implies for a "future" deferral:

- **Safari 26** (shipping fall 2026 — currently in beta as of WWDC25) adds full WebCodecs support including `AudioEncoder`/`AudioDecoder`. Prior Safari versions (16.4–25) had partial VideoEncoder/VideoDecoder only.
- **Chrome 94+, Edge 94+, Firefox 130+ desktop** — full support
- **Firefox Android** — still no WebCodecs (VideoDecoder shows as undefined)
- **`canvas-record` v5.5.1** (npm, last published ~2 months ago) wraps WebCodecs + a muxer to record canvas → MP4/WebM/AV1 with a simple API. It supports live recording via `duration: Infinity` + manual `stop()`. It is WebCodecs-first with a MediaRecorder fallback, not the reverse.

The key finding: the spec's "WebCodecs post-transcode (future)" framing treats WebCodecs as cutting-edge. As of 2026, WebCodecs-to-MP4 is the standard recommended path for canvas recording in new projects. `MediaRecorder` → WebM is the legacy path, not the other way around.

However, for **live** audio-reactive recording (the primary Phase 7 use case), there is a meaningful distinction:
- `MediaRecorder` + `captureStream` is a single-call pipeline where the browser handles frame capture timing automatically
- WebCodecs requires explicitly calling `new VideoFrame(canvas, { timestamp })` each RAF tick, which puts frame capture in the developer's hands

For the audio-reactive mandala, this is fine — the RAF loop is already running. `canvas-record` wraps this into a clean API.

**The real problem with `MediaRecorder` → WebM:** WebM is not uploadable to Instagram/TikTok/iMessage (as the spec correctly notes). The spec's answer is "use ffmpeg." A better answer for a product shipping to festival performers is: use WebCodecs → MP4 directly, with MediaRecorder as a fallback for Firefox Android. The infrastructure is already in the codebase (`WebCodecsVideoEncoder`).

**Verdict:** ⚠️ Better approach exists

**Recommendation:** Promote the WebCodecs MP4 path from "future" to Phase 7 scope. Proposed architecture:
- Primary: WebCodecs → MP4 (Chrome, Edge, Safari 26, Firefox desktop)
- Fallback: MediaRecorder → WebM (Firefox Android, anything that fails `VideoEncoder` construction)
- Detection: `typeof VideoEncoder !== 'undefined'` before choosing path
- Use `canvas-record` v5.5.1 or the existing `WebCodecsVideoEncoder` rather than hand-rolling muxer integration
- The spec's `captureStream` + MediaRecorder architecture should become the fallback path, not the primary

---

### 5. FFT Windowing

**Spec says:** "The default is Blackman-Harris." (`AnalyserNode` smoothingTimeConstant set to 0, windowing is whatever the node applies by default.)

**2026 SOTA:**
The spec has a terminology error. The Web Audio API spec and MDN both state the AnalyserNode applies a **Blackman** window — not Blackman-Harris. These are related but distinct:
- **Blackman:** 3-term window, ~−58 dB sidelobe attenuation, main lobe width ~6 bins
- **Blackman-Harris:** 4-term generalization, ~−92 dB sidelobe attenuation, main lobe width ~8 bins

The Blackman window is a member of the Blackman-Harris family, but calling the AnalyserNode's window "Blackman-Harris" is incorrect. The W3C Web Audio API 1.1 spec (current) reads: "A Blackman window is applied to the time domain input data before the FFT transform is computed."

**There is no window function selection.** The Web Audio API v2 issue tracker has an open proposal (Issue #19) to add Hann and Hamming window options, but it has not shipped in any browser as of May 2026.

For the 5-band energy averaging the spec describes (averaging byte magnitudes across bin ranges), the exact window function choice has minimal practical impact on the output. Blackman's sidelobe attenuation is sufficient.

**Verdict:** ⚠️ Spec is slightly inaccurate (minor)

**Recommendation:** Change "Blackman-Harris" to "Blackman" in the spec and any code comments. The practical behavior is correct; only the name is wrong. No code changes needed — there is no API to select a window, and the Blackman window is the right choice for this use case.

---

### 6. Audio-Reactive Visualization Libraries

**Spec says:** Hand-rolled FFT → parameter mapping pipeline (no third-party library for the mapping layer itself).

**2026 SOTA:**
The main candidates for replacing the hand-rolled approach:

**p5.sound / p5.FFT** — provides `analyze()` returning 0–255 byte values across frequency bins and `getEnergy(lowHz, highHz)` for direct band energy extraction. However, p5.sound ships the entire p5.js dependency. Not appropriate for this codebase.

**Meyda.js** — the most relevant library. Features: `energy`, `spectralCentroid`, `spectralFlux`, `mfcc`, `loudness`, RMS, and more. Works with `AudioWorklet` or `ScriptProcessorNode`. However, adding Meyda to extract 5 band energy averages would import a 40KB+ library to replace ~30 lines of bin-averaging code. The overhead is not justified.

**Tone.js FFT** — `Tone.FFT` and `Tone.Meter` wrap AnalyserNode and expose `getValue()` returning decibel arrays. Tone.js is a large dependency (~300KB) and already in the project if used elsewhere, but not appropriate to add solely for FFT mapping.

**Web-Onset** — experimental GitHub repo by Keavon for onset detection in Web Audio API. Small and focused but not published to npm and appears unmaintained.

The consensus for hand-rolled 5-band energy extraction: the spec's approach (AnalyserNode → bin range average → EMA) is exactly what library implementations do internally. None of the libraries add enough value over the ~80 lines in `audio-band-extractor.ts` to justify a dependency.

**Verdict:** ✅ Spec is current

**Recommendation:** No library needed. The hand-rolled approach is appropriate for this narrow use case. The spec should confirm that `audio-band-extractor.ts` pre-allocates its `Uint8Array` output buffer to avoid GC churn (same note as topic 2).

---

### 7. Microphone Permissions UX

**Spec says:** "Mic permission: browser permission prompt fires on first 'Mic' activation. If denied, show an inline error state ('Microphone access denied — check browser permissions')."

**2026 SOTA:**
Chrome's own research on permission prompt acceptance rates establishes a clear best practice: **explain why before triggering the prompt**. The browser's native permission dialog appears once, and if the user clicks "Block," future calls to `getUserMedia` will reject with `NotAllowedError` without showing the prompt again (until the user manually resets site permissions). Recovery from a blocked permission is non-obvious to non-technical users.

Key UX considerations the spec doesn't cover:

1. **Pre-prompt explanation:** Show a callout before the button triggers `getUserMedia`: "Tap 'Allow' when the browser asks — your mic is used for real-time visualization only and is never recorded or transmitted." This is the pattern that most improves accept rates.

2. **Distinguish permission states:** `getUserMedia` rejects with `NotAllowedError` for both "user clicked Deny" and "permissions were already blocked at OS level." These require different recovery UX:
   - Denied this session: "Click 'Allow' in the browser prompt that appears"
   - Already blocked: "Open browser settings → Site permissions → Microphone and allow [site]"
   - On macOS, non-Safari browsers need OS-level permission: "Open System Settings → Privacy & Security → Microphone"

3. **Persistent permissions:** Chrome/Edge: permission persists across sessions. Firefox: may re-prompt. Safari: permissions reset on each new page load. The spec's current error message is correct but single-state — implement `NotAllowedError` code branching.

4. **`Permissions-Policy` header check:** If the page is embedded in an iframe or the host sets `Permissions-Policy: microphone=()`, `getUserMedia` will fail with `NotAllowedError`. The error message should note "microphone access may be blocked by your hosting environment" as a fallback.

**Verdict:** ⚠️ Better approach exists

**Recommendation:** Add a pre-prompt informational state to the Mic button flow (a small tooltip or inline callout that appears the first time the user clicks Mic, before `getUserMedia` fires). Expand the error handler to distinguish between blocked-this-session and already-blocked-at-browser states based on `error.name === 'NotAllowedError'` vs checking `navigator.permissions.query({ name: 'microphone' })` state.

---

### 8. EMA Smoothing

**Spec says:** Per-band EMA (`smoothed = smoothed * alpha + raw * (1 - alpha)`). Global alpha slider 0–0.95, per-band alpha multipliers. `AnalyserNode.smoothingTimeConstant = 0` (manual smoothing).

**2026 SOTA:**
EMA is the correct choice for this use case. The main alternatives and why they don't fit:

**Kalman filter:** Optimal for Gaussian noise with a known process model. Significantly more complex to implement (requires noise covariance matrices). For audio band energies — which are not Gaussian and have no predictable "process" — Kalman adds complexity without accuracy gains. One study shows double EMA runs 135× faster than Kalman with equivalent prediction accuracy in many real-world signal contexts.

**Median filter:** Good for spike rejection (impulsive noise), but adds a fixed latency equal to half the window length. For a 5-sample median, that's 2.5 frame delay (~42ms at 60fps). Not appropriate for a responsive visualization.

**1€ Filter (One Euro Filter):** This is genuinely better for visualization smoothing than plain EMA in one specific way: it adapts its smoothing weight dynamically based on signal velocity. At low speeds (stable signal), it applies heavy smoothing to kill jitter. At high speeds (fast transient), it reduces smoothing to track the signal responsively. It uses two parameters (`minCutoff`, `beta`) that are more intuitive than tuning `alpha` directly. The filter is a single-pass computation (two EMA layers), costs the same as EMA, and has a JavaScript reference implementation (casiez/OneEuroFilter on GitHub, 50 lines). The main use case in the literature is pointer/cursor smoothing, but the frequency-tracking problem for audio bands is the same problem.

**For the spec's per-band alpha modifiers:** The spec's approach of applying `globalAlpha * 0.7` for highs and `globalAlpha * 1.1` for sub-bass is a manual approximation of the 1€ filter's adaptive behavior (highs change faster, so they need less smoothing). The 1€ filter would handle this automatically per-band based on observed rate-of-change, eliminating the need for the hardcoded multiplier table.

**Verdict:** ⚠️ Better approach exists (optional upgrade)

**Recommendation:** EMA is correct and sufficient. If the spec wants to simplify the per-band alpha multiplier table and get better transient tracking for free, replace EMA with a 1€ filter per band. This is a ~50-line addition (`one-euro-filter.ts`) and removes the hardcoded `globalAlpha * [0.7..1.1]` multiplier constants. Not a blocking change — EMA with the multipliers works fine — but it's the 2026 SOTA for this exact problem. Flag as a "nice to upgrade" in `spectral-flux-detector.ts` or `audio-band-extractor.ts` comments.

---

## Summary Table

| # | Topic | Verdict | Priority |
|---|-------|---------|----------|
| 1 | Beat detection (spectral flux) | ⚠️ Correct algorithm, minor refinements | Low |
| 2 | AudioWorklet vs AnalyserNode | ✅ Spec is current | — |
| 3 | Safari / iOS limitations | ⚠️ Missing 4 edge cases | **High** |
| 4 | WebCodecs for MP4 recording | ⚠️ WebCodecs should be primary, not future | **High** |
| 5 | FFT windowing (Blackman name) | ⚠️ Minor terminology error | Low |
| 6 | Audio-reactive libraries | ✅ Hand-roll is correct | — |
| 7 | Microphone permissions UX | ⚠️ Pre-prompt + error branching needed | Medium |
| 8 | EMA smoothing | ⚠️ 1€ filter is a clean upgrade (optional) | Low |

---

## Blocking Issues Before Implementation

Two findings require spec edits before work starts:

**1. Safari MediaRecorder mimeType bug (Topic 3):** The `{ mimeType: 'video/webm; codecs=vp9,opus' }` passed to `MediaRecorder` will throw `NotSupportedError` on Safari desktop (even without the captureStream issue). This will break recording for Safari desktop users who are not on iOS. Requires `MediaRecorder.isTypeSupported()` guard + MP4 fallback.

**2. WebCodecs MP4 path scope (Topic 4):** The spec defers WebCodecs MP4 to "future phase." Given that `WebCodecsVideoEncoder` already exists in the codebase and WebCodecs is now supported in Chrome, Edge, Firefox desktop, and Safari 26 beta, shipping WebM-only is a poor UX decision for a feature explicitly called "festival projection material." The WebM → ffmpeg tooltip will be ignored by 95% of performers. Recommend promoting WebCodecs MP4 to Phase 7 scope with WebM as the fallback.

---

## Sources

- [Essentia.js ISMIR transactions](https://transactions.ismir.net/articles/10.5334/tismir.111)
- [Meyda audio features](https://meyda.js.org/audio-features.html)
- [Meyda spectral flux issue #30](https://github.com/meyda/meyda/issues/30)
- [Web Audio API performance notes](https://padenot.github.io/web-audio-perf/)
- [AudioWorklet design pattern — Chrome Developers](https://developer.chrome.com/blog/audio-worklet-design-pattern/)
- [AudioWorklet low-latency processing — DEV Community](https://dev.to/omriluz1/audio-worklets-for-low-latency-audio-processing-3b9p)
- [W3C Web Audio API 1.1](https://www.w3.org/TR/webaudio-1.1/)
- [Safari iOS getUserMedia speaker routing — Medium](https://medium.com/@python-javascript-php-html-css/ios-safari-forces-audio-output-to-speakers-when-using-getusermedia-2615196be6fe)
- [PWA iOS limitations 2026 — magicbell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [MediaRecorder API WebKit blog](https://webkit.org/blog/11353/mediarecorder-api/)
- [WebCodecs MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [WebCodecs browser support — TestMu](https://www.testmuai.com/learning-hub/webcodecs-browser-support/)
- [WebCodecs canvas to MP4 — devtails](https://devtails.xyz/adam/how-to-save-html-canvas-to-mp4-using-web-codecs-api)
- [canvas-record npm](https://www.npmjs.com/package/canvas-record)
- [canvas-record GitHub — dmnsgn](https://github.com/dmnsgn/canvas-record)
- [WebCodecs Safari 26 — WWDC25 WebKit blog](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)
- [WebCodecs AV1/H265 codec support 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/)
- [AnalyserNode customizable window issue — Web Audio API v2](https://github.com/WebAudio/web-audio-api-v2/issues/19)
- [AnalyserNode fftSize — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize)
- [Blackman window — dsprelated](https://www.dsprelated.com/freebooks/sasp/Blackman_Harris_Window_Family.html)
- [Spectral flux onset — realtime-bpm-analyzer](https://github.com/dlepaux/realtime-bpm-analyzer)
- [getUserMedia best practices 2026 — addpipe](https://blog.addpipe.com/getusermedia-getting-started/)
- [Microphone permission UX — digitalthriveai](https://digitalthriveai.com/en-us/resources/docs/ui-ux/get-microphone-permission/)
- [EMA vs Kalman — Brown University](https://cs.brown.edu/people/jlaviola/pubs/kfvsexp_final_laviola.pdf)
- [One Euro Filter — casiez GitHub](https://github.com/casiez/OneEuroFilter)
- [One Euro Filter explanation — jaantollander](https://jaantollander.com/post/noise-filtering-using-one-euro-filter/)
- [SharedArrayBuffer AudioWorklet ring buffer — loke.dev](https://loke.dev/blog/stop-allocating-inside-audioworkletprocessor)
- [canvas captureStream Safari WebKit bug 181663](https://bugs.webkit.org/show_bug.cgi?id=181663)
- [captureStream Safari compat update — MDN BCD PR](https://github.com/mdn/browser-compat-data/pull/4440)
