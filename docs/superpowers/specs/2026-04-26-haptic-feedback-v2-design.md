# Haptic Feedback System v2

## Problem

The current haptic service uses `navigator.vibrate` patterns and an iOS Safari checkbox hack as fallbacks. Both produce buzzy, imprecise vibrations that violate the core principle: good haptics are invisible. Android's own docs say "avoid buzzy haptics for touch feedback; choose no haptics instead." Additionally, the type system is flat (selection/success/warning/error) and doesn't match the Apple HIG / Material Design semantic model that every native app uses. Three files bypass the service entirely with raw `navigator.vibrate` calls.

## Design Principles

1. **Invisible haptics** — users should feel the interface is "responsive" and "physical" without consciously noticing the haptic events. The removal test: if you remove haptics and users say the app feels "less polished" but can't say why, you've done it right.
2. **Multimodal coherence** — haptic timing must match visual events exactly. A delayed or mismatched haptic breaks the physical illusion immediately.
3. **Inverse frequency/intensity** — the more often a haptic fires, the lighter it must be. Steppers get ticks. Buttons get medium taps. Destructive confirms get heavy warnings.
4. **Native or nothing** — Capacitor's `@capacitor/haptics` provides real Taptic Engine / Android HapticFeedbackConstants access. On web without Capacitor, the service is a silent no-op. Buzzy `navigator.vibrate` is worse than silence.
5. **Consistent mapping** — same semantic event = same haptic everywhere. No per-screen customization of intensity for the same interaction type.

## New Type System

Three categories matching Apple UIFeedbackGenerator / Android HapticFeedbackConstants:

### Impact (discrete UI interactions)

| Style | Capacitor | iOS Native | Android Native | Use Case |
|---|---|---|---|---|
| `light` | `ImpactStyle.Light` | UIImpact `.light` | `GESTURE_END` | Dismiss, navigation, tab switch, drag start, subtle confirmation |
| `medium` | `ImpactStyle.Medium` | UIImpact `.medium` | `EFFECT_CLICK` | Button tap, toggle, drag drop, standard discrete action |
| `heavy` | `ImpactStyle.Heavy` | UIImpact `.heavy` | `LONG_PRESS` | Long-press trigger, pull-to-refresh commit, destructive action initiation |

### Notification (outcomes)

| Type | Capacitor | iOS Native | Android Native | Use Case |
|---|---|---|---|---|
| `success` | `NotificationType.Success` | UINotification `.success` | `CONFIRM` | Save complete, upload finished, action succeeded |
| `warning` | `NotificationType.Warning` | UINotification `.warning` | `REJECT` | Approaching limit, pending destructive action, boundary alert |
| `error` | `NotificationType.Error` | UINotification `.error` | `REJECT` | Validation failure, network error, rejected input |

### Selection (continuous discrete changes)

| Capacitor | iOS Native | Android Native | Use Case |
|---|---|---|---|
| `selectionChanged()` | UISelectionFeedback | `SEGMENT_TICK` | Stepper increment/decrement, picker scroll, slider snap point |

## Interaction Mapping (Canonical Reference)

Every interaction in TKA maps to exactly one haptic call:

| Interaction | Method | Rationale |
|---|---|---|
| Button tap (primary/important) | `impact('medium')` | Standard discrete action |
| Button tap (secondary/subtle) | `impact('light')` | Lower-weight actions |
| Toggle switch on/off | `impact('medium')` | Confirms state change |
| Long-press trigger | `impact('heavy')` | Signals gesture recognition |
| Context menu dismiss | `impact('light')` | Subtle completion signal |
| Sheet/drawer/modal close | `impact('light')` | Dismissal confirmation |
| Navigation / tab switch | `impact('light')` | Very subtle, almost optional |
| Stepper increment/decrement | `selection()` | Discrete tick per step |
| Slider value change (snapped) | `selection()` | Tick at each snap point |
| Drag start | `impact('light')` | Object picked up |
| Drag drop/end | `impact('medium')` | Object landed |
| Swipe action threshold | `impact('light')` | Crossed commit point |
| Save / action succeeded | `notification('success')` | Positive outcome |
| Upload complete | `notification('success')` | Positive outcome |
| Validation failure | `notification('error')` | Rejected input |
| Network error | `notification('error')` | Operation failed |
| Destructive action confirm | `notification('warning')` | Before irreversible action |
| Approaching limit/boundary | `notification('warning')` | Attention required |
| Context menu item action | `impact('medium')` | Discrete action |
| Keyboard key press | `impact('light')` | Frequent, must be subtle |
| Quiz correct answer | `notification('success')` | Learning feedback |
| Quiz wrong answer | `notification('error')` | Learning feedback |
| Sequence generated | `notification('success')` | Creation complete |

## Public API

```typescript
interface IHapticFeedback {
  // New semantic methods
  impact(style: 'light' | 'medium' | 'heavy'): boolean;
  notification(type: 'success' | 'warning' | 'error'): boolean;
  selection(): boolean;

  // Backward compat — maps to new types internally
  trigger(type?: HapticFeedbackType): boolean;

  // Animation-synchronized haptics (effort mapper)
  triggerEffort(effortId: EffortId, params?: EffortParams, durationMs?: number): boolean;

  // Configuration
  isSupported(): boolean;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  getConfig(): HapticFeedbackConfig;
  updateConfig(config: Partial<HapticFeedbackConfig>): void;

  // Custom patterns (for animation haptics only)
  setCustomPattern(name: string, pattern: number[]): void;
  triggerCustom(name: string): boolean;
}
```

