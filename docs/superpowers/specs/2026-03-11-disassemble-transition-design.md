# Disassemble/Reassemble Transition Animation

**Goal:** Choreographed Clone & Split animation when toggling between assembled and disassembled canvas views. Three real AnimatorCanvases animate from the assembled position to the disassembled layout (and vice versa) while animation continues seamlessly.

**Architecture:** FLIP (First-Last-Invert-Play) with Web Animations API. Compositor-only properties (transform + opacity) ensure 60fps.

**Tech Stack:** Svelte 5, Web Animations API, CSS container queries

---

## State Machine

```
assembled ──[toggle]──► disassembling ──[complete]──► disassembled
    ▲                                                      │
    └──────[complete]──── reassembling ◄──[toggle]─────────┘
```

Toggle requests during `disassembling` or `reassembling` are ignored.

## Disassemble Animation (600ms)

1. Measure assembled canvas rect (content-wrapper) before DOM switch
2. Render transition overlay: three AnimatorCanvases in disassembled layout
3. On first rAF: measure each slot rect, calculate FLIP inverse transforms
4. Animate all three slots FROM assembled position TO natural positions
   - Hero (both hands, opacity: 1): translates + scales to hero slot
   - Blue-only (opacity: 0→1 in first 150ms): translates + scales to bottom-left
   - Red-only (opacity: 0→1 in first 150ms): translates + scales to bottom-right
5. Progress bar fades in during second half (300-600ms)
6. On animation finish: switch to static DisassembleCanvasView

## Reassemble Animation (600ms)

Reverse of disassemble:
- Slots animate FROM natural positions TO stored assembled rect
- Blue/red fade out in last 150ms
- Progress bar fades out in first half
- On finish: switch to static assembled view

## FLIP Transform Math

```
tx = assembledCenter.x - slotCenter.x
ty = assembledCenter.y - slotCenter.y
sx = assembledRect.width / slotRect.width
sy = assembledRect.height / slotRect.height

CSS: translate(tx, ty) scale(sx, sy)
```

Transform-origin: center (default). Translate moves center, scale resizes around center.

## Animation Details

- **Duration:** 600ms
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — fast start, soft deceleration
- **Fill mode:** `both` — prevents flash before animation starts
- **Compositor only:** transform + opacity (no layout thrashing)
- **Reduced motion:** instant switch, no animation

## Files

### New: `DisassembleTransition.svelte`
Same layout as DisassembleCanvasView (hero + small-left + small-right + progress bar). On mount, measures slots, calculates FLIP transforms from assembledRect, animates via Web Animations API, fires `oncomplete`.

### Modified: `AnimatorCanvas.svelte`
- `disassembled: boolean` → `viewState: 'assembled' | 'disassembling' | 'disassembled' | 'reassembling'`
- Measures content-wrapper rect before transition
- Third template branch for transition states
- Passes `assembledRect` to transition component
- Ignores toggle during active transitions

## Canvas Continuity

All three transition canvases receive identical animation state (currentStep, isPlaying, blueProp, redProp). They initialize their engines on mount and render within 1 frame. Since the FLIP animation starts after one rAF (giving engines time to render), the first visible frame shows correct content at the assembled position.

## Edge Cases

| Case | Handling |
|------|----------|
| Rapid toggle | Ignored during transitions |
| Reduced motion | Instant state switch |
| Container resize | Minor misalignment OK; real layout takes over on complete |
| Null assembledRect | Fallback: centered square from container dims |
