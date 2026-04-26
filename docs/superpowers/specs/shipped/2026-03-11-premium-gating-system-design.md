# Premium Gating System Design

**Date:** 2026-03-11
**Status:** Draft
**Philosophy:** "Play with everything, pay to take it home."

---

## Overview

A unified premium gating system that uses a single mechanism — capability flags — to control what free users can and can't do. The app is fully interactive for all users. The paywall appears only at exit points (exports) and content progression boundaries (Learn lessons, premium props).

No features are hidden. No locked tabs. No blurred previews. Free users experience the full app. Premium gates what leaves the app.

---

## Gating Philosophy

The mental model is a prop table at a flow fest. You pick up anything, spin it, feel it out. Nobody charges you to try. But if you want to take it home, that's different.

**Free tier (generous):**
- Browse — full access, including collections
- Generate — fully free, no limits
- Create (Construct, Assemble) — full access
- Export — works at lowest quality, no effects/efforts, default duration
- Compose — full in-app use (preview framing)
- Learn — first 10 lessons
- All UI features — effects panels, duration sliders, effort controls are fully interactive

**Premium unlocks:**
- Export with effects and efforts applied
- Export with custom duration
- Export compositions
- Learn lessons beyond the first 10
- Premium cosmetic props (lightsabers, other fun/absurd props)
- Future capabilities as they're defined

**Module previews:** When unreleased modules go live, they launch as "previews" — fully usable in-app with a one-time acknowledgment that the module may become premium in the future. This sets expectations without being aggressive.

---

## Architecture: Single-Gate Model

### One Service, One Pattern

Everything goes through `PremiumGateChecker`. No special-case export logic, no separate gating paths.

```
Component → premiumGateChecker.check("export:effects") → { allowed, nudge }
```

### Capability Namespace

Capabilities follow the existing `capability:${category}:${name}` pattern from `FeatureFlag.ts`.

| Capability | Description | Gate Type |
|-----------|-------------|-----------|
| `capability:export:effects` | Export with effects/efforts applied | Exit point |
| `capability:export:custom-duration` | Export with non-default duration | Exit point |
| `capability:export:composition` | Export composed arrangements | Exit point |
| `capability:learn:full-curriculum` | Lessons beyond the first 10 | Content progression |
| `capability:props:premium-cosmetics` | Lightsabers, fun props | Cosmetic unlock |

New capabilities are added to this table as features are built. The `/premium` skill manages this list.

### Resolution Order

```
0. User is not authenticated → treat as free user (skip to step 4)
1. User role is admin or tester → allowed (always)
2. User role is premium → allowed (all current capabilities)
3. PostHog per-user override grants this specific capability → allowed
4. Free user, no override → not allowed, return nudge config
```

This means:
- Unauthenticated users are treated as free (no override check, just nudge)
- Premium users get everything by default (no per-capability gating for paying users)
- Individual free users can be granted specific capabilities (promos, contest winners, beta testers)
- Admins and testers are never gated

### Capability Flag Registration

**Critical:** Each capability must be registered as a `FeatureFlagConfig` with `minimumRole: "user"` and `enabled: false`. This is required because `postHogFeatureFlagService.canAccess()` runs the full access pipeline including a role check. Setting `minimumRole: "user"` ensures the role check passes for everyone, and `enabled: false` means the capability is off by default — only users with explicit `enabledFeatures` overrides (or premium+ role, checked earlier in the `PremiumGateChecker`) can access it.

Each capability in the nudge registry must have a corresponding `FeatureFlagConfig`:

```typescript
{
  id: "capability:export:effects",
  name: "Export with Effects",
  description: "Download Animations with effects and efforts applied",
  minimumRole: "user",     // Role check passes for everyone
  enabled: false,          // Off by default — PremiumGateChecker handles premium role
  category: "capability",
}
```

The `PremiumGateChecker` short-circuits before `canAccess()` for premium+ users (step 2). For free users, `canAccess()` checks `enabledFeatures` — and since `minimumRole` is `"user"`, the role check passes, so only the `enabledFeatures` list matters.

### Integration with Existing Infrastructure

