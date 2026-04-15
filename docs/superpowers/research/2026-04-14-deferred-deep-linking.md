# Deferred Deep Linking for Capacitor PWAs — 2026 Research Brief

> Research input for a future design spec. Not a spec itself. Decisions deferred until Capacitor wrapping is further along.

## Context

Firebase Dynamic Links shut down August 25, 2025. All FDL short links (custom domains and `page.link`) are dead. The free, default solution is gone.

TKA use case: printed QR codes on trading cards. User scans → lands on `/p/[shortcode]`. If the native app isn't installed, we want the original sequence to open inside the app after install + first launch. This is the classic deferred deep link problem.

## The Landscape Post-FDL

Split into three tiers: paid MMPs, FDL-replacement startups, DIY.

### Paid SaaS (MMP-style)

| Provider | Indie Pricing (~10k MAU) | Capacitor | Notes |
|---|---|---|---|
| Branch.io | Free tier removed from public plans; cheapest published plan $499/mo | Official plugin, well-maintained | Market leader. `NativeLink` solves iOS Private Relay clipboard UX. Overkill and expensive for indie. |
| AppsFlyer OneLink | "Free" plan exists but conversion-based (~$0.07/install on Growth) | Official Capacitor plugin, actively maintained | Attribution-focused — paying for MMP, not just links. |
| Adjust | No public small-app tier; enterprise sales only | Cordova/Capacitor plugin | Similar to AppsFlyer. Not indie-friendly. |
| Kochava | Perpetual free tier (Free App Analytics); Foundation $500/mo | Plugin exists, less battle-tested | Only big-name with a real free tier, but aimed at attribution use cases. |

Verdict: legacy MMP players priced for VC-funded startups. Not appropriate for a community app.

### FDL-Replacement Startups

| Provider | Indie Pricing | Capacitor | Maintenance |
|---|---|---|---|
| ChottuLink | Free to 25k MAU, $19/mo for 25–100k. Unlimited links, deferred deep linking, custom domain, QR codes free | Explicit Capacitor support documented | Newer, single-purpose (built as FDL replacement). Quality less proven than Branch. |
| Dub.co | Open-source core + paid cloud. Deferred via hybrid clipboard + probabilistic | SDK-based, framework-agnostic | Well-funded, actively developed. More link-management focus than mobile-first. |
| Tolinku / LinkHopp / Dynalinks / Detour (Software Mansion) | Indie/OSS, $0–low double digits | Varies — most are SDK-light | Bus factor risk. Great for hobby apps, risky for long-term. |

### Self-Hosted / DIY Pattern

The indie pattern that emerged in 2025–26:

