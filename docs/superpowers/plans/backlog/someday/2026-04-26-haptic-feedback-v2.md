# Haptic Feedback v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buzzy navigator.vibrate / iOS checkbox hack haptic service with Capacitor-native semantic haptics (impact/notification/selection), matching Apple HIG and Material Design conventions.

**Architecture:** Rewrite `HapticFeedback.ts` internals to route all haptics through `@capacitor/haptics` on native builds, silent no-op on web. Extend `IHapticFeedback` interface with `impact()`, `notification()`, `selection()` methods. Backward-compatible `trigger()` maps old types to new.

**Tech Stack:** `@capacitor/haptics ^8.0.2` (already installed), SvelteKit, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/shared/application/services/contracts/IHapticFeedback.ts` | Add `impact()`, `notification()`, `selection()` to interface |
| Rewrite | `src/lib/shared/application/services/implementations/HapticFeedback.ts` | Capacitor-native routing, remove vibrate/iOS hack, backward compat |
| Modify | `src/lib/shared/application/getHapticFeedback.ts` | No change needed (already correct) |
| Modify | `tests/mocks/mock-haptic-service.ts` | Track new method calls |
| Modify | `src/lib/shared/components/context-menu/ContextMenu.svelte` | Replace inline `haptic()` with service |
| Modify | `src/lib/features/compose/tabs/arrange/components/grid/CompositionGrid.svelte` | Replace raw `navigator.vibrate` |
| Modify | `src/lib/features/feedback/components/manage/FeedbackKanbanCard.svelte` | Replace raw `navigator.vibrate` |
| Modify | `eslint.config.js` | Add `no-restricted-properties` rule for `navigator.vibrate` |
| Create | `tests/unit/haptic-feedback.test.ts` | Unit tests for new service |

---

### Task 1: Update IHapticFeedback Interface

**Files:**
- Modify: `src/lib/shared/application/services/contracts/IHapticFeedback.ts`

- [ ] **Step 1: Add new types and methods to the interface**

Replace the entire file with:

```typescript
import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";

export type HapticImpactStyle = "light" | "medium" | "heavy";
export type HapticNotificationType = "success" | "warning" | "error";

// Legacy type — kept for backward compat, maps to new types internally
export type HapticFeedbackType =
  | "selection"
  | "success"
  | "warning"
  | "error"
  | "custom";

export interface HapticFeedbackConfig {
  enabled: boolean;
  respectReducedMotion: boolean;
  throttleTime: number;
  customPatterns: Record<string, number[]>;
}

export interface IHapticFeedback {
  // New semantic methods (Capacitor-native)
  impact(style: HapticImpactStyle): boolean;
  notification(type: HapticNotificationType): boolean;
  selection(): boolean;

  // Legacy method — maps to new types internally
  trigger(type?: HapticFeedbackType): boolean;

  // Animation-synchronized haptics
  triggerEffort(
    effortId: EffortId,
    params?: EffortParams,
    durationMs?: number
  ): boolean;

  // Custom patterns (animation haptics only)
  setCustomPattern(name: string, pattern: number[]): void;
  triggerCustom(name: string): boolean;

  // Configuration
  isSupported(): boolean;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  getConfig(): HapticFeedbackConfig;
  updateConfig(config: Partial<HapticFeedbackConfig>): void;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: Errors in `HapticFeedback.ts` (implementation missing new methods) and `mock-haptic-service.ts`. This is correct — we fix those in Tasks 2-3.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/application/services/contracts/IHapticFeedback.ts
git commit -m "refactor(haptics): add impact/notification/selection to IHapticFeedback interface"
```

---

### Task 2: Rewrite HapticFeedback Implementation

**Files:**
- Rewrite: `src/lib/shared/application/services/implementations/HapticFeedback.ts`

- [ ] **Step 1: Replace the entire implementation**

Replace the file contents with:

```typescript
import { browser } from "$app/environment";
import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";
import { EffortHapticMapper } from "$lib/features/effort-lab/services/implementations/EffortHapticMapper";
import type {
  HapticFeedbackConfig,
  HapticFeedbackType,
  HapticImpactStyle,
  HapticNotificationType,
  IHapticFeedback,
} from "../contracts/IHapticFeedback";
import type { IPlatformDetector } from "$lib/shared/platform/services/contracts/IPlatformDetector";

const DEFAULT_CONFIG: HapticFeedbackConfig = {
  enabled: true,
  respectReducedMotion: true,
  throttleTime: 50,
  customPatterns: {},
};

export class HapticFeedback implements IHapticFeedback {
  private lastFeedbackTime: number = 0;
  private config: HapticFeedbackConfig = { ...DEFAULT_CONFIG };
  private effortMapper: EffortHapticMapper | null = null;
  private nativePlatformDetector: IPlatformDetector | null;

