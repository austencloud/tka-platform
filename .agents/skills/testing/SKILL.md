---
name: testing
description: Use when writing, reviewing, or deciding whether to write tests in this project. Enforces the "silent bug" philosophy — test what eyes can't catch, skip what's obvious when broken.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Testing Philosophy

**Core principle:** Tests exist to catch silent bugs — things that would produce wrong output without anyone noticing.

## The "Silent Bug" Test

Ask: *"If this breaks, will I notice immediately, or will it silently produce wrong output?"*

Test the silent ones. Skip the obvious ones.

## When to Write Tests

| Scenario | Test? | Why |
|----------|-------|-----|
| Pure algorithm/calculation | Yes | Math is stable, bugs are subtle |
| Silent data corruption risk | Yes | You won't notice until it's too late |
| Data transformation pipelines | Yes | Wrong output looks plausible |
| Bug that regressed before | Yes | Proven problem worth preventing |
| Complex state transitions | Yes | Edge cases are invisible |
| Serialization/deserialization | Yes | Round-trip bugs are silent |
| UI component rendering | No | You'll see if it's broken |
| Glue code / wiring | No | Obvious when broken |
| Something you'd notice immediately | No | Your eyes are the test |

## What Makes a Test Valuable

Good: catches a bug that would otherwise reach production unnoticed. Tests specific behavior with a clear assertion. Would fail if the code broke meaningfully.

Bad: confirms a component renders without crashing. Mocks so heavily it tests the mocks. Asserts implementation details. Would still pass if core logic was wrong.

Tests live in `tests/unit/`. Run with `npm test`.
