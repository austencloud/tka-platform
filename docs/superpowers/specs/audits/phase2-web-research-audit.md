# Phase 2: Trails — Web Research Audit

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase2-trails-design.md`
**Audit date:** 2026-05-25

---

## Findings

### 1. SVG Ghost Layering (Stacked SVG Elements with Decreasing Opacity)

**Spec says:** Stack 8–15 `<svg>` elements in the DOM via `{@html}` with inline `opacity` values, `pointer-events: none`, absolutely positioned. Treat SVG stacking as acceptable because "browser SVG rendering at the mandala's scale (~600px) is cheap per element."

**2026 SOTA:** The spec's concern about cumulative GPU fill rate is well-founded. Stacking transparent SVG layers creates compositing layers; browsers composite each layer separately before merging. With 8–15 ghost SVGs each potentially triggering their own stacking context (they will, since `opacity < 1` always creates one), this becomes 8–15 separate paint/composite passes for every animation frame. At 600px, each SVG is a ~360,000px fill area; 15 × 360,000 = 5.4M px of overdraw per frame.

The spec's mitigation (stripping glow filters from ghost frames) is correct and necessary. With filters stripped, the ghost layers reduce to pure alpha compositing — which browsers handle in GPU fast paths. This is the right call.

`CSS content-visibility: auto` is **not applicable** here. It applies to off-screen elements to skip layout/paint for below-the-fold content. All ghost frames are on-screen and stacked in the same viewport region, so `content-visibility` provides zero benefit and would actively harm rendering by disrupting the stacking context.

`OffscreenCanvas` compositing would be a valid alternative for the ghost stack: render all ghost SVGs to an OffscreenCanvas in a Worker, composite them there, and transfer a single ImageBitmap to the main thread. However, SVG rendering inside Workers is not supported (Workers have no DOM access; `drawImage` of SVG requires a main-thread `Image` element). OffscreenCanvas cannot replace this SVG pipeline.

A Canvas 2D approach — capturing each ghost as an `ImageBitmap` via `createImageBitmap(blob)` and compositing onto a single `<canvas>` — would reduce the DOM from N SVG elements to 1 canvas element. This is genuinely more GPU-efficient (one compositing layer instead of N), but requires migrating away from `{@html}` SVG injection and managing canvas state manually. The spec explicitly lists "Canvas-based trail compositing" as a non-goal, and the tradeoff is reasonable at N=8–15 on a 600px canvas.

**Verdict:** ⚠️ Better approach exists (single canvas compositing), but the spec's mitigation (suppress glow filters) closes most of the gap. The spec's choice to stay SVG is defensible given the non-goal declaration and acceptable scale. The spec does not mention `will-change: transform` — adding `will-change: opacity` to `.ghost-frame` is explicitly avoided (the spec says "No will-change: opacity") but for the correct reason: opacity is set once statically per render, not animated. This is correct.

**Recommendation:** No change required to the architecture, but add an explicit note that glow suppression is mandatory for performance (it's load-bearing, not optional). If the feature ever allows `trailLength > 12` on mobile, revisit the canvas fallback at that point.

---

### 2. SVG Filter ID Collisions

**Spec says:** Strip both the `filter="url(#glow)"` reference and the `<filter id="glow">` definition from ghost SVGs. Rationale: "SVG ID resolution is undefined when IDs collide — browsers typically resolve to the first definition encountered."

**2026 SOTA:** The spec's analysis is confirmed correct and importantly understated. Browser behavior for duplicate inline SVG filter IDs is not just "undefined" — it is actively broken in documented and reproducible ways:

- Mozilla Bugzilla #835709 (open): Filter visibility is controlled by whichever SVG first declares the ID. When that controlling SVG is removed from the DOM or hidden, all other SVGs referencing the same ID lose their filter rendering — they don't fall back, they simply render without the filter or break entirely.
- The first-definition-wins behavior means ghost SVGs (rendered before the live frame in DOM order) would shadow the live frame's glow filter — which is the exact opposite of what the spec wants.

CSS `@scope` does not help here: `@scope` is a CSS selector scoping mechanism, not a DOM ID namespace. SVG `id` attributes are part of the document's global ID namespace regardless of CSS scope.

Shadow DOM would theoretically encapsulate SVG IDs (each shadow root is a separate ID scope), but injecting `{@html}` content into a shadow root requires manual Shadow DOM creation — not compatible with Svelte's template system without substantial plumbing.

The spec's solution — omit both the `<filter id="glow">` definition and the `filter="url(#glow)"` reference from ghost SVGs — is the correct, minimal, and battle-tested fix. The `maskIdCounter` approach (unique IDs per SVG) would also work for the glow filter but is unnecessary complexity when ghosts don't need glow at all.

**Verdict:** ✅ Spec is current. The ID collision risk is real, documented, and the spec's suppression strategy is the right fix. No change needed, though the spec could strengthen the language: the collision isn't just "undefined" but specifically causes filter rendering to break based on DOM insertion order.

**Recommendation:** Tighten the spec language to cite the confirmed behavior: ghost SVGs inserted before the live frame in DOM order would shadow the live frame's `id="glow"` definition, breaking the live frame's glow. This makes the suppression requirement feel load-bearing rather than precautionary.

---

### 3. requestAnimationFrame for Ghost Capture

**Spec says:** Use `requestAnimationFrame` for the unified animation tick. Motion-threshold sampling (`MIN_DX_DELTA`, `MIN_ROT_DELTA`) reduces actual ghost captures to ~5/sec. Considers RAF "the existing `colorRafId` loop."

**2026 SOTA:** `scheduler.postTask()` and `scheduler.yield()` are not relevant replacements here. Their purpose is breaking up long synchronous tasks to yield the main thread for higher-priority work (user input, rendering). They are task schedulers, not animation frame primitives.

For visual animations that must sync with browser repaints, `requestAnimationFrame` remains the correct and only appropriate primitive in 2026. RAF fires immediately before the browser's paint step, which is exactly what's needed to capture state that matches what the user will see. Neither `postTask` nor `yield` integrates with the rendering pipeline this way.

Browser support: `scheduler.postTask` — Chrome/Edge/Firefox, no Safari. `scheduler.yield()` — Chrome/Firefox since August 2025, no Safari. Both are currently Safari-blocked, which alone disqualifies them for this use case.

Web Animations API (`element.animate()`) is not applicable — it drives CSS property animations, not arbitrary JS state.

The spec's motion-threshold sampling is a correct optimization. Sampling on state delta (tipDx, rotationDeg) rather than every frame is more physically appropriate than time-uniform sampling and avoids unnecessary SVG renders during slow/paused motion.

**Verdict:** ✅ Spec is current. RAF is still the right primitive for animation frame capture in 2026. The scheduler APIs are task schedulers for INP optimization, not animation frame replacements.

**Recommendation:** No change. The unified RAF loop approach is correct. If a future optimization pass wants to move `renderMandalaSVG` calls off the main thread (since SVG string generation is pure computation), `scheduler.postTask` with `priority: "background"` could queue non-urgent ghost renders — but that's a separate optimization, not a Phase 2 concern.

---

### 4. Opacity-Based Trail Rendering (vs. GPU-Accelerated Alternatives)

**Spec says:** Render ghost SVGs with static `opacity` values on `div.ghost-frame`. Produce a "long-exposure photography effect." No blend modes, no backdrop-filter, no WebGL.

**2026 SOTA:** Two GPU-accelerated alternatives are worth examining:

**`mix-blend-mode: screen` on ghost frames:** The `screen` blend mode mathematically mirrors long-exposure photography (light accumulates, darks drop out). Applied to ghost divs over a dark background, `mix-blend-mode: screen` would produce a more luminous, physically accurate trail than `opacity` layering — ghosts would brighten each other at overlap zones rather than muddy to grey. The mandala's Flow mode palette (saturated colors on a dark background) is ideal for screen blending. Browser support is universal (Chrome, Firefox, Safari, Edge — all evergreen). The performance cost is comparable to opacity compositing for SVG layers; both are GPU-composited.

However, the spec's background is configurable (the user can set a light background color). `mix-blend-mode: screen` would invert on light backgrounds, making ghosts darker rather than lighter. The spec does not constrain the background to dark, so `screen` would require a dark-background guard or break the light-background case.

**`mix-blend-mode: lighten`:** Selects the lighter pixel at each point — less luminous than screen but background-stable in that it at least doesn't invert on light backgrounds. Still not right for light backgrounds.

**CSS `backdrop-filter`:** Not applicable. `backdrop-filter` blurs or color-shifts the content behind an element — used for frosted glass effects. It does not accumulate or trail multiple layers.

**WebGL ping-pong framebuffer:** The canonical GPU approach for long-exposure effects is a "feedback loop" where each rendered frame is multiplied by a decay factor and blended with the new frame. This is exactly the spec's exponential decay curve, but executed on the GPU: one shader pass instead of N SVG elements. This would be far more GPU-efficient than N separate SVG DOM layers — O(1) GPU work regardless of trail length. However, implementing this requires migrating the mandala renderer into a WebGL canvas, which is a substantial architectural change outside this spec's scope.

**Verdict:** ⚠️ Better approach exists for the visual quality dimension. `mix-blend-mode: screen` on `.ghost-frame` elements would produce a more physically correct long-exposure aesthetic (luminous accumulation instead of opacity blending). It's universally supported and costs nothing extra in terms of GPU work. The caveat is that it requires a dark background to look correct, and the spec's background is user-configurable.

**Recommendation:** Consider adding `mix-blend-mode: screen` as a conditional CSS class on `.ghost-layer` that activates only when `bgColor` is dark (luminance < 0.2). This is a 2-line CSS change that dramatically improves the visual quality of the trail against dark backgrounds, which is the primary aesthetic target ("luminous afterimage"). The light-background case can fall back to the current opacity-only behavior. If the design intent is always dark for this feature, simply always apply `screen`.

The WebGL feedback loop is the SOTA for production-quality trails (Three.js `AfterimagePass`, for example, uses this exact technique) but is out of scope for Phase 2 given the existing SVG pipeline.

---

### 5. Export Pipeline: h264-mp4-encoder WASM vs. WebCodecs

**Spec says:** Export uses `h264-mp4-encoder` (WASM) for MP4 encoding, treated as an existing dependency. No mention of WebCodecs.

**2026 SOTA:** The `h264-mp4-encoder` / `mp4-h264` project is **suspended** (confirmed via the project's GitHub README). The author removed H.264 encoding code due to MPEG LA royalty concerns for distributed software. The project is not being maintained.

WebCodecs is now a viable replacement:

- **Chrome/Edge:** Full support since Chrome 94 (2021)
- **Firefox:** Full support since Firefox 130 (2024)
- **Safari:** Full support in Safari 26.0 (macOS/iOS/iPadOS) — shipped 2025/2026. Safari 16.4–18.7 had partial video-only support (VideoEncoder/VideoDecoder but no audio). Safari 26 completes the picture.

The stack for WebCodecs MP4 export is `VideoEncoder` (encodes frames to H.264 NAL chunks) + `mp4-muxer` (pure JS, MIT-licensed, wraps chunks into a valid MP4 container). The `mp4-muxer` library is actively maintained and is the standard pairing. This combination:
- Eliminates the WASM download (~1–2MB for the WASM encoder)
- Uses the browser's native H.264 encoder (hardware-accelerated on most devices)
- Has no MPEG LA royalty exposure (the browser's codec license covers use)
- Is faster than the WASM encoder on hardware that supports H.264 acceleration

The remaining gap: Safari 16.4–18.7 is excluded. These are 2022–2024 Safari versions. As of 2026, these versions are 2–4 years old. Whether they are in the target browser matrix depends on Austen's support policy, but for a creative tool targeting modern devices, Safari 26 is the reasonable floor.

A progressive-enhancement approach — attempt `VideoEncoder.isConfigSupported()`, fall back to WASM if it returns false — provides resilience without dropping old Safari entirely. However, given the WASM project is suspended, the fallback path would require vendoring a snapshot of the old package.

**Verdict:** ❌ Spec is outdated. `h264-mp4-encoder` is a suspended project with royalty concerns. The WebCodecs + `mp4-muxer` stack is now the correct approach and has broad browser support (Chrome, Firefox, Safari 26+). The spec should be updated to reference this stack.

**Recommendation:** Replace `h264-mp4-encoder` with `VideoEncoder` (WebCodecs) + `mp4-muxer`. The export compositing logic in the spec is otherwise correct — the change is only in the final encoding step. Add a `VideoEncoder.isConfigSupported({ codec: 'avc1.42E01E' })` guard to detect environments where H.264 is unavailable (rare in 2026); surface an error rather than silently failing. Do not attempt to fall back to the suspended WASM encoder.

---

## Summary Table

| Topic | Verdict | Action Required |
|---|---|---|
| SVG ghost layering | ⚠️ Better exists (single canvas) | No change at current scale; enforce glow suppression as load-bearing |
| SVG filter ID collisions | ✅ Spec is current | Tighten spec language on confirmed behavior |
| RAF for ghost capture | ✅ Spec is current | No change |
| Opacity-based trail rendering | ⚠️ Better approach exists | Add `mix-blend-mode: screen` for dark backgrounds |
| Export: h264-mp4-encoder WASM | ❌ Spec is outdated | Migrate to WebCodecs + `mp4-muxer` |
