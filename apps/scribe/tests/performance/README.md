# Performance Tests

Performance and memory leak tests for TKA Scribe.

## Tests

### `animation-canvas-memory-leak.spec.ts`

Tests for memory leaks in the animation canvas during continuous playback.

**What it tests:**

- Memory stability during extended playback (30 seconds)
- Cache cleanup when switching sequences
- Pre-rendered frame cleanup when playback stops

**Fixes verified:**

- Unbounded trail buffer growth (TrailCaptureService)
- Path cache accumulation (AnimatorCanvas)
- Pre-rendered frame memory not being freed (SequenceFramePreRenderer)

**How to run:**

```bash
# Run just the memory leak test
npm run test:e2e -- tests/performance/animation-canvas-memory-leak.spec.ts

# Run with headed browser (see what's happening)
npm run test:e2e -- tests/performance/animation-canvas-memory-leak.spec.ts --headed

# Run on mobile viewport only
npm run test:e2e -- tests/performance/animation-canvas-memory-leak.spec.ts --project=chromium

# Run with debug mode
npm run test:e2e -- tests/performance/animation-canvas-memory-leak.spec.ts --debug
```

**What to look for:**

- ✅ Memory growth stays under 50% over 30 seconds
- ✅ No emergency pruning warnings (`⚠️ Trail memory limit reached`)
- ✅ Cleanup logs when stopping playback (`🧹 clearing pre-rendered frames`)
- ✅ Cleanup logs when changing sequences (`🧹 Sequence changed, clearing caches`)

**Expected results:**

- Initial memory: ~50-100 MB
- After 30s playback: <150 MB (should stabilize, not grow continuously)
- No crashes or out-of-memory errors

### `beat-addition-performance.spec.ts`

Tests performance of beat addition in the create module.

## Running All Performance Tests

```bash
npm run test:e2e -- tests/performance/
```
