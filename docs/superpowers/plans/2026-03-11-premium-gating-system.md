# Premium Gating System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified premium gating system using capability flags so free users can play with everything but pay to export/progress.

**Architecture:** Single `PremiumGateChecker` service checks capability flags via the existing PostHog feature flag pipeline. Capabilities registered as `FeatureFlagConfig` entries with `minimumRole: "user"` and `enabled: false`. Two UI components (`PremiumBadge`, `PremiumNudge`) provide the soft nudge UX. A `/premium` skill enables audit and decision workflows.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, PostHog feature flags, existing `postHogFeatureFlagService` singleton.

**Spec:** `docs/superpowers/specs/2026-03-11-premium-gating-system-design.md`

---

## Chunk 1: Core Service + Flag Registration

### Task 1: Create capability flag configs

**Files:**
- Create: `src/lib/shared/subscription/domain/capability-flag-configs.ts`

- [ ] **Step 1: Create the capability flag config file**

```typescript
// src/lib/shared/subscription/domain/capability-flag-configs.ts
import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/FeatureFlag";

/**
 * Each premium capability needs a FeatureFlagConfig so that
 * postHogFeatureFlagService.canAccess() doesn't fall through to
 * the secure "admin" default. Setting minimumRole: "user" means
 * the role check passes for everyone — the PremiumGateChecker
 * handles the actual premium role check before calling canAccess().
 * Setting enabled: false means the capability is off by default —
 * only users with explicit enabledFeatures overrides get through.
 */
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors related to capability-flag-configs.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/subscription/domain/capability-flag-configs.ts
git commit -m "feat(premium): add capability flag config definitions"
```

---

### Task 2: Wire capability configs into PostHog feature flag service

**Files:**
- Modify: `src/lib/shared/auth/services/PostHogFeatureFlagService.svelte.ts` (near line 252, where `_DEFAULT_FEATURE_FLAGS` is defined)

- [ ] **Step 1: Add import and merge capability configs**

In `PostHogFeatureFlagService.svelte.ts`, find:
```typescript
const _DEFAULT_FEATURE_FLAGS: FeatureFlagConfig[] =
	generateFeatureFlagsFromModules();
```

Change to:
```typescript
import { PREMIUM_CAPABILITY_CONFIGS } from "$lib/shared/subscription/domain/capability-flag-configs";

const _DEFAULT_FEATURE_FLAGS: FeatureFlagConfig[] = [
	...generateFeatureFlagsFromModules(),
	...PREMIUM_CAPABILITY_CONFIGS,
];
```

