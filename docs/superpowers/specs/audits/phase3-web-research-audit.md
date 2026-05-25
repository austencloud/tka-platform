# Phase 3: Shareable Links — Web Research Audit

**Date:** 2026-05-25
**Spec audited:** `docs/superpowers/specs/2026-05-25-mandala-phase3-shareable-links-design.md`
**Auditor:** Web research pass (7 topics)

---

## Findings

### 1. Web Share API — Desktop Support

**Spec says:** Progressive enhancement: Web Share API first (opens native share sheet on mobile), clipboard fallback on desktop. Consistent with the existing pattern in `SequenceViewerOrchestrator.svelte` line 854.

**2026 SOTA:**
- Chrome desktop (Windows + ChromeOS): **fully supported** since Chrome 89, full support in current versions (132-145).
- Edge desktop: **fully supported**.
- Firefox desktop: **not supported** in any version, including current v151. No implementation on the roadmap.
- Safari desktop (macOS 12.1+): **fully supported**.
- Chrome on Linux: **not supported**.
- Mobile (Chrome Android, Firefox Android, Safari iOS): **full support**.

The progressive enhancement pattern (`if (navigator.share)` → clipboard fallback) correctly handles Firefox and Linux Chrome via the fallback path. The spec's model is accurate: on Windows/macOS Chrome, the native OS share sheet fires; on Firefox, it silently falls through to clipboard copy.

**One nuance not in the spec:** `navigator.share` requires a **transient user activation** (i.e., must be called in direct response to a user gesture). The share must be triggered from the button's click handler — never from a `setTimeout` or async chain that outlives the gesture. If the Firestore write to create the short code takes >a few hundred ms, the gesture may expire before `navigator.share` is called. The spec's flow (Firestore write → then share) risks losing transient activation on slow connections.

**Verdict:** ⚠️ Spec is mostly current, but has a transient-activation timing hazard.

**Recommendation:** Pre-generate the URL before calling `navigator.share`. Either:
- Call `navigator.share` with the `url` field pointing to a pending URL, then create the short code in the background and redirect — but this is complex.
- Simpler: call `navigator.share` **synchronously from the click handler** before the async Firestore write, passing a placeholder URL (`tka.run/...` with a code generated client-side), then write to Firestore using that same code. The `ShortCodeManager` transaction loop already generates the code before the Firestore write; extract code generation out of the write transaction so the URL is available synchronously.
- Minimum viable fix: test on a throttled connection to verify the gesture window isn't expired before the `navigator.share` call, and document the timing dependency in the implementation notes.

---

### 2. Short URL Architecture — Firebase + Firestore

**Spec says:** Reuses existing `shortcodes` Firestore collection, `ShortCodeManager`, and `/q/[code]` landing page. Custom Firestore-backed short codes under `tka.run`.

**2026 SOTA:**
Firebase Dynamic Links shut down permanently on **August 25, 2025** — all links stopped resolving. The spec correctly does **not** use Firebase Dynamic Links; it uses a custom `shortcodes` Firestore collection with a SvelteKit route handler. This is exactly the architecture developers migrated *to* after FDL shutdown.

Alternatives (Branch, AppsFlyer OneLink, Bitly) are appropriate for apps that need attribution, deferred deep linking, and multi-platform install routing. For a self-hosted progressive web app with an existing Firestore infrastructure and no install-funnel attribution requirement, the custom Firestore approach is the right call — lower cost, no vendor dependency, full control.

**Verdict:** ✅ Spec is current. The custom Firestore short code system is the correct post-FDL architecture.

**Recommendation:** None. The spec's reuse of the existing `shortcodes` collection rather than adopting a third-party service is the correct 2026 approach for this project's profile.

---

### 3. Open Graph / Social Preview

**Spec says:** Static per-preset thumbnails (`/images/mandala-previews/{preset}.png`, 7 files, 1200×630). Dynamic per-link OG image generation is deferred as out of scope for Phase 3.

