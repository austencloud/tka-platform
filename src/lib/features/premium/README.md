# Premium Module

**Status:** Admin-only preview (features in development, ~2-3 months from public launch)

**Purpose:** Subscription conversion flow for TKA Scribe premium features

## Architecture

This module is built using **small, focused primitives** optimized for AI-assisted development and conversion optimization.

### Component Hierarchy

```
PremiumModule.svelte (entry point)
  └── PremiumShowcase.svelte (orchestrator)
      ├── PremiumHero.svelte (hero + developer photo)
      ├── PriceHighlight.svelte (mobile-only, above fold)
      ├── EarlyAccessBanner.svelte (context setting)
      ├── InfoCard.svelte (reusable card wrapper)
      │   └── About TKA content
      ├── PremiumCTA.svelte (desktop-only, inline)
      ├── FeatureComparisonTable.svelte (Free vs Premium)
      └── StickyPremiumCTA.svelte (mobile-only, floating bottom)
```

### Responsive Strategy

**Mobile (<768px):**

- `PriceHighlight` visible above fold
- `StickyPremiumCTA` always visible at bottom (no scrolling required)
- `PremiumCTA` hidden (desktop-only)
- Tighter vertical spacing

**Desktop (≥768px):**

- `PremiumCTA` inline after About section
- `PriceHighlight` hidden
- `StickyPremiumCTA` hidden
- More generous spacing

### Component Responsibilities

| Component                       | Purpose                           | Lines | Mobile | Desktop |
| ------------------------------- | --------------------------------- | ----- | ------ | ------- |
| `PremiumShowcase.svelte`        | Orchestration, subscription logic | ~220  | ✓      | ✓       |
| `PremiumHero.svelte`            | Hero headline + developer photo   | 88    | ✓      | ✓       |
| `PremiumCTA.svelte`             | Primary CTA with pricing          | 98    | ✗      | ✓       |
| `StickyPremiumCTA.svelte`       | Floating bottom CTA               | 94    | ✓      | ✗       |
| `PriceHighlight.svelte`         | Above-fold price badge            | 63    | ✓      | ✗       |
| `FeatureComparisonTable.svelte` | Feature comparison table          | 156   | ✓      | ✓       |
| `EarlyAccessBanner.svelte`      | Beta context banner               | 43    | ✓      | ✓       |
| `InfoCard.svelte`               | Reusable card wrapper             | 49    | ✓      | ✓       |

### Integration Points

**Services (Inversify DI):**

- `ISubscriptionService` - Stripe checkout session creation
- `IHapticFeedbackService` - Mobile haptic feedback on CTA click

**Environment Variables:**

- `PUBLIC_STRIPE_PRICE_ID` - Stripe price ID for subscription
- Fallback: `price_1SgbRTLZdzgHfpQbEp99bKp7`

**Navigation:**

- Module visibility controlled by `featureFlagService.isAdmin` (navigation-coordinator.svelte.ts:200-206)
- Currently admin-only until premium features are ready

### Design Tokens

All components use `app.css` design tokens:

- **Spacing:** `--spacing-{xs,sm,md,lg,xl}`
- **Typography:** `--font-size-{min,compact,base,lg,xl}`
- **Colors:** `--theme-{text,accent,card-bg}`, `--gradient-primary`
- **Transitions:** `--transition-fast`

## Conversion Flow

1. User navigates to premium module (admin-only)
2. Sees hero + pricing above fold (mobile) or hero + inline CTA (desktop)
3. Reads about TKA + early access context
4. Reviews feature comparison
5. Clicks CTA (sticky bottom on mobile, inline on desktop)
6. `handleSubscribe()` creates Stripe checkout session
7. Redirects to Stripe-hosted checkout

## Next Steps Before Public Launch

See `CONVERSION-STRATEGY.md` for detailed roadmap.

**Critical missing components:**

- Social proof (testimonials, user count, trust badges)
- Risk reversal (FAQ, money-back guarantee, cancel anytime)
- Value communication (benefit-focused copy, demo videos)
- Analytics tracking (conversion funnel, A/B testing)
- Checkout flow UX (loading states, error handling, success confirmation)

**Content needs:**

- Developer photo (`/images/austen.jpg`)
- User testimonials
- Video tutorials explaining premium features
- Feature demos (like Patreon)

## File Structure

```
src/lib/features/premium/
├── README.md (this file)
├── CONVERSION-STRATEGY.md (optimization roadmap)
├── PremiumModule.svelte (entry point)
└── components/
    ├── PremiumShowcase.svelte (main orchestrator)
    ├── PremiumHero.svelte
    ├── PremiumCTA.svelte
    ├── StickyPremiumCTA.svelte
    ├── PriceHighlight.svelte
    ├── FeatureComparisonTable.svelte
    ├── EarlyAccessBanner.svelte
    ├── InfoCard.svelte
    └── placeholders/ (components for future implementation)
        ├── social-proof/
        ├── risk-reversal/
        └── value-communication/
```

## Testing

**Manual verification checklist:**

- [ ] Mobile: CTA visible without scrolling
- [ ] Desktop: Inline CTA displays correctly
- [ ] Stripe checkout session creates successfully
- [ ] Haptic feedback triggers on mobile
- [ ] All text meets 12px minimum font size
- [ ] Image fallback displays if photo missing
- [ ] Loading states work during checkout
- [ ] Admin-only visibility enforced

## AI Agent Instructions

When returning to this module for future development:

1. **Read this README first** to understand architecture
2. **Read CONVERSION-STRATEGY.md** to understand optimization priorities
3. **Check placeholder components** to see what needs implementation
4. **Verify all design tokens** are still being used (no hardcoded values)
5. **Test mobile-first** - sticky CTA must be accessible without scrolling
6. **Track analytics** - add event tracking for every user interaction
7. **A/B test changes** - structure allows easy component swapping

## Related Files

- `src/lib/shared/navigation-coordinator/navigation-coordinator.svelte.ts:200-206` - Module visibility logic
- `src/lib/shared/subscription/services/contracts/ISubscriptionService.ts` - Stripe service interface
- `src/app.css` - Design token definitions