The system builds on top of what already exists:

| Existing Piece | How It's Used |
|---------------|---------------|
| `UserRole` type + `isPremiumOrAbove()` | Step 1-2 of resolution |
| `CapabilityFeatureId` type | Capability string format |
| `postHogFeatureFlagService.canAccess()` | Step 3: per-user override check (requires registered `FeatureFlagConfig`) |
| `UserFeatureOverrides.enabledFeatures` | Per-user capability grants |
| `SubscriptionManager` | Stripe checkout + portal (unchanged) |
| Premium module UI | Destination for nudge "Go Premium" links |

**New code required:**
- `IPremiumGateChecker` interface + `NudgeConfig` type
- `PremiumGateChecker` implementation
- Capability nudge registry + `FeatureFlagConfig` entries for each capability
- `PremiumNudge.svelte` component (the soft nudge UI)
- `PremiumBadge.svelte` component (crown icon)
- `/premium` skill

---

## PremiumGateChecker Service

### Interface

```typescript
// services/contracts/IPremiumGateChecker.ts

export interface NudgeConfig {
  capability: string;
  description: string;       // "Export with effects"
  premiumBenefit: string;    // "Effects and efforts applied to your exports"
}

export interface PremiumGateResult {
  allowed: boolean;
  reason?: "premium_required" | "capability_disabled";
  nudge?: NudgeConfig;
}

export interface IPremiumGateChecker {
  check(capability: CapabilityFeatureId): PremiumGateResult;
  checkMultiple(capabilities: CapabilityFeatureId[]): PremiumGateResult[];
  isAllowed(capability: CapabilityFeatureId): boolean;
}
```

### Implementation

```typescript
// services/implementations/PremiumGateChecker.ts
import { postHogFeatureFlagService } from "$lib/shared/auth/services/PostHogFeatureFlagService.svelte";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/UserRole";
import { CAPABILITY_NUDGES } from "../../domain/capability-nudges";
import type { IPremiumGateChecker, PremiumGateResult, NudgeConfig } from "../contracts/IPremiumGateChecker";
import type { CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export class PremiumGateChecker implements IPremiumGateChecker {
  check(capability: CapabilityFeatureId): PremiumGateResult {
    const role = postHogFeatureFlagService.effectiveRole;

    // Not authenticated → free user, no override check
    if (!postHogFeatureFlagService.userId) {
      return this.notAllowed(capability);
    }

    // Admin/tester/premium → always allowed
    if (isPremiumOrAbove(role)) {
      return { allowed: true };
    }

    // Per-user override check (capability must be registered with minimumRole: "user")
    if (postHogFeatureFlagService.canAccess(capability)) {
      return { allowed: true };
    }

    return this.notAllowed(capability);
  }

  checkMultiple(capabilities: CapabilityFeatureId[]): PremiumGateResult[] {
    return capabilities.map((c) => this.check(c));
  }

  isAllowed(capability: CapabilityFeatureId): boolean {
    return this.check(capability).allowed;
  }

  private notAllowed(capability: CapabilityFeatureId): PremiumGateResult {
    const nudge = CAPABILITY_NUDGES[capability];
    return {
      allowed: false,
      reason: "premium_required",
      nudge: nudge ?? {
        capability,
        description: "Premium feature",
        premiumBenefit: "Unlock this feature with Premium",
      },
    };
  }
}
```

### Capability Flag Configs

Each capability must be registered so `canAccess()` doesn't fall through to the secure `"admin"` default. These configs are defined in a dedicated file and merged into the feature flag system during initialization.