  constructor(nativePlatformDetector?: IPlatformDetector) {
    this.nativePlatformDetector = nativePlatformDetector ?? null;
    this.setupReducedMotionListener();
  }

  // ==========================================================================
  // NEW SEMANTIC API
  // ==========================================================================

  public impact(style: HapticImpactStyle): boolean {
    if (!this.canTrigger()) return false;
    this.lastFeedbackTime = Date.now();
    return this.nativeImpact(style);
  }

  public notification(type: HapticNotificationType): boolean {
    if (!this.canTrigger()) return false;
    this.lastFeedbackTime = Date.now();
    return this.nativeNotification(type);
  }

  public selection(): boolean {
    if (!this.canTrigger()) return false;
    this.lastFeedbackTime = Date.now();
    return this.nativeSelection();
  }

  // ==========================================================================
  // LEGACY API (backward compat — maps to new types)
  // ==========================================================================

  public trigger(type: HapticFeedbackType = "selection"): boolean {
    switch (type) {
      case "selection":
        return this.impact("medium");
      case "success":
        return this.notification("success");
      case "warning":
        return this.notification("warning");
      case "error":
        return this.notification("error");
      case "custom":
        return false;
    }
  }

  // ==========================================================================
  // ANIMATION HAPTICS
  // ==========================================================================

  public triggerEffort(
    effortId: EffortId,
    params?: EffortParams,
    durationMs?: number
  ): boolean {
    if (!this.canTrigger()) return false;
    if (!this.isNative()) return false;
    this.lastFeedbackTime = Date.now();

    if (!this.effortMapper) {
      this.effortMapper = new EffortHapticMapper();
    }

    const pattern = this.effortMapper.generatePattern(effortId, params, durationMs);
    this.playPatternAsNativeImpacts(pattern);
    return true;
  }

  // ==========================================================================
  // CUSTOM PATTERNS
  // ==========================================================================

  public setCustomPattern(name: string, pattern: number[]): void {
    this.config.customPatterns[name] = [...pattern];
  }

