# Shape Matrix Engine

Shared engine for the interactive VTG shape matrix: the flower axis, the
matrix grid, the six-realization drill, and cell rendering. Consumed by the
`/notation/shape-matrix` public destination, the `/notation` teaser, and the
lab dev harness (`src/routes/test/shape-matrix/+page.svelte`,
`src/lib/features/lab/vtg-lab/`).

No barrel export (`index.ts`) per this codebase's code-style convention —
import each symbol from its module path directly.

## Public surface

| Symbol | Path |
|---|---|
| `loadShapeMatrix`, `ShapeMatrixData` | `$lib/shared/shape-matrix/services/shape-matrix-flowers` |
| `applyFilter`, `defaultMatrixFilters`, `defaultAxisFilter`, `AxisFilter`, `MatrixFilters` | `$lib/shared/shape-matrix/domain/filter-flower-axis` |
| `matrixFiltersForSize`, `MatrixSize` | `$lib/shared/shape-matrix/domain/matrix-size-preset` |
| `ShapeMatrixGrid` (Svelte component, `onselect({blue,red})`) | `$lib/shared/shape-matrix/components/ShapeMatrixGrid.svelte` |
| `buildModeCards`, `ModeCard` (incl. `seq: SequenceData`) | `$lib/shared/shape-matrix/services/build-realization-cards` |
| `MODE_ORDER`, `MODE_LABEL`, `VtgMode` | `$lib/shared/shape-matrix/services/shape-matrix-realizations` |
| `verifyAndCorrect`, `ParityResult` | `$lib/shared/shape-matrix/services/verify-realization-parity` |
| `renderCell`, `renderHeader` | `$lib/shared/shape-matrix/services/shape-matrix-render` |
| `Flower`, `flowerKey`, `flowerLabel`, `buildFlowerAxis`, `ratioLabel`, `flowerTurnPattern` | `$lib/shared/shape-matrix/domain/flower-signature` |

## Known lab-side dependencies (not extracted in Phase 0)

`build-realization-cards.ts` and `shape-matrix-flowers.ts` still import three
helpers that remain in `src/lib/features/lab/vtg-lab/services/`:
`resolveRotationStyleMatrices`/`bakeVariationFront`/`bakeVariationBack`
(`resolve-rotation-style-matrices.ts`), `loadBaseIndex`/`resolveBase`
(`build-realization-sequence.ts`), and `buildFlowerSequence`
(`build-flower-sequence.ts`). The spec's Phase 0 move list did not include
these three files, so this module currently has a reverse dependency back
into the lab feature. Flagged for a future extraction pass if a public route
ever needs to bundle without the lab.
