# Testing Philosophy: "Earned Tests"

**Core principle:** Tests are earned, not given. Code must prove it deserves a test.

## Why This Approach

- Most tests die - they get written, code changes, they're deleted
- Tests are insurance - only pay for expensive risks
- Production is the first test - real users find real bugs
- Zero fluff tolerance - if it doesn't provide measurable value, delete it

## When to Write Tests

| Scenario                           | Write Test? | Why                                  |
| ---------------------------------- | ----------- | ------------------------------------ |
| Pure algorithm/calculation         | Yes         | Math is stable, bugs are subtle      |
| Silent data corruption risk        | Yes         | You won't notice until it's too late |
| Bug that regressed twice           | Yes         | Proven problem worth preventing      |
| New feature, still evolving        | No          | Will change, test will die           |
| UI component                       | No          | You'll see if it's broken            |
| Glue code / wiring                 | No          | Obvious when broken                  |
| Something you'd notice immediately | No          | Your eyes are the test               |

## The "Silent Bug" Test

Ask yourself: "If this breaks, will I notice immediately, or will it silently produce wrong output?"

**Only test the silent ones.**

## When to Delete Tests

- Code changed so much the test is meaningless
- Test requires complex mocking that breaks constantly
- You can't remember why the test exists
- Test is for something you'd notice immediately if broken

## Current Test Files

Tests live in `tests/unit/` and cover core algorithms where bugs would be subtle:

- `DimensionCalculationService.test.ts` - Export dimension math
- `GridPositionDeriver.test.ts` - Grid position calculations
- `ReversalDetectionService.test.ts` - Prop reversal detection
- `DataTransformer.test.ts` - Pictograph data transforms

Run tests: `npm test`
