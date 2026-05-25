# Audit: Mandala Phase 3 — Shareable Links Design Spec

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase3-shareable-links-design.md`
**Auditor:** Claude Opus 4.6
**Date:** 2026-05-25

---

## VERDICT

**APPROVE WITH REQUIRED CHANGES.** The spec is well-structured and makes correct architectural decisions (reusing `/q/[code]` over a new route, always embedding the encoded blob, using the Firestore `type` discriminator). Three critical issues must be resolved before implementation: the `resolveShortCode` return type change is a breaking API change that affects 4+ callers, the Firestore security rules need updating for the new `mandala` sub-object, and the spec's claim about `+page.server.ts` reading OG tags from the Firestore doc misrepresents the current server load which does NOT read `type`, `mandala`, or `thumbnailUrl` fields.

---

## STRENGTHS

1. **Correct reuse of existing infrastructure.** The decision to stay on `/q/[code]` instead of adding `/m/[code]` is right. The Cloudflare Worker at `tka.run` (`cloudflare/workers/shortcode-redirect.js` line 29) blindly redirects `/{code}` to `/q/{code}` and passes query params through. A new `/m/` prefix would require worker changes and a second redirect path.

2. **Self-contained encoded blob strategy.** Always embedding `encoded` (the `s~...` blob) regardless of `ownerId` is the correct call. The existing code at `ShortCodeManager.ts` line 230 shows `shouldEmbed = options?.embedSequenceData || !sequence.ownerId` — mandala records correctly override this to always-embed, avoiding cross-collection auth dependencies.

3. **Accurate mapping of MandalaPane props.** The spec's `MandalaViewerSettings` interface (section 3) lists 10 fields that directly map to the reactive state variables in `MandalaPane.svelte` lines 23-33: `paused`, `pathShape`, `rotation`, `speed`, `depth`, `colorMode`, `preset`, `customBlue`, `customRed`, `lineWeight`. The 1:1 correspondence is verified.

4. **Correct dedup decision.** Not content-addressing mandala records (unlike sequence records which use `encoderHash`) is correct because the same sequence with different viewer settings must produce different short codes. Open question #1 about composite hashing is a good follow-up.

5. **Service naming compliance.** The spec proposes `MandalaShortCodeCreator` (factory getter) instead of `MandalaShortCodeService`, correctly following the project's service-naming convention.

---

## ISSUES

### Critical

**C1: `resolveShortCode` return type change is a breaking API change with 4+ callers.**

The spec proposes changing `resolveShortCode` to return a union `ShortCodeResolution` instead of `SequenceData | null`. This is a breaking change. Current callers that would break:

- `src/routes/q/[code]/+page.svelte` line 277: `shortCodeManager.resolveShortCode(shortCode)` — expects `SequenceData | null`
- `src/routes/sequence/[id]/+page.svelte` line 371: `shortCodeManager.resolveShortCode(id)` — expects `SequenceData | null`
- `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` line 180: `manager.resolveShortCode(code)` — expects `SequenceData | null`
- Any downstream code that passes the result directly to `hydrateSequence()`

**Recommendation:** Do NOT change `resolveShortCode`'s return type. Instead, add a new method `resolveShortCodeFull(code: string): Promise<ShortCodeResolution>` that returns the union. The `/q/[code]` page calls `resolveShortCodeFull`; all other callers continue using the existing `resolveShortCode` unchanged. Alternatively, add a separate `resolveRawRecord(code: string): Promise<ShortCodeData | null>` that the `/q/[code]` page calls alongside `resolveShortCode` to detect mandala records.

---

**C2: Firestore security rules do not validate the `mandala` sub-object.**

The current `shortcodes/{code}` create rule (`firestore.rules` lines 885-897) validates that either `encoded` or `sequenceData.steps` is present. It does NOT validate:
- The `type` field (anyone could write `type: "admin"` or `type: "<script>"`)
- The `mandala` sub-object structure (arbitrary nested data could be injected)
- Field value ranges (e.g., `mandala.rotation` could be 999999, `mandala.speed` could be -1)

The `mandala` sub-object is read by the server load (`+page.server.ts`) and passed to the client. Without validation, a malicious actor could write arbitrary JSON into the `mandala` field.

**Recommendation:** Add Firestore rules that validate the mandala record shape:
- `type` must be `"mandala"` if present (whitelist)
- `mandala` object keys must be from the known set
- Numeric fields must be within valid ranges
- String fields (hex colors) must match a pattern or be bounded in length

---

**C3: The spec claims `+page.server.ts` already reads OG tags from the Firestore doc — it does, but the current code does NOT read `type`, `mandala`, or `ownerDisplayName` fields.**

The spec (section 3, line 88-103) shows pseudocode for the server load checking `data?.type === "mandala"` and returning `mandalaSettings`. But the actual `+page.server.ts` (lines 28-35) only reads `word`, `sequenceName`, `ownerDisplayName`, `thumbnailUrl`, `deckId`, and `deckName`. The current server load does not reference `type` or `mandala` at all.

This is not a spec error per se (it correctly identifies what needs to change), but the phrasing "The server load already reads the Firestore doc to populate OG meta tags" could mislead an implementer into thinking the branching infrastructure exists. It does not — the server load needs new fields in its return type and the `+page.svelte` Props interface (lines 46-56) needs to accept `isMandala` and `mandalaSettings`.

**Recommendation:** The spec should explicitly note that `+page.svelte`'s `Props` interface must be extended, and the OG meta tags in the `<svelte:head>` block (lines 331-347) need a conditional branch for mandala records.

---

### Important

**I1: No Web Share API integration — missed 2026 state of the art.**

The codebase already uses `navigator.share` in 5+ locations:
- `src/lib/shared/share/services/implementations/Sharer.ts` line 115-140
- `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` line 874
- `src/lib/features/choreo-card/components/ChoreoCardExport.svelte` line 147

The spec describes clipboard-only sharing (section 4, step 3). On mobile, `navigator.share()` with a URL is the expected UX — it opens the native share sheet (Messages, WhatsApp, Instagram DMs, etc.). Clipboard fallback for desktop is correct, but the spec should specify the progressive enhancement pattern: try `navigator.share` first, fall back to clipboard.

The existing `Sharer.ts` at line 115 already implements this exact pattern. The spec should reference it rather than describing a clipboard-only flow.

---

**I2: No handling for deleted/missing sequence data on the receiving end.**

The spec's acceptance criteria say "The sequence resolves from the embedded blob without any authenticated Firestore read." But what happens when:
- The short code document itself is deleted (admin cleanup, abuse removal)
- The `encoded` blob is corrupted or fails to decode
- The sequence steps in the embedded blob reference letter types that have been deprecated

The existing `/q/[code]/+page.svelte` has error handling (line 284-286: "Sequence not found"), but the spec doesn't describe what the mandala landing page shows on error. The `MandalaLandingPane.svelte` (proposed new file) needs its own error state.

**Recommendation:** Add an acceptance criterion: "When a mandala short code cannot be resolved (deleted, corrupted, or decode failure), the landing page shows a clear error state with a link to browse, not a blank page."

---

**I3: The snapshot Cloud Function needs updating and the spec understates this.**

The spec's open question #3 notes that `snapshotShortCodes.ts` would need updating. But the current Cloud Function (lines 49-54) only emits `{ _id, encoded }` — it strips ALL other fields. For mandala codes resolved from the static snapshot, the `type` and `mandala` fields would be missing entirely, making it impossible to detect them as mandala records. The snapshot would resolve the sequence data but lose the mandala viewer settings.

This means any mandala link accessed during a Firestore outage would show as a plain sequence, not a mandala. The spec acknowledges this ("Offline fallback will not work for mandala links until that update ships") but frames it as acceptable. Given that the snapshot function change is trivial (add `type` and `mandala` to the emitted record), it should be in scope for Phase 3, not deferred.

---

**I4: `MandalaPane` currently has no `onShare` prop or callback mechanism.**

The spec (section 4) says "`MandalaPane` calls a new `MandalaShortCodeCreator`" and "add `onShare` prop." But `MandalaPane.svelte` (line 12-16) currently accepts only `{ sequence, bluePropType?, redPropType? }`. Adding `onShare` and the entitlement gate logic means `MandalaPane` needs to know about the user's subscription tier, which is a new dependency. The spec should clarify whether the entitlement check happens inside `MandalaPane` (coupling it to auth state) or is passed in from the parent (cleaner but requires the parent to wire it).

---

### Minor

**M1: Speed type mismatch — spec says `0.5 | 1 | 1.5 | 2 | 3` but the code uses `number`.**

The spec's Firestore schema (line 52) types `speed` as a union literal `0.5 | 1 | 1.5 | 2 | 3`. But in `MandalaPane.svelte` line 26, `speed` is `number`, and in `MandalaViewerControls.svelte` the `SPEEDS` array (lines 73-79) defines the valid values but the prop type is just `number`. The Firestore record should store `speed` as `number` and validate the range, not a union type that cannot be enforced at runtime.

**M2: Rotation range mismatch — spec says `0-360` but slider steps are 15-degree increments.**

The spec (line 53) says `rotation: number; // 0-360`. The slider in `MandalaViewerControls.svelte` (lines 135-142) uses `step="15"`, so valid values are 0, 15, 30, ..., 360. A shared mandala could contain intermediate values if the slider step changes. Store as `number` but document that precision is 15-degree increments.