**2026 SOTA:**

**Image dimensions:** The 2026 consensus has shifted to **1200×600 (2:1 ratio)** — Facebook, X/Twitter, LinkedIn, Discord, and Slack all render at 2:1 without cropping. The spec's 1200×630 (1.91:1) is the older Facebook spec. The difference is small (30px) but using 1200×630 will result in slight letterboxing on X/Discord. Use 1200×600.

**Static vs. dynamic:** Dynamic OG images (per-link generated) are the 2026 default for content platforms and get meaningfully higher engagement (visually distinct per-link previews vs. one generic image repeated across all shares). However, the spec's justification for static thumbnails is defensible: mandala previews are preset-scoped (7 presets), not sequence-scoped, so a per-preset static image captures most of the visual differentiation without dynamic infra.

**Dynamic OG images in SvelteKit:** This is well-supported. `@ethercorps/sveltekit-og` v4 (released mid-2025) is a production-ready SvelteKit-native library — it creates a `+server.ts` route, renders HTML/CSS to SVG via Satori, rasterizes to PNG via resvg-wasm, and returns a `Response` with `Content-Type: image/png`. No headless browser, no external service. The route is: `src/routes/og/mandala/+server.ts`. The OG `<meta>` tag on the landing page points to `/og/mandala?preset=aurora&word=BOOK`. The server reads query params and renders a mandala-themed card.

**Impact of per-link dynamic OG:** For mandala sharing, the most compelling social preview would show the actual mandala SVG (or a screenshot thereof) rather than a generic "aurora preset" thumbnail. A link from user A sharing "BOOK Mandala" and user B sharing "CAKE Mandala" would show identical previews under the static approach. Dynamic generation could show the word prominently, the color palette, and a static mandala SVG frame — meaningfully differentiated per share.

**Content-hashed filenames:** The spec calls for `aurora-v1.png` bumped on regeneration. This is correct practice — social platforms (Discord especially) cache OG images aggressively for hours/days. Without cache-busting the filename, updated images don't propagate.

**Verdict:** ⚠️ Better approach exists for both image dimensions and image generation strategy.

**Recommendations:**
1. **Change image dimensions to 1200×600** (2:1) for all 7 static thumbnails. Update the spec.
2. **Reconsider deferring dynamic OG.** `@ethercorps/sveltekit-og` v4 is a ~1 hour add-on and would make each shared mandala link look unique on Discord/X rather than 7 possible static images cycling across all users. Given that viral sharing is the stated goal of Phase 3, per-link previews showing the word (e.g., "BOOK") and the color palette would materially improve click-through vs. a generic preset thumbnail. This is a strong candidate for Phase 3 scope inclusion rather than deferral.
3. If static thumbnails are retained: ensure `twitter:card` is set to `summary_large_image` (the spec does not mention this tag, but the `+page.svelte` head block should include it).

---

### 4. URL State Encoding vs. Backend Storage

**Spec says:** Full mandala settings are stored in the Firestore `shortcodes` document. The short code (6-char base36) is what's shared in the URL.

**2026 SOTA:**

For ~200 bytes of state (the mandala settings object), URL-encoding the entire state is technically feasible — base64url of a JSON or MessagePack blob of 200 bytes produces a ~267-char URL parameter, yielding a total URL like `tka.run/m?s=<267chars>`. This is long but within browser URL limits (~2000 chars).

**Trade-off analysis:**

