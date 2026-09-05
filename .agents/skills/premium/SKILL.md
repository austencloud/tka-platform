---
name: premium
description: Use when checking premium gating status, deciding if a feature should be free or premium, or auditing capability flags
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Premium Gating

Philosophy: "Play with everything, pay to take it home."

Spec: `docs/superpowers/specs/shipped/2026-03-11-premium-gating-system-design.md`

## Audit Mode (no args)

Scan what's gated and what's not.

### Steps

1. **Read the capability registry**

Read `src/lib/shared/subscription/domain/capability-nudges.ts` and list all registered capabilities.

2. **Scan usage**

Search for `premiumGateChecker.check(` and `premiumGateChecker.isAllowed(` across the codebase. Report each callsite with file and line number.

3. **Scan ungated exports**

Search for export-related functions (look in `src/lib/shared/sequence-viewer/` and any export/download code paths). Flag any export action that doesn't call the gate checker.

4. **Check flag registration**

Read `src/lib/shared/subscription/domain/capability-flag-configs.ts` and compare against the nudge registry. Every nudge must have a corresponding flag config.

5. **Report**

Print a summary table:

| Capability | Nudge Registered | Flag Registered | Callsites |
|-----------|-----------------|----------------|-----------|
| capability:export:effects | yes/no | yes/no | N locations |

Flag any mismatches or ungated export paths.

## Decision Mode (with feature-name arg)

Help decide if a new feature should be free or premium.

### Steps

1. **Classify**: Is this "play" (in-app interaction) or "take home" (exit point / progression / cosmetic)?

   - **Play** = free. No gating needed. Document why in a comment.
   - **Take home** = premium. Continue to step 2.

2. **Generate capability ID**: Follow the `capability:{category}:{name}` pattern.
   - Export-related: `capability:export:{name}`
   - Content progression: `capability:learn:{name}`
   - Cosmetic: `capability:props:{name}`

3. **Add to nudge registry**: Add entry to `src/lib/shared/subscription/domain/capability-nudges.ts`

4. **Add flag config**: Add entry to `src/lib/shared/subscription/domain/capability-flag-configs.ts`

5. **Show integration point**: Identify the exact file and function where `premiumGateChecker.check()` should be called. The pattern:

```typescript
import { getPremiumGateChecker } from "$lib/shared/subscription/getPremiumGateChecker";

const gateChecker = getPremiumGateChecker();
const result = gateChecker.check("capability:category:name");

if (!result.allowed) {
  // Show PremiumNudge with result.nudge
  // If soft gate: offer "Continue without" fallback
  // If hard gate: only show "Go Premium"
  return;
}

// Proceed with premium action
```

6. **Commit the registry changes**.

## Gate Types

| Type | Behavior | Example |
|------|----------|---------|
| **Soft gate** | Free-tier action always works, premium adds quality | Export (strips effects for free users) |
| **Hard gate** | No free-tier fallback, must upgrade | Learn lesson 11+, premium props |

Soft gates: `PremiumNudge` with `onContinueWithout` callback.
Hard gates: `PremiumNudge` without `onContinueWithout` (only "Go Premium" shown).
