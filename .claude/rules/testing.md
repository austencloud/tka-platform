# Testing Philosophy: Tests That Catch What Eyes Can't

**Core principle:** Tests exist to catch silent bugs -- things that would produce wrong output without anyone noticing.

## When to Write Tests

| Scenario | Write Test? | Why |
|----------|-------------|-----|
| Pure algorithm/calculation | Yes | Math is stable, bugs are subtle |
| Silent data corruption risk | Yes | You won't notice until it's too late |
| Data transformation pipelines | Yes | Wrong output looks plausible |
| Bug that regressed before | Yes | Proven problem worth preventing |
| Complex state transitions | Yes | Edge cases are invisible |
| Serialization/deserialization | Yes | Round-trip bugs are silent |
| UI component rendering | No | You'll see if it's broken |
| Glue code / wiring | No | Obvious when broken |
| Something you'd notice immediately | No | Your eyes are the test |

## The "Silent Bug" Test

Ask: "If this breaks, will I notice immediately, or will it silently produce wrong output?"

Test the silent ones. Skip the obvious ones.

## What Makes a Test Valuable

A good test:
- Catches a bug that would otherwise reach production unnoticed
- Tests a specific behavior with a clear assertion
- Doesn't just confirm the implementation does what it does (tautological)
- Would actually fail if the code broke in a meaningful way

A bad test:
- Confirms a component renders without crashing (yes, we can see that)
- Mocks so heavily it tests the mocks, not the code
- Asserts implementation details instead of behavior
- Would still pass even if the core logic was wrong

## Current Test Scope

49 test files in `tests/unit/` covering algorithms, calculations, data transforms, and domain logic. Run with `npm test`.