  public triggerCustom(name: string): boolean {
    if (!this.canTrigger()) return false;
    if (!this.isNative()) return false;

    const pattern = this.config.customPatterns[name];
    if (!pattern) return false;

    this.lastFeedbackTime = Date.now();
    this.playPatternAsNativeImpacts(pattern);
    return true;
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  public isSupported(): boolean {
    return this.isNative();
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getConfig(): HapticFeedbackConfig {
    return { ...this.config };
  }

  public updateConfig(config: Partial<HapticFeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==========================================================================
  // PRIVATE — NATIVE ROUTING
  // ==========================================================================

  private isNative(): boolean {
    return this.nativePlatformDetector?.isNative === true;
  }

  private nativeImpact(style: HapticImpactStyle): boolean {
    if (!this.isNative()) return false;
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      const styleMap: Record<HapticImpactStyle, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      Haptics.impact({ style: styleMap[style] });
    }).catch(() => {});
    return true;
  }

  private nativeNotification(type: HapticNotificationType): boolean {
    if (!this.isNative()) return false;
    import("@capacitor/haptics").then(({ Haptics, NotificationType }) => {
      const typeMap: Record<HapticNotificationType, typeof NotificationType[keyof typeof NotificationType]> = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      Haptics.notification({ type: typeMap[type] });
    }).catch(() => {});
    return true;
  }

  private nativeSelection(): boolean {
    if (!this.isNative()) return false;
    import("@capacitor/haptics").then(({ Haptics }) => {
      Haptics.selectionChanged();
    }).catch(() => {});
    return true;
  }

  private playPatternAsNativeImpacts(pattern: number[]): void {
    let timeOffset = 0;
    for (let i = 0; i < pattern.length; i++) {
      const duration = pattern[i];
      if (i % 2 === 0 && duration > 0) {
        setTimeout(() => this.nativeImpact("light"), timeOffset);
      }
      timeOffset += duration;
    }
  }

  // ==========================================================================
  // PRIVATE — GUARDS AND SETUP
  // ==========================================================================

  private canTrigger(): boolean {
    if (!browser) return false;
    if (!this.config.enabled) return false;
    const now = Date.now();
    if (now - this.lastFeedbackTime < this.config.throttleTime) return false;
    return true;
  }

  private setupReducedMotionListener(): void {
    if (!browser || !window.matchMedia) return;
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches && this.config.respectReducedMotion) {
        this.config.enabled = false;
      }
      mq.addEventListener("change", (e) => {
        if (this.config.respectReducedMotion && e.matches) {
          this.config.enabled = false;
        }
      });
    } catch {}
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: Errors only in `mock-haptic-service.ts` (fixed in Task 3). The implementation itself should be clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/application/services/implementations/HapticFeedback.ts
git commit -m "refactor(haptics): Capacitor-native routing, remove vibrate/iOS hack, add semantic API"
```

---

### Task 3: Update Mock Service

**Files:**
- Modify: `tests/mocks/mock-haptic-service.ts`

- [ ] **Step 1: Rewrite mock to track new methods**

Replace the file contents with:

```typescript
import type {
  HapticFeedbackConfig,
  HapticFeedbackType,
  HapticImpactStyle,
  HapticNotificationType,
  IHapticFeedback,
} from "$lib/shared/application/services/contracts/IHapticFeedback";
import type { EffortId, EffortParams } from "$lib/features/effort-lab/domain/effort-types";

interface HapticCall {
  method: string;
  args: unknown[];
  timestamp: number;
}

export class MockHapticFeedback implements IHapticFeedback {
  private calls: HapticCall[] = [];
  private _supported = true;
  private _enabled = true;
  private config: HapticFeedbackConfig = {
    enabled: true,
    respectReducedMotion: true,
    throttleTime: 0,
    customPatterns: {},
  };

  impact(style: HapticImpactStyle): boolean {
    this.calls.push({ method: "impact", args: [style], timestamp: Date.now() });
    return this._supported;
  }

  notification(type: HapticNotificationType): boolean {
    this.calls.push({ method: "notification", args: [type], timestamp: Date.now() });
    return this._supported;
  }

  selection(): boolean {
    this.calls.push({ method: "selection", args: [], timestamp: Date.now() });
    return this._supported;
  }

  trigger(type: HapticFeedbackType = "selection"): boolean {
    this.calls.push({ method: "trigger", args: [type], timestamp: Date.now() });
    return this._supported;
  }

  triggerEffort(effortId: EffortId, params?: EffortParams, durationMs?: number): boolean {
    this.calls.push({ method: "triggerEffort", args: [effortId, params, durationMs], timestamp: Date.now() });
    return this._supported;
  }

  setCustomPattern(name: string, pattern: number[]): void {
    this.config.customPatterns[name] = [...pattern];
  }

  triggerCustom(name: string): boolean {
    this.calls.push({ method: "triggerCustom", args: [name], timestamp: Date.now() });
    return this._supported;
  }

  isSupported(): boolean { return this._supported; }
  setEnabled(enabled: boolean): void { this._enabled = enabled; this.config.enabled = enabled; }
  isEnabled(): boolean { return this._enabled; }
  getConfig(): HapticFeedbackConfig { return { ...this.config }; }
  updateConfig(config: Partial<HapticFeedbackConfig>): void { this.config = { ...this.config, ...config }; }