### Backward Compatibility Mapping

| Old call | New equivalent |
|---|---|
| `trigger('selection')` | `impact('medium')` |
| `trigger('success')` | `notification('success')` |
| `trigger('warning')` | `notification('warning')` |
| `trigger('error')` | `notification('error')` |
| `trigger()` (no arg) | `impact('medium')` |
| `trigger('custom')` | `triggerCustom(name)` (unchanged) |

All 244 existing callers continue working. No breaking change. New code uses `impact()` / `notification()` / `selection()`.

## Platform Strategy

```
Is Capacitor native? ──yes──→ Haptics.impact() / notification() / selectionChanged()
        │
       no
        │
        ↓
    Silent no-op (return false)
```

### What Gets Removed

- `navigator.vibrate()` fallback — buzzy anti-pattern on Android web
- iOS Safari checkbox hack — fragile, single haptic type, breaks on WebKit updates
- `FEEDBACK_PATTERNS` duration arrays — replaced by native semantic calls
- `IOS_PULSE_COUNTS` mapping — no longer needed
- `createIOSHapticElement()` / `triggerIOSHaptic()` / `detectIOSSafariSupport()` — entire hack removed
- `supportsVibrationAPI` / `supportsIOSHaptic` flags — replaced by single `isNative` check

### What Stays

- `HapticFeedback` class structure and singleton pattern
- `getHapticFeedback()` factory
- `IHapticFeedback` interface (extended)
- Throttle mechanism (50ms)
- `prefers-reduced-motion` listener
- Settings toggle integration
- `EffortHapticMapper` (routes through Capacitor on native, no-op on web)
- Test mock

## Rogue Call Migration

| File | Current | New |
|---|---|---|
| `ContextMenu.svelte` | inline `navigator.vibrate(8)` | `getHapticFeedback().impact('light')` for dismiss, `impact('medium')` for item action |
| `CompositionGrid.svelte` | `navigator.vibrate(50)`, `navigator.vibrate(30)` | `impact('medium')` for drag drop, `impact('light')` for drag start |
| `FeedbackKanbanCard.svelte` | `navigator.vibrate(50)` x2 | `impact('medium')` for drag actions |

## Animation Haptics (Effort Mapper)

The `EffortHapticMapper` stays but its output route changes:

- **On Capacitor native:** Convert effort curve to a sequence of `Haptics.impact()` calls with timed delays, matching prop velocity. The mapper already produces pulse timing — just route each pulse through `Haptics.impact({ style: ImpactStyle.Light })` instead of `navigator.vibrate`.
- **On web:** No-op. Animation haptics are a native-only feature.
- **Verification needed:** At slow BPM (e.g., 30 BPM), confirm haptic pulses fire when the prop actually moves (respecting easing curve delay), not at uniform beat intervals.

## ESLint Rule

Add a custom ESLint rule or eslint-plugin-regexp pattern to flag `navigator.vibrate` in any file except `HapticFeedback.ts`:

```json
{
  "no-restricted-globals": [
    "error",
    {
      "name": "navigator.vibrate",
      "message": "Use getHapticFeedback() service instead of raw navigator.vibrate"
    }
  ]
}
```

## Testing

- Existing `mock-haptic-service.ts` tracks all trigger calls — extend to track `impact()` / `notification()` / `selection()` with arguments
- Existing `EffortHapticMapper.test.ts` stays unchanged (tests pattern generation, not platform routing)
- Add unit test verifying backward compat mapping (`trigger('selection')` → `impact('medium')`)
- Physical device testing required for haptic feel tuning — emulators are useless for this

## Migration Strategy

1. **Phase 1 (this session):** Rewrite `HapticFeedback.ts` internals. Add new methods. Wire backward compat. Remove vibrate/iOS hack. Fix 3 rogue files + ContextMenu. Update mock. Update interface.
2. **Phase 2 (gradual):** Migrate callers from `trigger('selection')` → `impact('medium')` etc. Not blocking — old API works indefinitely. Prioritize high-frequency interactions (steppers → `selection()`, dismissals → `impact('light')`).
3. **Phase 3 (when Capacitor build is testable on device):** Tune haptic feel. Verify effort mapper at slow BPM. Test on physical iOS and Android devices.

## Anti-Patterns to Enforce

| Anti-Pattern | Rule |
|---|---|
| Haptics on every scroll event | Never. Scroll is passive. |
| Heavy haptic for minor action | Match intensity to action weight. |
| Haptics without visual confirmation | Haptics complement, never replace visual feedback. |
| Custom vibration patterns for standard interactions | Use semantic types. Custom patterns only for animation sync. |
| Haptics on non-interactive elements | Never. Only user-initiated actions. |
| Inconsistent mapping across screens | Same interaction = same haptic type everywhere. |
| Raw `navigator.vibrate` anywhere | Lint rule blocks it. Service only. |

## Sources

- Apple HIG: Playing Haptics
- UIImpactFeedbackGenerator / UINotificationFeedbackGenerator / UISelectionFeedbackGenerator
- Android Haptics Design Principles
- Android HapticFeedbackConstants (27+ semantic constants)
- Material Design: Android Haptics
- Capacitor Haptics Plugin API (`@capacitor/haptics ^8.0.2`)
- Web Haptics API proposal (WICG, not yet implemented)
- "Invisible haptics" principle: haptics succeed when users forget they're receiving tactile feedback