**M3: `lineWeight` naming inconsistency.**

The spec calls it `lineWeight` in the Firestore schema (line 57) and `MandalaViewerSettings` (line 133). But `MandalaViewerControls.svelte` uses the prop name `strokeWidth` (line 29). `MandalaPane.svelte` uses the local variable name `lineWeight` (line 32) but passes it to controls as `strokeWidth` (line 373). The Firestore field name should match one consistently. Recommend `lineWeight` since that's what `MandalaPane` uses internally and it's more domain-appropriate.

**M4: Spec references "10 parameters" but lists only 10 in the settings interface, while `bgColor` is hardcoded.**

`MandalaPane.svelte` line 33: `const bgColor = "#000000"` is not a user-configurable setting. The spec correctly excludes it from the settings interface. Just noting that if `bgColor` ever becomes configurable, the settings interface and schema need updating.

**M5: Static OG thumbnails stored in `public/images/mandala-previews/` — no cache-busting.**

The spec proposes 7 static PNGs for OG thumbnails. These would be served from the SvelteKit static directory without content hashes in the filename. Social media platforms cache OG images aggressively. If the thumbnails are ever updated, the old versions will persist in caches. Use content-hashed filenames or serve from a CDN path with cache-control headers.

---

## RECOMMENDATIONS