  // Test helpers
  getCalls(): HapticCall[] { return [...this.calls]; }
  getCallCount(): number { return this.calls.length; }
  getCallsByMethod(method: string): HapticCall[] { return this.calls.filter(c => c.method === method); }
  clear(): void { this.calls = []; }
  setSupported(supported: boolean): void { this._supported = supported; }
}

// Legacy export for existing test files that import by old name
export class MockHapticFeedbackService extends MockHapticFeedback {}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: Clean (0 errors from our changes).

- [ ] **Step 3: Commit**

```bash
git add tests/mocks/mock-haptic-service.ts
git commit -m "refactor(haptics): update mock service for v2 interface"
```

---

### Task 4: Write Unit Tests

**Files:**
- Create: `tests/unit/haptic-feedback.test.ts`

- [ ] **Step 1: Write tests for backward compat mapping and new API**

```typescript
import { describe, it, expect } from "vitest";
import { MockHapticFeedback } from "../mocks/mock-haptic-service";

describe("MockHapticFeedback", () => {
  it("tracks impact calls with style", () => {
    const haptic = new MockHapticFeedback();
    haptic.impact("light");
    haptic.impact("medium");
    haptic.impact("heavy");

    const impacts = haptic.getCallsByMethod("impact");
    expect(impacts).toHaveLength(3);
    expect(impacts[0].args[0]).toBe("light");
    expect(impacts[1].args[0]).toBe("medium");
    expect(impacts[2].args[0]).toBe("heavy");
  });

  it("tracks notification calls with type", () => {
    const haptic = new MockHapticFeedback();
    haptic.notification("success");
    haptic.notification("warning");
    haptic.notification("error");

    const notifications = haptic.getCallsByMethod("notification");
    expect(notifications).toHaveLength(3);
    expect(notifications[0].args[0]).toBe("success");
    expect(notifications[2].args[0]).toBe("error");
  });

  it("tracks selection calls", () => {
    const haptic = new MockHapticFeedback();
    haptic.selection();
    haptic.selection();

    expect(haptic.getCallsByMethod("selection")).toHaveLength(2);
  });

  it("tracks legacy trigger calls", () => {
    const haptic = new MockHapticFeedback();
    haptic.trigger("selection");
    haptic.trigger("success");

    const triggers = haptic.getCallsByMethod("trigger");
    expect(triggers).toHaveLength(2);
    expect(triggers[0].args[0]).toBe("selection");
    expect(triggers[1].args[0]).toBe("success");
  });

  it("returns false when not supported", () => {
    const haptic = new MockHapticFeedback();
    haptic.setSupported(false);

    expect(haptic.impact("medium")).toBe(false);
    expect(haptic.notification("success")).toBe(false);
    expect(haptic.selection()).toBe(false);
  });

  it("clear resets all calls", () => {
    const haptic = new MockHapticFeedback();
    haptic.impact("light");
    haptic.notification("error");
    haptic.selection();
    expect(haptic.getCallCount()).toBe(3);

    haptic.clear();
    expect(haptic.getCallCount()).toBe(0);
  });

  it("getCallCount returns total across all methods", () => {
    const haptic = new MockHapticFeedback();
    haptic.impact("light");
    haptic.notification("success");
    haptic.trigger("selection");
    haptic.selection();

    expect(haptic.getCallCount()).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/haptic-feedback.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/haptic-feedback.test.ts
git commit -m "test(haptics): unit tests for v2 mock service"
```

---

### Task 5: Migrate ContextMenu to Service

**Files:**
- Modify: `src/lib/shared/components/context-menu/ContextMenu.svelte`

- [ ] **Step 1: Replace inline haptic function with service import**

At the top of the `<script>` block, after existing imports, add:

```typescript
import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
```

- [ ] **Step 2: Replace the inline `haptic()` function**

Find and delete (around lines 98-102):

```typescript
  function haptic() {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
  }
```

- [ ] **Step 3: Replace `haptic()` calls with service calls**

In `dismissOnPointerDown` (the dismiss handler), replace `haptic()` with:

```typescript
getHapticFeedback().impact("light");
```

In `runAction` (menu item handler), replace `haptic()` with:

```typescript
getHapticFeedback().impact("medium");
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/components/context-menu/ContextMenu.svelte
git commit -m "refactor(haptics): migrate ContextMenu from inline vibrate to haptic service"
```

---

### Task 6: Migrate CompositionGrid

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/CompositionGrid.svelte`

- [ ] **Step 1: Add service import**

Add to the imports section:

```typescript
import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
```

- [ ] **Step 2: Replace drag activation haptic (line ~327)**

Find:
```typescript
navigator.vibrate?.(50);
```
(Inside the `setTimeout` long-press callback that sets `dragState.activated = true`)

Replace with:
```typescript
getHapticFeedback().impact("heavy");
```

This is a long-press activation — `heavy` matches the Apple HIG / Material Design recommendation.

- [ ] **Step 3: Replace context menu long-press haptic (line ~555)**

Find:
```typescript
navigator.vibrate?.(30);
```
(Inside `startContextMenuLongPress`, the context menu trigger)

Replace with:
```typescript
getHapticFeedback().impact("medium");
```

Context menu trigger — `medium` matches the standard action weight.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/CompositionGrid.svelte
git commit -m "refactor(haptics): migrate CompositionGrid from raw vibrate to haptic service"
```

---

### Task 7: Migrate FeedbackKanbanCard

**Files:**
- Modify: `src/lib/features/feedback/components/manage/FeedbackKanbanCard.svelte`

- [ ] **Step 1: Add service import**

Add to the imports section:

```typescript
import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
```

- [ ] **Step 2: Replace first raw vibrate (line ~219)**

Find:
```typescript
try { navigator.vibrate?.(50); } catch { /* ignored in simulated environments */ }
```
(Inside the long-press timer callback that starts drag)

Replace with:
```typescript
getHapticFeedback().impact("heavy");
```

Long-press drag activation = heavy.

- [ ] **Step 3: Replace second raw vibrate (lines ~258-260)**

Find:
```typescript
if (navigator.vibrate) {
  navigator.vibrate(50);
}
```
(Inside `handleTouchMove`, the horizontal drag accelerated activation)

Replace with:
```typescript
getHapticFeedback().impact("heavy");
```

Same interaction — accelerated drag activation.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/feedback/components/manage/FeedbackKanbanCard.svelte
git commit -m "refactor(haptics): migrate FeedbackKanbanCard from raw vibrate to haptic service"
```

---

### Task 8: Add ESLint Rule

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add no-restricted-properties rule**

In the `rules` object of the main TypeScript configuration block (inside `files: ["**/*.ts"]`), add:

```javascript
"no-restricted-properties": [
  "error",
  {
    object: "navigator",
    property: "vibrate",
    message: "Use getHapticFeedback() service instead of raw navigator.vibrate. See docs/superpowers/specs/2026-04-26-haptic-feedback-v2-design.md",
  },
],
```

Note: This only catches `.ts` files since `.svelte` files are in the ignores list. The Svelte files are covered by the grep-based check during PR review.

- [ ] **Step 2: Verify lint passes on HapticFeedback.ts**

The implementation file no longer uses `navigator.vibrate` (it routes through `@capacitor/haptics`), so it should pass cleanly.

Run: `npx eslint src/lib/shared/application/services/implementations/HapticFeedback.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore(haptics): add ESLint rule blocking raw navigator.vibrate usage"
```

---

### Task 9: Verify and Final Typecheck

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: 0 errors from our changes (pre-existing WebGPU type error is unrelated).

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including the new `haptic-feedback.test.ts`.

- [ ] **Step 3: Grep for remaining raw vibrate calls**

Run: `grep -rn "navigator\.vibrate" src/ --include="*.ts" --include="*.svelte" | grep -v "node_modules" | grep -v "HapticFeedback.ts"`
Expected: Zero results. All raw vibrate calls have been migrated.

- [ ] **Step 4: Commit all remaining changes (if any unstaged)**

```bash
git status
```

If clean, no commit needed. If anything unstaged, stage and commit with appropriate message.