```typescript
// domain/capability-flag-configs.ts
import type { FeatureFlagConfig, CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export const PREMIUM_CAPABILITY_CONFIGS: FeatureFlagConfig[] = [
  {
    id: "capability:export:effects",
    name: "Export with Effects",
    description: "Download Animations with effects and efforts applied",
    minimumRole: "user",
    enabled: false,
    category: "capability",
  },
  {
    id: "capability:export:custom-duration",
    name: "Export with Custom Duration",
    description: "Export with non-default animation duration",
    minimumRole: "user",
    enabled: false,
    category: "capability",
  },
  {
    id: "capability:export:composition",
    name: "Export Compositions",
    description: "Export composed arrangements as video",
    minimumRole: "user",
    enabled: false,
    category: "capability",
  },
  {
    id: "capability:learn:full-curriculum",
    name: "Full Curriculum Access",
    description: "Access all lessons beyond the first 10",
    minimumRole: "user",
    enabled: false,
    category: "capability",
  },
  {
    id: "capability:props:premium-cosmetics",
    name: "Premium Props",
    description: "Lightsabers and other fun prop styles",
    minimumRole: "user",
    enabled: false,
    category: "capability",
  },
];
```

**Wiring:** `PostHogFeatureFlagService.svelte.ts` currently populates `_DEFAULT_FEATURE_FLAGS` via `generateFeatureFlagsFromModules()` (module/tab flags only). During initialization, the premium capability configs are merged in:

```typescript
// In PostHogFeatureFlagService.svelte.ts, after generateFeatureFlagsFromModules()
import { PREMIUM_CAPABILITY_CONFIGS } from "$lib/shared/subscription/domain/capability-flag-configs";

// Merge capability configs into the default flags array
_DEFAULT_FEATURE_FLAGS.push(...PREMIUM_CAPABILITY_CONFIGS);
```

This ensures `getEffectiveMinimumRole()` resolves to `"user"` (not `"admin"`) for premium capabilities, allowing per-user `enabledFeatures` overrides to work correctly for free users.

### Capability Nudge Registry

A single static map. Easy to audit, easy to update.

```typescript
// domain/capability-nudges.ts

export const CAPABILITY_NUDGES: Record<string, NudgeConfig> = {
  "capability:export:effects": {
    capability: "capability:export:effects",
    description: "Export with effects",
    premiumBenefit: "Effects and efforts applied to your exports",
  },
  "capability:export:custom-duration": {
    capability: "capability:export:custom-duration",
    description: "Export with custom duration",
    premiumBenefit: "Set any duration for your exported animations",
  },
  "capability:export:composition": {
    capability: "capability:export:composition",
    description: "Export compositions",
    premiumBenefit: "Export your composed arrangements as video",
  },
  "capability:learn:full-curriculum": {
    capability: "capability:learn:full-curriculum",
    description: "Full curriculum access",
    premiumBenefit: "All lessons and learning paths",
  },
  "capability:props:premium-cosmetics": {
    capability: "capability:props:premium-cosmetics",
    description: "Premium props",
    premiumBenefit: "Lightsabers and other fun prop styles",
  },
};
```

### DI Registration

Registered in `core-container.ts` alongside `SubscriptionManager` (no constructor dependencies — `PremiumGateChecker` imports `postHogFeatureFlagService` directly as a module singleton):

```typescript
// di/containers/core-container.ts
.add({
  premiumGateChecker: () => new PremiumGateChecker(),
})
```

---

## Soft Nudge UX

### Visual Pattern

The nudge is the same everywhere. Adapted to context, but structurally identical.

