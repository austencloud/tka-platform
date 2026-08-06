# Library All Results-First Implementation

**Spec:** `docs/superpowers/specs/active/2026-08-06-library-all-results-first-design.md`

## Tasks

- [x] Add pure tests for Library browse dates and pane allocation.
- [x] Normalize Library sequences to an explicit `dateAdded` at the Browse
      engine boundary and share one browse-date resolver between sort and filter.
- [x] Start `AllLibraryView` on its full-page grid with Recent as the initial
      sort.
- [x] Extend `FilterWorkspace` with an optional Done outcome and return to the
      same filtered grid.
- [x] Replace ceiling-as-need measurement with a fit-first height budget.
- [x] Run focused tests, `npm run check`, and the required visual sweep.
- [x] Record measured and visual evidence below.

## Evidence

- Focused Vitest: 3 files and 12 tests passed, covering browse-date
  normalization, Recent filter/sort behavior, allocation math, and the existing
  Gallery split contract.
- `npm run check`: 0 errors and 0 warnings at the implementation checkpoint.
  The post-visual `check:fast` reported no diagnostics in the new allocator,
  date resolver, Library view, or Filter workspace. It still reports the
  repository's unrelated existing diagnostics, including the missing
  `curated` section mapping in the Browse engine.
- Task-owned source and docs pass `git diff --check`. Prettier passes every
  task-owned file except `browse-filter.ts` and `browse-sorter.ts`, whose
  pre-existing formatting is intentionally preserved to avoid unrelated churn.
- Chrome DevTools used exact CSS viewports. Start-position measurements:

| Viewport  |  Catalog |  Editor | Choice row | Pictograph | Result                 |
| --------- | -------: | ------: | ---------: | ---------: | ---------------------- |
| 1920x1080 |  383.6px | 650.4px |    175.3px |    102.1px | 3 visible, no overflow |
| 2560x1440 |  405.6px | 988.4px |      288px |    178.7px | 3 visible, no overflow |
| 3840x2160 | 1332.8px | 781.2px |      480px |      288px | 3 visible, no overflow |

- At 1440x900, 820x1180, 960x412, and 375x667, the step-through composition
  showed a 44px Done control and no horizontal document overflow. Alpha, Beta,
  and Gamma remained visible. Done returned to the full result grid at both
  split-pane and step-through widths.
