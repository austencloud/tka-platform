# Phase 4: Guided Meditation — Web Research Audit

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase4-guided-meditation-design.md`
**Audited:** 2026-05-25

---

## Findings

---

### 1. Screen Wake Lock API

**Spec says:** `navigator.wakeLock.request('screen')`, graceful degradation for unsupported browsers. Cites Chrome 84+, Edge 84+, Safari 16.4+.

**2026 SOTA:**
The API is now supported in all major desktop and mobile browsers. The spec's support matrix is accurate. There is one important gotcha the spec does not mention: a **long-standing WebKit bug (#254545)** caused the Wake Lock API to silently fail in installed PWAs (Home Screen Web Apps) on iOS. This bug was **fixed in Safari 18.4 / iOS 18.4** (released early 2025). Users on iOS 16.4–18.3 in a PWA context would get a `WakeLockSentinel` object back without error, but the screen would still sleep — the API appeared to work but didn't.

The spec's `WakeLockSentinel` `release` event re-acquisition pattern is correct. The graceful degradation path is correct. The support ceiling claim (16.4+) is technically accurate for browser tabs, but understates the PWA caveat.

**Verdict:** ⚠️ Better approach exists

**Recommendation:** Add a comment in the implementation noting the iOS PWA silent-failure window (iOS 16.4–18.3). The re-acquisition-on-`release` pattern the spec already specifies handles this correctly in practice, but a code comment will prevent a future developer from removing it thinking it's unnecessary. No change to the API usage itself is needed.

```typescript
// NOTE: On iOS 16.4–18.3 in installed PWAs, wakeLock.request() resolves without error
// but the screen still sleeps (WebKit bug #254545, fixed iOS 18.4). The release-event
// re-acquisition below provides the best available mitigation.
wakeLock.addEventListener('release', () => {
  if (sessionState.status === 'running') acquireWakeLock();
});
```

---

### 2. Web Audio API for Ambient Audio

**Spec says:** Raw Web Audio API, no external library. Uses `AudioBuffer` + `AudioBufferSourceNode` (loop=true) + `GainNode`. `.ogg` with `.mp3` fallback.

**2026 SOTA:**
The Web Audio surface the spec needs is genuinely small: load a buffer, loop it, fade with a GainNode. For this exact use case — looping ambient files with crossfade on start/stop — raw Web Audio is the right call.

**Howler.js** (the obvious alternative) is on version 2.2.4, last published 3 years ago. It is effectively in maintenance mode. Several forks exist on npm (`howler-but-with-updates`) precisely because the main repo is stale. Adding it as a dependency for what amounts to `AudioContext` + `GainNode` + `AudioBufferSourceNode.loop = true` is not justified.

**Tone.js** is the active, well-maintained library in this space, but it targets audio synthesis, sequencing, and BPM-synchronized composition — overkill for playing `ocean.ogg` in a loop.

The spec's `.ogg` + `.mp3` fallback is solid. OGG/Vorbis has near-universal support in 2026; MP3 fallback covers the remaining edge cases.

One raw API gotcha the spec should address: `AudioBufferSourceNode` is **single-use** — once `.start()` is called, it cannot be restarted. The `MeditationAudioService` must create a new `AudioBufferSourceNode` each time ambient audio starts. The spec's `startAmbient()` API implies this, but the implementation note is worth making explicit.

**Verdict:** ✅ Spec is current

**Recommendation:** Add one implementation note to `meditation-audio.ts` comments: "AudioBufferSourceNode is single-use — create a new node on each `startAmbient()` call; the decoded `AudioBuffer` is reusable and should be cached." No API change needed.

---

### 3. Breathing Coach UX Patterns

**Spec says:** Expanding/contracting mandala as pacer, bottom-center phase label with crossfade, thin arc progress indicator, phase colors (blue inhale, gold exhale, white hold).

**2026 SOTA:**
The dominant UX convention across Calm, Headspace, Apple Watch Breathe, and Oura is an expanding/contracting circle as the primary visual guide — exactly what the mandala provides. The spec's approach is aligned with industry standard, but with a richer visual (the mandala) replacing the plain circle.

Key patterns found across current breathing apps:
- **Minimalist, dark-background UI** during sessions — spec matches.
- **Phase label at bottom of the visual** — spec matches.
- **Color-coded phases** — common, though color choices vary. Blue for inhale and warm/gold for exhale is a widely-used convention (cool tones = in, warm tones = out) and physiologically intuitive.
- **Arc/ring progress indicator** — used by Apple Watch Breathe and several web apps. Spec's 32px diameter / 2px stroke is appropriate for non-competing overlay.
- **Cross-fade (not slide) on phase label** — correct for calm context; spec's 150ms is on the fast end but acceptable.

One gap: current apps use **haptic feedback** (short buzz at phase transitions) on mobile as a secondary cue. The spec explicitly defers haptic to out-of-scope. That's a reasonable scope decision given Vibration API's iOS exclusion (see Finding 7), but worth noting in the spec's out-of-scope list with that reason stated.

**Verdict:** ✅ Spec is current

**Recommendation:** No change required. The mandala-as-pacer approach is differentiated from the plain-circle norm in a way that adds value rather than deviating from convention. Consider adding "Haptic feedback deferred because Vibration API has no iOS support" as the stated reason in the out-of-scope list — it pre-empts the question.

---

### 4. Page Visibility API

**Spec says:** `document.addEventListener('visibilitychange', ...)` to detect tab hidden/restored; accumulates `totalPausedMs` to keep `performance.now()`-based timer accurate.

**2026 SOTA:**
The **Page Lifecycle API** (WICG spec, Chrome-only) extends visibility with additional states: `hidden → frozen → discarded`. The `freeze` event fires when a background tab is CPU-suspended. The `resume` event fires on restoration. The spec's `visibilitychange` handler doesn't catch the `freeze` state — a tab can be frozen (raf fully stopped, JS suspended) without `visibilitychange` firing if the page was already `hidden`.

However, the `freeze`/`resume` events are **Chrome/Edge only** — Firefox and Safari do not implement them as of 2026. The Page Lifecycle API is not a stable cross-browser standard.

The `wasDiscarded` flag (available on `document`) is useful: if a frozen tab is evicted from memory, `document.wasDiscarded === true` on reload, allowing the app to show a "session interrupted" message rather than a broken timer.

The spec's `visibilitychange` + `performance.now()` delta approach is **correct and cross-browser**. The `freeze` gap only matters in the narrow scenario of a hidden tab being CPU-frozen without prior `visibilitychange` — in practice, `visibilitychange` fires first, so the timer is already paused when freeze hits.

**Verdict:** ✅ Spec is current (with a minor enhancement opportunity)

**Recommendation:** Optionally add `freeze`/`resume` listeners for Chrome/Edge as a progressive enhancement:

```typescript
// Progressive enhancement for Chrome/Edge — freeze fires after tab is already hidden
document.addEventListener('freeze', () => {
  // Already handled by visibilitychange; this is belt-and-suspenders
  if (tabHiddenAt === null) tabHiddenAt = performance.now();
});
document.addEventListener('resume', () => {
  // Already handled by visibilitychange
});
```

This is not required — `visibilitychange` covers the common case. Skip it if it adds complexity without user-visible benefit.

---

### 5. BPM / Breathing Rate Science

**Spec says:** Coherence at 5–6 BPM (default 6), BPM range 3–8. Box at 4-4-4-4. 4-7-8 at 4-7-8.

**2026 SOTA findings:**

**Coherence / Resonance Breathing:**
- The science supports 5.5 BPM as the population median resonance frequency, with individual variation of 4.5–7.0 BPM. The spec's default of 6 BPM is close but **5.5 BPM (5s inhale / 5s exhale) is the more scientifically grounded default**. A 2022 study in Psychophysiology Bulletin found 5:5 second equal-ratio breathing maximized HRV across 47 participants. The Frontiers in Neuroscience 2020 HRV biofeedback guide recommends 0.1 Hz (6 BPM) as the starting estimate with individual assessment preferred. Both 5.5 and 6 BPM are defensible; 6 BPM is the more round/memorable number.
- The spec's 3–8 BPM range is appropriate. 3 BPM (20s cycle) is at the extreme slow end but not harmful. 8 BPM (7.5s cycle) approaches normal resting breathing and is a reasonable upper bound.

**Box Breathing:**
- 4-4-4-4 is the well-established military/Navy SEAL standard (BOXBREATH protocol). Clinically supported for stress and anxiety reduction. Spec is accurate.

**4-7-8 Breathing:**
- Dr. Andrew Weil's technique, physiologically sound. Multiple clinical trials on PubMed (including NCT06966063 for COPD, NCT06415890 post-surgery) confirm significant HRV improvement and anxiety reduction. The spec's description ("sleep-promoting, activates parasympathetic") is accurate.

**Missing pattern — Physiological Sigh:**
- A Stanford RCT (Balban et al., 2023, published in *Cell Reports Medicine*) found **cyclic sighing outperforms box breathing and mindfulness meditation for acute stress relief**. The pattern: double inhale (short nasal inhale immediately followed by a second nasal inhale to fully inflate alveoli) + long exhale through the mouth. 5 minutes daily produced sustained mood improvement over one month. This pattern has strong 2026 mindfulness community recognition (Huberman Lab, Oura, Whoop all promote it). The spec includes 4 patterns; this would be a strong 5th.

**Verdict:** ⚠️ Better approach exists (Physiological Sigh missing; coherence default BPM could be refined)

**Recommendations:**
1. **Consider adding Physiological Sigh as a 5th pattern** (double inhale ~2s total / 0s hold / long exhale ~6-8s / 0s hold). It's the most evidence-backed pattern for acute stress relief and has high 2026 cultural recognition. It would require a small UX addition: the inhale phase for this pattern splits into "Inhale" (primary) + "Inhale again" (secondary short inhale) — the arc indicator would show this as a single inhale phase with a mid-phase transition cue. If scope is a concern, note it as Phase 4.5.
2. **Consider making coherence default 5s/5s (5.5 BPM) rather than 5s/5s at 6 BPM.** The spec currently says coherence default is 6 BPM, but the pattern definition shows `inhale: 5, holdIn: 0, exhale: 5, holdOut: 0` — that's 10s cycle = 6 BPM. This is internally consistent. No change needed, but add a code comment referencing the 5.5 BPM resonance literature so future developers don't "correct" it to 5.5 BPM without understanding the tradeoff.

---

### 6. Session Persistence / Gamification

**Spec says:** No persistent history in Phase 4. In-session `$state` array only (resets on reload). No streaks, no Firebase sync. Future phase deferred.

**2026 SOTA:**
The meditation app market in 2026 is saturated with streak-based gamification. Insight Timer, Headspace, and Calm all use streaks, badges, and progress dashboards as their primary retention mechanics. However, there is a growing backlash documented in UX research: streak pressure in wellness apps creates anxiety about missing days — the opposite of the intended therapeutic benefit. This "dark pattern" label has appeared in mental health app development guides as recently as 2025-2026.

The spec's decision to **explicitly defer streaks and stats to a future phase** is well-aligned with the ethical UX direction. The in-session "you've done 3 sessions today" display is a lightweight, present-moment summary without the guilt-inducing streak mechanic.

**Verdict:** ✅ Spec is current

**Recommendation:** When Phase 5 designs persistent session history, consider "time practiced this week" as the primary metric (calming, cumulative, no daily-miss anxiety) rather than a streak counter. Insight Timer's model — total minutes practiced — is the least dark-pattern approach in the category. Document this rationale in the Phase 5 spec so the decision isn't revisited blindly.

---

### 7. Haptic Feedback

**Spec says:** Haptic feedback is explicitly out of scope.

**2026 SOTA:**
The Vibration API (`navigator.vibrate()`) is the only web standard for haptics. Browser support as of May 2026: Chrome, Edge, Opera, Samsung Internet, and Android Browser — **approximately 77% global coverage**. Critical gap: **Safari and Safari on iOS do not support it and have no announced plans to add it.** Firefox removed support in version 129 (mid-2024), citing user fingerprinting concerns.

Haptic feedback at breath transitions (short 50–100ms buzz on phase change) is used in native apps — Apple Watch Breathe uses taptic feedback as a core cue, especially for eyes-closed sessions. For a web app targeting iOS users, the exclusion of Safari means haptics cannot be a reliable primary cue. It can only be a progressive enhancement for Android/Chrome users.

A March 2026 npm package `web-haptics` wraps `navigator.vibrate()` with a Vibration API feature-detect and no-op fallback, but it adds no capability beyond what the raw API provides.

**Verdict:** ✅ Spec is current (out-of-scope decision is correct given iOS gap)

**Recommendation:** The out-of-scope decision is right. If haptic feedback is added in a future phase, frame it as Android-only progressive enhancement with no visible UI indicator that it exists (users on iOS shouldn't see a toggle for a feature that won't work). Add this reasoning to the out-of-scope note in the spec: "Haptic feedback: Vibration API has no Safari/iOS support as of 2026; deferred rather than delivering Android-only experience."

---

## Summary Table

| Topic | Verdict | Action Required |
|---|---|---|
| Screen Wake Lock API | ⚠️ Better approach | Add iOS PWA bug note + re-acquisition comment |
| Web Audio API | ✅ Current | Note AudioBufferSourceNode single-use in implementation |
| Breathing UX patterns | ✅ Current | Optionally note haptic deferral reason in out-of-scope |
| Page Visibility API | ✅ Current | Optional: add `freeze`/`resume` as Chrome progressive enhancement |
| BPM / breathing science | ⚠️ Better approach | Consider Physiological Sigh as 5th pattern; note 5.5 BPM literature |
| Session persistence | ✅ Current | Document "time practiced > streaks" rationale for Phase 5 |
| Haptic feedback | ✅ Current | Add iOS-gap rationale to out-of-scope note |

---

## Sources

- [Screen Wake Lock API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Screen Wake Lock in all browsers — web.dev](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers)
- [WebKit bug #254545 — Wake Lock broken in PWAs](https://bugs.webkit.org/show_bug.cgi?id=254545)
- [WebKit features in Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- [Can I Use — Wake Lock](https://caniuse.com/wake-lock)
- [Howler.js vs Tone.js — PkgPulse 2026](https://www.pkgpulse.com/guides/howler-vs-tone-js-vs-wavesurfer-web-audio-javascript-2026)
- [Web Audio API best practices — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [Page Lifecycle API — Chrome for Developers](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [visibilitychange — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
- [Coherence breathing HRV — Auralize](https://auralize.app/blog/coherence-breathing-hrv)
- [HRV and slow-paced breathing — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0149763422000653)
- [Resonance frequency breathing — Frontiers in Neuroscience](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2020.570400/full)
- [Brief structured respiration practices (Balban et al. 2023) — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/)
- [Physiological sigh — Cyclic Sighing — Physiopedia](https://www.physio-pedia.com/Cyclic_Sighing)
- [Vibration API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [Vibration API browser support — TestMu AI](https://www.testmuai.com/learning-hub/vibration-api-browser-support/)
- [Headspace gamification features — StriveCloud](https://www.strivecloud.io/blog/headspace-gamification-features)
- [Mental health app development 2026 — KMS Technology](https://kms-technology.com/blog/the-complete-guide-to-mental-health-app-development-in-2026/)