**On the gated action:** A small crown icon (matching the premium module's `#fbbf24` gold) appears on the action button — not on the feature panel, not on the tab. The effects panel is fully usable. The crown only shows on "Export."

**On interaction (tap/click the gated action):**
- A lightweight inline card appears (not a modal, not a popup)
- Slides in below the button or appears as a tooltip-style callout
- Contains:
  - One line: what premium adds (from `nudge.premiumBenefit`)
  - "Go Premium" link → navigates to premium module
  - "Continue without" → performs the free-tier action

**The free-tier action always works.** Export still exports — just without effects. The user is never blocked.

**Post-action note (free tier):** After a free-tier export, a small dismissible banner: "Exported without effects. Premium includes effects, efforts, and custom duration." Shown once per session, not every export.

**For non-export gates (hard gates — no free-tier fallback):**
- Learn: Lesson 11+ visible in the list with crown icon. Tapping shows the nudge with "Go Premium" only — no "Continue without" option, because there's no degraded version of a lesson.
- Premium props: Visible in the prop selector with crown icon. Tapping shows nudge + preview of how the prop looks. No "Continue without" — the prop is premium-only.

### PremiumNudge Component

```svelte
<!-- PremiumNudge.svelte -->
<script lang="ts">
  import type { NudgeConfig } from "$lib/shared/subscription/services/contracts/IPremiumGateChecker";

  interface Props {
    nudge: NudgeConfig;
    onContinueWithout?: () => void;  // If provided, shows "Continue without" option
    onDismiss?: () => void;
  }

  let { nudge, onContinueWithout, onDismiss }: Props = $props();
</script>
```

Renders:
- Premium benefit text
- "Go Premium" button (navigates to premium module)
- Optional "Continue without" button (calls `onContinueWithout`)
- Dismiss on click outside

Styled with existing theme variables. No new CSS system.

### PremiumBadge Component

A small crown icon that indicates a premium-gated action.

```svelte
<!-- PremiumBadge.svelte -->
<script lang="ts">
  interface Props {
    size?: "sm" | "md";
    tooltip?: string;
  }

  let { size = "sm", tooltip = "Premium feature" }: Props = $props();
</script>
```

Used inline next to gated buttons/labels. Shows tooltip on hover.

---

## `/premium` Skill

Two modes: audit and decision.

### Audit Mode (`/premium`)

Scans the codebase and reports:

1. **Registered capabilities** — lists everything in the nudge registry
2. **Usage scan** — greps for `premiumGateChecker.check(` and `premiumGateChecker.isAllowed(` to find all gated callsites
3. **Ungated exports** — scans export-related code paths for any that don't call the gate checker
4. **PostHog sync status** — checks that each capability in the registry has a corresponding PostHog flag
5. **Summary** — what's gated, what's not, what might need attention

### Decision Mode (`/premium <feature-name>`)

When building a new feature, invoke `/premium export-hd` or `/premium learn-quizzes` to:

1. **Classify** — is this "play" (in-app interaction) or "take home" (exit point / progression)?
2. **If premium:**
   - Generate the capability ID (`capability:category:name`)
   - Add to the nudge registry with description and benefit text
   - Show where to add the `premiumGateChecker.check()` call
   - Create the PostHog flag
3. **If free:**
   - Document why in a comment at the relevant code location
   - No further action

---

## Module Preview Pattern

When a new module launches as a preview (e.g., Compose):

1. Module is enabled in `environment-features.ts`
2. Module definition gets a `preview: true` flag
3. First time a user enters the module, a one-time acknowledgment card appears:
   - "Compose is in preview. Enjoy full access while we refine it. Some features may become Premium in the future."
   - "Got it" button dismisses permanently (persisted to user preferences)
4. No gating is applied during preview period
5. When the module matures, specific capabilities within it get gated (e.g., `capability:export:composition`)

This is a future pattern — no immediate implementation needed. Documented here so the architecture supports it.

---

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts` | Interface + `NudgeConfig` type |
| `src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts` | Implementation |
| `src/lib/shared/subscription/domain/capability-nudges.ts` | Nudge registry (descriptions + benefit text) |
| `src/lib/shared/subscription/domain/capability-flag-configs.ts` | `FeatureFlagConfig` entries for each capability |
| `src/lib/shared/subscription/components/PremiumNudge.svelte` | Nudge UI |
| `src/lib/shared/subscription/components/PremiumBadge.svelte` | Crown icon |
| `src/lib/shared/di/containers/core-container.ts` | DI registration (add to existing) |

---

## What This Design Does NOT Cover

- **Pricing changes** — stays at $10/month. Pricing strategy is a business decision, not an architecture one.
- **A/B testing the nudge** — future optimization. Build the nudge, see conversion data, then iterate.
- **Premium module conversion page improvements** — separate work tracked in `CONVERSION-STRATEGY.md`.
- **Specific module gating decisions** — handled per-module via `/premium <feature>` as modules launch.
- **Lightsaber prop implementation** — tracked as feedback `DVS2RLzH0qdBezLPGIWu`. Premium gating will use `capability:props:premium-cosmetics`.