| Approach | Pros | Cons |
|---|---|---|
| Firestore-backed short code (spec's choice) | Short URLs (6 chars), scannable QR codes, analytics (scanCount), works offline via snapshot, looks clean in social previews | Requires Firestore write on share, slight latency, Firestore cost per write/read |
| URL-encoded state (no backend) | Zero backend cost, instant share, no Firestore dependency | Long URLs (~300 chars), QR codes use binary mode (larger, less reliable scan), no analytics, no offline snapshot path |

The spec's use-case includes QR codes printed on physical cards (per the `short_code_domain` memory: QR alphanumeric mode, 4-char codes). Long base64url URLs are **incompatible** with alphanumeric QR mode, which is restricted to uppercase alphanumeric + 9 symbols. Base64url uses lowercase letters and `-_=`, all outside alphanumeric mode. Numeric/alphanumeric QR codes scan faster and at greater distances than binary-mode codes.

Additionally, the spec explicitly preserves the offline snapshot path (R2 daily snapshot) — URL-encoded state has no offline equivalent.

**Verdict:** ✅ Spec's Firestore-backed approach is correct for this project's requirements.

**Recommendation:** None on architecture. The QR compatibility requirement alone rules out the URL-encoding alternative. Document this rationale in the spec's Design Decisions section if it isn't already (it isn't currently — adding a note to section 1 or a new "Why not URL-encoded state?" section would prevent future revisitation).

---

### 5. Firestore Security Rules — Rate Limiting

**Spec says:** Validation rules whitelist `type` values, validate the `mandala` sub-object shape, enforce numeric ranges, and validate hex color patterns.

**2026 SOTA:**

Firestore security rules **do not support native rate limiting**. A feature request for this has been open since 2018 with no implementation. There is no `request.time` count-based or per-user write-rate primitive in security rules.

The current state of rate limiting for Firestore UGC writes in 2026 is:
1. **Application-level throttle** — enforce per-user limits in the client or in a Cloud Function intermediary; don't allow direct client writes if rate enforcement is critical.
2. **Cloud Firestore quotas** — project-level limits (default: 1 write/second per document; 10,000 writes/second per database) don't help with per-user abuse.
3. **App Check** — Firebase App Check verifies requests come from your app (not bots/scripts), which is the closest thing to spam prevention at the rules layer. Not rate-limiting, but blocks automated abuse.
4. **Cloud Functions intermediary** — route short code creation through a Cloud Function, which can implement per-user rate limiting (e.g., using a counter document or Cloud Tasks with quotas).

The spec's validation rules (type whitelist, field shape, numeric range, hex pattern) are correct and sufficient for data integrity. The gap is **abuse prevention**: a malicious authenticated user could create thousands of short codes, filling the `shortcodes` collection and driving up Firestore costs.

**Verdict:** ⚠️ The spec's rules are correct but incomplete — they validate shape, not rate.

**Recommendation:** For Phase 3, add one of the following (in order of implementation cost):
1. **App Check** (lowest cost): Enable Firebase App Check with reCAPTCHA v3 or DeviceCheck. This blocks bot-level abuse without touching rules. Already a Firebase-native feature; ~1 day to add.
2. **Per-user write limit via a counter document** (moderate cost): Add a Firestore rule that checks a `users/{uid}/mandala_share_count` document and blocks creation if count exceeds N per day. Requires a companion Cloud Function to increment the counter and a TTL reset mechanism.
3. **Cloud Function intermediary** (highest cost): Move `createMandalaShortCode` to a Cloud Function, implement server-side rate limiting there. Removes direct client write to `shortcodes`.

App Check alone is likely sufficient for Phase 3 given the feature is Scribe-only (authenticated, paid users are unlikely to spam).

---

### 6. QR Code Generation

**Spec says:** Short codes use `tka.run` with alphanumeric QR mode (per `reference_short_code_resolution` and `project_short_code_domain` memory). No mention of in-app QR code generation for mandala links in Phase 3.

**2026 SOTA:**

The JavaScript QR code library landscape in 2026:
- **qr-code-styling** — most popular for styled QR codes; supports centered logos, custom dot shapes, colors, gradients; browser-native (Canvas/SVG); no jQuery dependency.
- **@qr-platform/qr-code.js** — TypeScript-first, comprehensive styling including shapes, gradients, logos; generates SVG or Canvas; actively maintained 2025-2026.
- **qrcode.js (davidshimjs)** — lightweight, no dependencies, basic QR; no logo support.
- **qrious** — pure JS, Canvas-based, minimal; no logo support.

For TKA's QR codes: the `project_short_code_domain` memory specifies QR alphanumeric mode for short codes (uppercase base36 + space only). This remains valid — alphanumeric mode produces denser, faster-scanning codes than binary mode.

**The spec is silent on in-app QR display for mandala links.** The share flow ends at clipboard/Web Share; there's no "Show QR code" affordance for someone wanting to share in-person (e.g., at a festival showing their phone to someone else to scan).

**Verdict:** ✅ Spec is current on QR infrastructure (alphanumeric mode, tka.run). ⚠️ Missing affordance for the in-person sharing use case.

**Recommendation:** Consider adding a "Show QR" toggle to the Share button's success state. Tapping Share generates the short code → shows QR code inline below the button (using qr-code-styling, ~8KB gzipped) → recipient scans to open the mandala. This is a one-screen, no-extra-install share flow ideal for the festival/in-person context where TKA's user base lives. Low implementation cost relative to Phase 3 scope.

---

### 7. Deep Linking / App Links (Capacitor)

**Spec says:** "Capacitor deep link routing: `tka.run/{code}` redirects trigger the Capacitor App Link handler... Out of scope for Phase 3, but must be noted in the Capacitor Phase 2 spec." (Section Open Questions, item 3)

**2026 SOTA:**

Capacitor deep linking via Android App Links and iOS Universal Links is well-documented and production-stable. The standard pattern is:

```ts
App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
  const path = new URL(event.url).pathname; // e.g. "/q/ABC123"
  // Route based on path
});
```

For mandala codes specifically, the discriminator is the Firestore doc `type` field — the native app needs to fetch the doc (or read from the local snapshot) to know whether to route to the sequence player or the mandala viewer. Alternatively, the landing page could use a URL prefix (e.g., `/q/m-ABC123` for mandala codes) to allow routing without a Firestore read, but the spec deliberately avoids a separate namespace (`/m/[code]`).

**PWA `handle_links`:** The web manifest `handle_links` member allows PWAs to capture links within their scope in Chromium browsers. If TKA ships as a PWA (not just Capacitor), adding `"handle_links": "preferred"` to the manifest ensures `tka.run/q/ABC123` opens in the installed PWA rather than the browser tab on Android Chrome.

**Web Share Target:** The `share_target` manifest member would allow TKA to appear as a share destination (someone sharing a URL from another app could share it to TKA to open it). This is likely out of scope but worth tracking.

**Verdict:** ✅ Spec correctly defers Capacitor routing to Phase 2. The deferral is justified — Phase 3 is web-first.

**Recommendation:** When writing the Capacitor Phase 2 spec, include:
1. `App.addListener('appUrlOpen')` discriminating on `type` field (requires Firestore read or snapshot lookup before routing).
2. Consider using `resolve_short_code_full` (the same method added in Phase 3) in the native handler so the discriminator logic is shared.
3. Add `"handle_links": "preferred"` to the web manifest as part of Phase 3 — this is a 1-line change and improves the PWA experience even before Capacitor native builds.

---

## Summary Table

| Topic | Verdict | Priority |
|---|---|---|
| Web Share API desktop support | ⚠️ Transient-activation timing hazard | Must fix before ship |
| Firebase / short URL architecture | ✅ Correct | No action |
| OG image dimensions (1200×630 → 1200×600) | ⚠️ Use 2:1 ratio | Fix thumbnails at creation time |
| Dynamic vs. static OG images | ⚠️ Consider dynamic OG for viral growth | Strong Phase 3 candidate |
| URL-encoded state vs. Firestore | ✅ Firestore is correct | Document rationale in spec |
| Firestore rate limiting | ⚠️ App Check gap | Add App Check (1 day) |
| QR code for in-person sharing | ⚠️ Missing affordance | Nice-to-have for Phase 3 |
| Capacitor deep link deferral | ✅ Correct | Note PWA handle_links (1 line) |

---

## Top 3 Changes to Make Before Implementing

1. **Fix the Web Share transient-activation hazard.** Generate the short code (and thus the URL) synchronously before calling `navigator.share`, or restructure `ShortCodeManager.createMandalaShortCode` to return a deterministic code before the Firestore write completes. Otherwise the native share sheet may silently fail on mobile after a slow Firestore write.

2. **Use 1200×600 (2:1) for OG thumbnails.** All 7 static thumbnails should be generated at this ratio. 1200×630 will show letterboxing on X and Discord. This must be set before any thumbnails are created — regenerating after-the-fact with a version bump on the filenames is the recovery path.

3. **Decide on dynamic OG before scoping Phase 3 out.** `@ethercorps/sveltekit-og` v4 is ~1 day of implementation. Given that the spec's stated goal is viral sharing, a per-link preview that shows the sequence word and color palette in every Discord/X unfurl is a direct lever on the viral coefficient. Punting this to Phase 4 means the Phase 3 shares land with a generic preset image — seven possible thumbnails cycling across all users' shares.

---

## Sources

- [Web Share API — Can I use](https://caniuse.com/web-share)
- [Navigator: share() method — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- [Web Share API browser support — Super Web Share](https://superwebshare.com/browsers-support-web-share-api/)
- [Firebase Dynamic Links Deprecation FAQ](https://firebase.google.com/support/dynamic-links-faq)
- [Firebase Dynamic Links alternatives 2026 — HopLinks](https://hoplinks.in/blog/firebase-dynamic-links-alternatives-in-2026-complete-guide/)
- [Firebase Dynamic Links shut down — custom deep link server (Medium)](https://medium.com/@azaikin/firebase-dynamic-links-is-shutting-down-heres-how-i-replaced-it-with-a-custom-deep-link-server-e8dfeb7ec6b3)
- [Complete Guide to Open Graph Images 2026 — OGMagic](https://ogmagic.dev/blog/complete-guide-open-graph-images)
- [Open Graph Protocol 2026 — env.dev](https://env.dev/guides/opengraph)
- [Vercel OG image generation docs](https://vercel.com/docs/og-image-generation)
- [Dynamic OG image with SvelteKit and Satori — DEV Community](https://dev.to/theether0/dynamic-og-image-with-sveltekit-and-satori-4438)
- [sveltekit-og GitHub — etherCorps](https://github.com/etherCorps/sveltekit-og)
- [Announcing sveltekit-og v4 — DEV Community](https://dev.to/theether0/announcing-sveltekit-og-v4-an-alternative-to-vercelog-for-sveltekit-3cg1)
- [Social media preview sizes 2026 — OGMagic](https://ogmagic.dev/blog/social-media-preview-image-sizes)
- [OG image size guide 1200×630 — Screenhance](https://screenhance.com/blog/og-image-size-guide)
- [Firestore best practices — Firebase docs](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore rate limiting feature request — GitHub #647](https://github.com/firebase/firebase-js-sdk/issues/647)
- [Base64URL explained — inventivehq](https://inventivehq.com/blog/base64url-and-base64-variants-explained)
- [QR code JS libraries 2026 — jQuery Script](https://www.jqueryscript.net/blog/best-custom-qr-code-generator.html)
- [qr-code.js GitHub — qr-platform](https://github.com/qr-platform/qr-code.js/)
- [Capacitor deep linking guide](https://capacitorjs.com/docs/guides/deep-links)
- [PWA deep links — Progressier](https://intercom.help/progressier/en/articles/6902113-complete-guide-to-pwa-deep-links)
- [share_target manifest — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)
