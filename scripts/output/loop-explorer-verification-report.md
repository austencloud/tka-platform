# LOOP Explorer Verification Report

Generated: 2026-07-19T20:33:17.500Z
K=25 sequences per combo x slice, length=16, level=3, retries=3

Generation path: mcp-server engine-generation-adapter pattern (Node-native, same SequenceBuilder + engine used by the app and generate_sequence MCP tool) — rebuilt locally with the full 17-combo table because the MCP server's own LOOP_TYPE_MAP is missing `mirrored_rotated_swapped` (a real gap this harness surfaces, see Findings).

Detection: primary = `loopDetectorClass.detectLOOPType` (engine class-based detector, same one the app's `loop-detector.ts` delegates to). Secondary = `detectLOOPFromSteps` (functional halved-only detector), cross-checked where applicable (even letter-step count).

**Limitation:** circularity gate is an inlined approximation of `isSeamlesslyLoopable` (position + orientation closure), not a literal import — that module is SvelteKit-`$lib`-aliased app code unreachable from a plain Node script. See script header for detail.

## Per-combo accuracy

| Combo | Slice | Exact/K | Accuracy | 2nd-detector agree | Crashes | Not-circular | Curated seeds |
|---|---|---|---|---|---|---|---|
| rotated | halved | 13/25 | 52.0% | 13/13 | 0 | 45 | 3/3 |
| rotated | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| flipped | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| swapped | halved | 13/25 | 52.0% | 13/13 | 0 | 49 | 3/3 |
| inverted | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| rewound | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+inverted | halved | 14/25 | 56.0% | 14/14 | 0 | 47 | 3/3 |
| rotated+inverted | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| rotated+inverted | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| swapped+inverted | halved | 13/25 | 52.0% | 13/13 | 0 | 51 | 3/3 |
| mirrored+rotated | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+rotated | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+swapped | halved | 15/25 | 60.0% | 15/15 | 0 | 40 | 3/3 |
| rotated+swapped | halved | 15/25 | 60.0% | 15/15 | 0 | 45 | 3/3 |
| rotated+swapped | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+inverted+rotated | halved | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+inverted+rotated | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+rotated+swapped | halved | 0/25 | 0.0% | 0/0 | 75 | 0 | 0/3 |
| mirrored+rotated+swapped | quartered | 11/25 | 44.0% | 11/11 | 0 | 0 | 3/3 |
| mirrored+swapped+inverted | halved | 17/25 | 68.0% | 17/17 | 0 | 39 | 3/3 |
| rotated+swapped+inverted | halved | 11/25 | 44.0% | 11/11 | 0 | 48 | 3/3 |
| rotated+swapped+inverted | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |
| mirrored+rotated+inverted+swapped | halved | 23/25 | 92.0% | 23/23 | 0 | 21 | 3/3 |
| mirrored+rotated+inverted+swapped | quartered | 25/25 | 100.0% | 25/25 | 0 | 0 | 3/3 |

## Findings

- **rotated@halved**: 52.0% exact (13/25).
  - 45 run(s) failed the circularity gate.
- **swapped@halved**: 52.0% exact (13/25).
  - 49 run(s) failed the circularity gate.
- **mirrored_inverted@halved**: 56.0% exact (14/25).
  - 47 run(s) failed the circularity gate.
- **swapped_inverted@halved**: 52.0% exact (13/25).
  - 51 run(s) failed the circularity gate.
- **mirrored_swapped@halved**: 60.0% exact (15/25).
  - 40 run(s) failed the circularity gate.
- **rotated_swapped@halved**: 60.0% exact (15/25).
  - 45 run(s) failed the circularity gate.
- **mirrored_rotated_swapped@halved**: 0.0% exact (0/25).
  - 75 crash(es): LOOP type "mirrored_rotated_swapped" is not yet implemented for end position selection.
  - Curated fallback pool incomplete for this combo x slice: only 0/3 verified seeds.
- **mirrored_rotated_swapped@quartered**: 44.0% exact (11/25).
- **mirrored_swapped_inverted@halved**: 68.0% exact (17/25).
  - 39 run(s) failed the circularity gate.
- **rotated_swapped_inverted@halved**: 44.0% exact (11/25).
  - 48 run(s) failed the circularity gate.
- **mirrored_rotated_inverted_swapped@halved**: 92.0% exact (23/25).
  - 21 run(s) failed the circularity gate.

## Summary

- Total combo x slice rows: 25
- Total generation runs: 625
- Total exact matches: 495
- Total crashes: 75