1. Universal Links + App Links (free, native) handle the *installed* case perfectly.
2. For *not-installed*: stash a fingerprint (SHA of IP + User-Agent + screen resolution + locale + timezone) on your server with 1–24h TTL when the QR resolves in the browser.
3. On first app launch, Capacitor app POSTs its own fingerprint and retrieves pending shortcode.
4. **Android:** Play Install Referrer API — stuff a click ID into the Play Store install URL, read back deterministically in-app. **The one reliable deterministic channel still free in 2026.**
5. **iOS:** Clipboard paste pattern still in use (Branch's NativeLink formalized it). One-tap "We copied the link — paste it here" prompt. Ugly but deterministic and Private-Relay-safe.

Accuracy: 70–90% with fingerprinting, 99%+ with Play Install Referrer (Android) and clipboard paste (iOS).

Implementation cost: ~2–3 days of Firebase Functions + existing `/p/[shortcode]` route + Capacitor `App.addListener('appUrlOpen')` + one native side-channel per platform.

## Apple/Google Native Story in 2026

- Universal Links / App Links: still free, still don't support deferred install. No change in 2025–26.
- iOS Smart App Banners: unchanged. Deep link if installed, App Store if not — context lost through install. Same limitation as 2018.
- App Clips (iOS): technically enable something close to deferred deep linking, but require real engineering investment. Overkill for "scan QR, open sequence."
- Play Install Referrer API (Android): still the best deterministic free channel, actively supported. **The only native win.** Use it.
- Private Relay (iOS): continues to break IP-based fingerprint matching for ~25% of iOS users. Forces clipboard UX or reduced accuracy.

## Recommendation for TKA

Given: small indie app, printed QR codes as primary discovery, budget sensitivity high, UX matters, Svelte + Firebase stack already in place.

**In order of preference:**

1. **Primary: ChottuLink free tier.** 25k MAU ceiling well above near-term projections. Capacitor support exists. Zero cost. Hosted custom domain. If it survives 2026–27 it's the dominant FDL replacement.
2. **Backup / insurance: build the DIY fallback anyway.** The `/p/[shortcode]` route exists regardless. Adding fingerprint stash (Firestore doc, 1h TTL) and Capacitor first-launch check is ~a day of work. Use Play Install Referrer for Android deterministic match. Clipboard paste prompt for iOS first-launch fallback.
3. **Accept graceful degradation as baseline UX:** if both fail, first-launch lands on home with dismissible "Scanned a card? Paste the link here" banner. Common pattern in 2026 — users understand it. Cards should also print human-readable shortcode (e.g., `tka.app/p/ABC123`) so worst case user types 6 characters.

**Avoid Branch.io** unless a revenue-funded version needs attribution analytics. Pricing cliff from free to $499/mo is hostile to indie use.

**Explicitly out of scope:** AppsFlyer, Adjust, Kochava. MMPs, not link providers. Paying for attribution that's not needed.

## Sources

- [Firebase Dynamic Links Deprecation FAQ](https://firebase.google.com/support/dynamic-links-faq)
- [Firebase Dynamic Links Shut Down: 5 Best Alternatives for 2026 (ChottuLink)](https://chottulink.com/blog/firebase-dynamic-links-shut-down-5-best-alternatives-for-2026/)
- [ChottuLink Pricing](https://chottulink.com/pricing.html)
- [Dub — The #1 Firebase Dynamic Links Alternative](https://dub.co/blog/firebase-alternative)
- [Dub Deferred Deep Linking Docs](https://dub.co/docs/concepts/deep-links/deferred-deep-linking)
- [Branch.io Pricing 2026 — $499/mo minimum](https://community.flutterflow.io/ask-the-community/post/firebase-dynamic-links-deprecated-branch-io-is-499-month---what-are-you-4cZ4ZfxIm0itlBD)
- [Branch.io Official Pricing](https://www.branch.io/pricing/)
- [Kochava Pricing 2026](https://getpulsesignal.com/pricing/kochava)
- [AppsFlyer Pricing 2026](https://checkthat.ai/brands/appsflyer/pricing)
- [Capacitor Deep Links Official Guide](https://capacitorjs.com/docs/guides/deep-links)
- [Branch Capacitor Plugin](https://github.com/BranchMetrics/capacitor-branch-deep-links)
- [AppsFlyer Capacitor Plugin](https://github.com/AppsFlyerSDK/appsflyer-capacitor-plugin/blob/main/docs/DeepLink.md)
- [How I Built a Deep Linking Service Under 10ms (LinkHopp indie)](https://dev.to/stefanobholz/how-i-built-a-deep-linking-service-that-resolves-in-under-10ms-and-why-you-might-need-one-12o8)
- [Deferred Deep Linking in iOS and Android: Guide for 2026 (Adapty)](https://adapty.io/blog/deferred-deep-linking/)
- [Branch NativeLink — iOS Private Relay + Clipboard](https://help.branch.io/developer-hub/docs/nativelink-deferred-deep-linking)
- [Detour (Software Mansion) — OSS deep linking](https://docs.swmansion.com/detour/docs/Fundamentals/introduction)
- [AppsFlyer on FDL shutdown](https://www.appsflyer.com/blog/mobile-marketing/fdl-deprecation-deep-linking/)
