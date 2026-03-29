# Tile Movement Reference

Best practices for smooth 2D tile-based movement in DOM/CSS browser games. Derived from analysis of Pokemon, Stardew Valley, Celeste, CrossCode, and Bomberman implementations.

---

## The Core Architecture: rAF + Lerp (not CSS transitions)

CSS transitions run asynchronously from game logic. The game cannot query progress, cancel mid-transition, or synchronize input with animation completion. Use `requestAnimationFrame` for the game loop and set `transform` directly each frame.

### State Model

```typescript
let logicalX = spawnX;    // Committed tile position
let logicalY = spawnY;
let targetX = spawnX;     // Where we're heading (same as logical when idle)
let targetY = spawnY;
let moveProgress = 0;     // 0.0 to 1.0
let isTransitioning = false;

const MOVE_DURATION_MS = 120; // Time to cross one tile
```

### Game Loop

```typescript
function gameLoop(timestamp: number) {
  const dt = Math.min(timestamp - lastTimestamp, 50); // clamp for tab-switch
  lastTimestamp = timestamp;

  if (isTransitioning) {
    moveProgress += dt / MOVE_DURATION_MS;
    if (moveProgress >= 1.0) {
      logicalX = targetX;
      logicalY = targetY;
      isTransitioning = false;

      // Check held keys / input buffer — start next move immediately
      const nextDir = getBufferedDirection();
      if (nextDir) startMove(nextDir);
    }
    // Render at eased position
    const t = easeOutQuad(Math.min(moveProgress, 1.0));
    visualX = lerp(logicalX, targetX, t);
    visualY = lerp(logicalY, targetY, t);
  }

  rafId = requestAnimationFrame(gameLoop);
}
```

### Why NOT CSS transitions for game movement

- Cannot query "how far along is this transition?"
- Cannot cancel and redirect mid-transition
- `transitionend` events can be missed or delayed
- Cannot sync input processing with animation completion
- Frame-rate independence is browser-controlled, not game-controlled

---

## Input Handling Rules

### 1. First press = immediate move (zero delay)

No repeat delay on the first keypress. The character moves the instant the key is pressed.

### 2. Check held keys on arrival, not on a timer

Pokemon pattern: when the character arrives at the target tile, check if the movement key is still held. If yes, start the next move immediately with zero gap. No `setInterval`, no `REPEAT_DELAY_MS`.

### 3. Buffer inputs during transitions (100-150ms window)

```typescript
function onKeyDown(dir: Direction) {
  heldDirections.add(dir);
  if (!isTransitioning) {
    startMove(dir);
  } else {
    inputBuffer = { direction: dir, timestamp: performance.now() };
  }
}

function getBufferedDirection(): Direction | null {
  // Priority 1: held keys (continuous movement)
  const combined = resolveHeldDirections(heldDirections);
  if (combined) return combined;
  // Priority 2: buffered tap (pressed during transition)
  if (inputBuffer && performance.now() - inputBuffer.timestamp < 150) {
    const dir = inputBuffer.direction;
    inputBuffer = null;
    return dir;
  }
  return null;
}
```

### 4. Wall sliding for diagonals

When diagonal is blocked, try each cardinal axis independently:

```typescript
if (canDiag) move(dx, dy);
else if (canMoveTo(x + dx, y)) move(dx, 0);  // slide horizontal
else if (canMoveTo(x, y + dy)) move(0, dy);  // slide vertical
```

---

## Easing

| Curve | Formula | Feel |
|-------|---------|------|
| `easeOutQuad` | `1 - (1-t)^2` | Snappy start, gentle stop. **Recommended.** |
| `easeOutCubic` | `1 - (1-t)^3` | Slightly weightier |
| `linear` | `t` | Robotic. Avoid. |
| `easeInOutQuad` | slow start + slow stop | Feels sluggish. Avoid. |

No ease-in component. Any startup delay feels like input lag.

---

## Camera

Smooth follow with exponential lerp (per frame), not CSS transition:

```typescript
const CAMERA_SMOOTHING = 0.12;
cameraX = lerp(cameraX, targetCameraX, CAMERA_SMOOTHING);
cameraY = lerp(cameraY, targetCameraY, CAMERA_SMOOTHING);
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Input delay before first move | First press = immediate, no delay |
| Gap between repeat moves | Check held keys on arrival, not timer |
| CSS transition duration mismatch with game logic | Use rAF loop for timing |
| No input buffering | Buffer last input, consume on arrival |
| Ease-in on movement start | Use ease-out only |
| Timer-based repeat (`setInterval`) | Use rAF delta time |
| Full stop on diagonal collision | Wall slide: try each axis |
| Animating `left`/`top` instead of `transform` | Forces reflow. Use `transform: translate()` |
| Not using `will-change: transform` | Jank on first movement |

---

## Diagonal Speed

Diagonal covers sqrt(2) distance in the same time. Options:
- Multiply duration by 1.414 for diagonals (consistent visual speed)
- Keep same duration (feels slightly faster diagonally — most classic RPGs do this)

---

Sources: Pokemon (Gen 3+), Stardew Valley, Celeste input buffering, Bomberman wall sliding, Paladin-T smooth tile algorithm, MDN CSS/JS animation performance guide, easings.net
