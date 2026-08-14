# Forest production release verification

Date: 2026-08-13

## Artifact contracts

- Environment GLB: 20,887,772 bytes, 295 trees, 11 structural sources.
- Near-frame GLB: 18,846,964 bytes, 128,855 instanced grass clumps, ground
  ecosystem version 7.
- Forest ground atlas and family mask passed their texture contract.
- The approved camp remains 34.059 metres from the stage center, and the camp
  approach remains at a 2.5 percent maximum grade.
- The scene gate manifest validates against the current source, reports,
  runtime owners, GLBs, and registered visual target.

## Code verification

- Forest focused tests: 31 passed across atmosphere, foliage grading, ground
  detail, near-frame visibility, shadow roles, and rooted wind.
- `svelte-check`: 0 errors and 0 warnings.
- Production web build: passed.
- The full dirty-checkout unit run recorded 8,882 passes and 21 failures in
  unrelated active Fuse, onboarding, theme, effects, and timing-sensitive
  work. Clean `main` CI remains the deployment authority.

## Runtime visual proof

The live Forest review route rendered the current Day hero at:

- `day-hero-1920x1080.png`
- `day-hero-2560x1440.png`
- `day-hero-3840x2160.png`
- `day-hero-1440x900.png`
- `day-hero-820x1180.png`
- `day-hero-960x412.png`
- `day-hero-375x667.png`

`night-hero-1920x1080.png` confirms that the grass remains dark and matte in
the locked Night atmosphere. The final Day and Night review routes emitted no
console errors or warnings.