Note: The import should go with the other imports at the top of the file. The spread into the array should replace the direct assignment at line ~252.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/auth/services/PostHogFeatureFlagService.svelte.ts
git commit -m "feat(premium): register capability flags in PostHog service"
```

---

### Task 3: Create IPremiumGateChecker interface

**Files:**
- Create: `src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts
import type { CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export interface NudgeConfig {
	capability: string;
	description: string;
	premiumBenefit: string;
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts
git commit -m "feat(premium): add IPremiumGateChecker interface and NudgeConfig type"
```

---

### Task 4: Create capability nudge registry

**Files:**
- Create: `src/lib/shared/subscription/domain/capability-nudges.ts`

- [ ] **Step 1: Create the nudge registry**

```typescript
// src/lib/shared/subscription/domain/capability-nudges.ts
import type { NudgeConfig } from "../services/contracts/IPremiumGateChecker";

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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/subscription/domain/capability-nudges.ts
git commit -m "feat(premium): add capability nudge registry"
```

---

### Task 5: Create PremiumGateChecker implementation

**Files:**
- Create: `src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts`

- [ ] **Step 1: Create the implementation**

```typescript
// src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts
import { featureFlagService } from "$lib/shared/auth/services/PostHogFeatureFlagService.svelte";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/UserRole";
import { CAPABILITY_NUDGES } from "../../domain/capability-nudges";
import type {
	IPremiumGateChecker,
	PremiumGateResult,
} from "../contracts/IPremiumGateChecker";
import type { CapabilityFeatureId } from "$lib/shared/auth/domain/models/FeatureFlag";

export class PremiumGateChecker implements IPremiumGateChecker {
	check(capability: CapabilityFeatureId): PremiumGateResult {
		const role = featureFlagService.effectiveRole;

		if (!featureFlagService.userId) {
			return this.notAllowed(capability);
		}

		if (isPremiumOrAbove(role)) {
			return { allowed: true };
		}

		if (featureFlagService.canAccess(capability)) {
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts
git commit -m "feat(premium): implement PremiumGateChecker service"
```

---

### Task 6: Register PremiumGateChecker in DI container

**Files:**
- Modify: `src/lib/shared/di/containers/core-container.ts` (add import + registration near SubscriptionManager at ~line 174)
- Modify: `src/lib/shared/di/container-types.ts` (add PremiumGateChecker to IAppContainerItems if not auto-inferred)

- [ ] **Step 1: Add import to core-container.ts**

Add with the other imports at the top of the file:
```typescript
import { PremiumGateChecker } from "$lib/shared/subscription/services/implementations/PremiumGateChecker";
```

- [ ] **Step 2: Add registration near SubscriptionManager**

Find the `.add()` block containing `subscriptionManager` (around line 174). In the same `.add()` call, add:
```typescript
premiumGateChecker: () => new PremiumGateChecker(),
```

- [ ] **Step 3: Verify the container type is auto-inferred**

Check `container-types.ts` — the `ItemsOf<CoreContainer>` extraction should automatically pick up `premiumGateChecker` since it's part of the `coreContainer` const. If `CoreContainer` is typed as `typeof coreContainer`, no changes needed. If it uses a `ReturnType<typeof createCoreContainer>` pattern, the new item is included automatically.

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/di/containers/core-container.ts
git commit -m "feat(premium): register PremiumGateChecker in DI container"
```

---

## Chunk 2: UI Components

### Task 7: Create PremiumBadge component

**Files:**
- Create: `src/lib/shared/subscription/components/PremiumBadge.svelte`

- [ ] **Step 1: Create the badge component**

A small crown icon used inline next to gated actions. Uses the premium module's gold color (`#fbbf24`).

```svelte
<!-- src/lib/shared/subscription/components/PremiumBadge.svelte -->
<script lang="ts">
	interface Props {
		size?: "sm" | "md";
		tooltip?: string;
	}

	let { size = "sm", tooltip = "Premium feature" }: Props = $props();

	const sizeMap = {
		sm: "0.75rem",
		md: "1rem",
	};
</script>

<span
	class="premium-badge"
	style:font-size={sizeMap[size]}
	title={tooltip}
	aria-label={tooltip}
>
	<i class="fas fa-crown" aria-hidden="true"></i>
</span>

<style>
	.premium-badge {
		color: #fbbf24;
		display: inline-flex;
		align-items: center;
		cursor: help;
	}
</style>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/subscription/components/PremiumBadge.svelte
git commit -m "feat(premium): add PremiumBadge crown icon component"
```

---

### Task 8: Create PremiumNudge component

**Files:**
- Create: `src/lib/shared/subscription/components/PremiumNudge.svelte`

The inline nudge card that appears when a free user interacts with a gated action. Not a modal — a lightweight callout.

- [ ] **Step 1: Create the nudge component**

This is an **inline callout**, not a modal. It renders relative to its parent container (the trigger button). The parent is responsible for positioning — typically via a wrapper with `position: relative` and toggling the nudge's visibility.

```svelte
<!-- src/lib/shared/subscription/components/PremiumNudge.svelte -->
<script lang="ts">
	import type { NudgeConfig } from "../services/contracts/IPremiumGateChecker";

	interface Props {
		nudge: NudgeConfig;
		onContinueWithout?: () => void;
		onDismiss?: () => void;
	}

	let { nudge, onContinueWithout, onDismiss }: Props = $props();

	function handleGoPremium() {
		window.dispatchEvent(
			new CustomEvent("navigate-module", { detail: { moduleId: "premium" } }),
		);
		onDismiss?.();
	}

	function handleContinueWithout() {
		onContinueWithout?.();
		onDismiss?.();
	}
</script>

<div class="nudge-callout" role="status" aria-label="Premium feature">
	<div class="nudge-header">
		<i class="fas fa-crown nudge-icon" aria-hidden="true"></i>
		<span class="nudge-benefit">{nudge.premiumBenefit}</span>
	</div>
	<div class="nudge-actions">
		<button class="nudge-cta" onclick={handleGoPremium}>Go Premium</button>
		{#if onContinueWithout}
			<button class="nudge-secondary" onclick={handleContinueWithout}>
				Continue without
			</button>
		{/if}
	</div>
</div>

<style>
	.nudge-callout {
		background: var(--theme-card-bg, rgba(30, 30, 45, 0.98));
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-md, 8px);
		padding: 0.75rem 1rem;
		max-width: 280px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		animation: nudge-in 0.15s ease-out;
	}

	@keyframes nudge-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nudge-callout {
			animation: none;
		}
	}

	.nudge-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.625rem;
	}

	.nudge-icon {
		color: #fbbf24;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.nudge-benefit {
		color: var(--theme-text, #ffffff);
		font-size: var(--font-size-compact, 12px);
		line-height: 1.3;
	}

	.nudge-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.nudge-cta {
		background: #fbbf24;
		color: #1a1a2e;
		border: none;
		border-radius: var(--radius-sm, 6px);
		padding: 0.375rem 0.75rem;
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.nudge-cta:hover {
		opacity: 0.9;
	}

	.nudge-secondary {
		background: none;
		border: none;
		color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-compact, 12px);
		cursor: pointer;
		padding: 0.375rem 0.5rem;
	}

	.nudge-secondary:hover {
		color: var(--theme-text, #ffffff);
	}
</style>
```

**Usage pattern in a parent component:**
```svelte
<div class="export-wrapper" style="position: relative;">
	<button onclick={handleExport}>Export</button>
	{#if showNudge}
		<div style="position: absolute; top: 100%; left: 0; margin-top: 4px; z-index: 10;">
			<PremiumNudge
				nudge={gateResult.nudge}
				onContinueWithout={handleFreeExport}
				onDismiss={() => showNudge = false}
			/>
		</div>
	{/if}
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/subscription/components/PremiumNudge.svelte
git commit -m "feat(premium): add PremiumNudge inline card component"
```

---

## Chunk 3: Build Verification + /premium Skill

### Task 9: Full build verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npm run check`
Expected: No errors related to premium/subscription files

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds. All new files are properly resolved.

- [ ] **Step 3: Fix any issues found**

If there are import resolution errors, check:
- Path aliases resolve correctly (`$lib/shared/...`)
- All imports match actual export names
- No circular dependencies between capability-nudges.ts and IPremiumGateChecker.ts

---

### Task 10: Create /premium skill

**Files:**
- Create: `.claude/skills/premium/SKILL.md`

- [ ] **Step 1: Create the skill file**

```markdown
---
description: Use when checking premium gating status, deciding if a feature should be free or premium, or auditing capability flags
argument-hint: "[feature-name]"
---

# Premium Gating

Philosophy: "Play with everything, pay to take it home."

Spec: `docs/superpowers/specs/2026-03-11-premium-gating-system-design.md`

## Audit Mode (no args)

Scan what's gated and what's not.

### Steps

1. **Read the capability registry**

Read `src/lib/shared/subscription/domain/capability-nudges.ts` and list all registered capabilities.

2. **Scan usage**

Grep for `premiumGateChecker.check(` and `premiumGateChecker.isAllowed(` across the codebase. Report each callsite with file and line number.

3. **Scan ungated exports**

Grep for export-related functions (look in `src/lib/shared/sequence-viewer/` and any export/download code paths). Flag any export action that doesn't call the gate checker.

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
   - Export-related → `capability:export:{name}`
   - Content progression → `capability:learn:{name}`
   - Cosmetic → `capability:props:{name}`

3. **Add to nudge registry**: Add entry to `src/lib/shared/subscription/domain/capability-nudges.ts`

4. **Add flag config**: Add entry to `src/lib/shared/subscription/domain/capability-flag-configs.ts`

5. **Show integration point**: Identify the exact file and function where `premiumGateChecker.check()` should be called. The pattern:

```typescript
import { container } from "$lib/shared/di";
import type { IPremiumGateChecker } from "$lib/shared/subscription/services/contracts/IPremiumGateChecker";

const gateChecker = container.items.premiumGateChecker as IPremiumGateChecker;
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
```

- [ ] **Step 2: Verify the skill is listed**

The skill should appear in the skills list automatically since it follows the `.claude/skills/{name}/SKILL.md` pattern.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/premium/SKILL.md
git commit -m "feat(premium): add /premium skill for audit and decision workflows"
```

---

### Task 11: Update workflows rule to include /premium

**Files:**
- Modify: `.claude/rules/workflows.md`

- [ ] **Step 1: Add /premium to the skill command list**

In the "Skill-Based Commands" section, add:
```
- `/premium` - Audit premium gating status or classify new features as free/premium
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/workflows.md
git commit -m "docs: add /premium to workflows skill list"
```

---

## Task Summary

| Task | What | Files |
|------|------|-------|
| 1 | Capability flag configs | Create: `subscription/domain/capability-flag-configs.ts` |
| 2 | Wire configs into PostHog | Modify: `PostHogFeatureFlagService.svelte.ts` |
| 3 | IPremiumGateChecker interface | Create: `subscription/services/contracts/IPremiumGateChecker.ts` |
| 4 | Nudge registry | Create: `subscription/domain/capability-nudges.ts` |
| 5 | PremiumGateChecker implementation | Create: `subscription/services/implementations/PremiumGateChecker.ts` |
| 6 | DI registration | Modify: `core-container.ts` |
| 7 | PremiumBadge component | Create: `subscription/components/PremiumBadge.svelte` |
| 8 | PremiumNudge component | Create: `subscription/components/PremiumNudge.svelte` |
| 9 | Full build verification | Run: `npm run check` + `npm run build` |
| 10 | /premium skill | Create: `.claude/skills/premium/SKILL.md` |
| 11 | Update workflows rule | Modify: `.claude/rules/workflows.md` |

**Dependencies:** Tasks 1-4 are independent. Task 5 depends on 3+4. Task 6 depends on 5. Tasks 7-8 depend on 3 (for the NudgeConfig type). Task 9 depends on all code tasks. Tasks 10-11 are independent of code tasks.