1. **Do not change `resolveShortCode`'s signature.** Add `resolveShortCodeFull` or have the `/q/[code]` page call a raw-record method to detect mandala type, then branch.

2. **Add Firestore rules validation for mandala records.** At minimum, validate `type` is a string from a whitelist and `mandala` keys are from the known set. Reject unknown keys in the sub-object.

3. **Use the existing `Sharer.ts` pattern for Web Share API + clipboard fallback.** The infrastructure already exists at `src/lib/shared/share/services/implementations/Sharer.ts`. The mandala share flow should call it rather than reimplementing clipboard-only.

4. **Include the snapshot function update in Phase 3 scope.** The change to `snapshotShortCodes.ts` is ~5 lines (emit `type` and `mandala` alongside `_id` and `encoded`). Deferring it creates a known regression path.

5. **Lock down the entitlement gate architecture.** Specify whether `MandalaPane` receives a `canShare: boolean` prop from its parent or queries subscription state internally. The former is cleaner (MandalaPane stays presentation-only); the latter is more self-contained. Pick one.

6. **Add deep-linking consideration for Capacitor.** The spec doesn't mention the native app. `tka.run/{code}` redirects trigger the Capacitor App Link handler (see `docs/superpowers/specs/active/2026-04-24-native-mobile-integration-design.md` line 84). The native handler needs to detect mandala codes and route to the mandala view, not the default sequence player. This may be out of Phase 3 scope but should be noted as a follow-up.

7. **Sanitize custom hex color values.** The `customBlue` and `customRed` fields accept arbitrary strings from the Firestore record. Before passing to CSS (`style:background`), validate they match `/^#[0-9a-fA-F]{6}$/`. A malicious actor could write CSS injection payloads into the color fields.
