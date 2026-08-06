export interface PaneHeightAllocationInput {
  /** Inner height shared by the catalog and editor, excluding their gap. */
  availableHeight: number;
  catalogMinimum: number;
  catalogMaximum: number;
  /** Editor chrome outside the repeating option rows. */
  editorFixed: number;
  rowCount: number;
  rowGap: number;
  rowMinimum: number;
  rowMaximum: number;
}

export interface PaneHeightAllocation {
  catalogHeight: number;
  editorHeight: number;
  rowHeight: number;
  editorScrolls: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Divides the split-pane column without turning a card ceiling into a minimum.
 * The catalog keeps its natural rows. The editor then fits every bounded row
 * into the remaining height, and only scrolls when even the row minimums do
 * not fit. A tall pane gives true surplus back to the catalog after the editor
 * reaches its authored row ceiling.
 */
export function allocatePaneHeight(
  input: PaneHeightAllocationInput
): PaneHeightAllocation {
  const availableHeight = Math.max(0, input.availableHeight);
  const catalogMinimum = clamp(input.catalogMinimum, 0, availableHeight);
  const catalogMaximum = clamp(
    input.catalogMaximum,
    catalogMinimum,
    availableHeight
  );
  const rowCount = Math.max(0, Math.floor(input.rowCount));
  const rowGapTotal = Math.max(0, rowCount - 1) * Math.max(0, input.rowGap);
  const editorFixed = Math.max(0, input.editorFixed);
  const rowMinimum = Math.max(0, input.rowMinimum);
  const rowMaximum = Math.max(rowMinimum, input.rowMaximum);

  if (rowCount === 0) {
    const editorViewport = Math.max(0, availableHeight - catalogMinimum);
    const editorContentHeight = Math.min(editorFixed, editorViewport);
    const catalogHeight = clamp(
      availableHeight - editorContentHeight,
      catalogMinimum,
      catalogMaximum
    );
    const editorHeight = availableHeight - catalogHeight;
    return {
      catalogHeight,
      editorHeight,
      rowHeight: 0,
      editorScrolls: editorHeight < editorFixed,
    };
  }

  const editorViewport = Math.max(0, availableHeight - catalogMinimum);
  const editorMinimum = editorFixed + rowCount * rowMinimum + rowGapTotal;
  const editorMaximum = editorFixed + rowCount * rowMaximum + rowGapTotal;

  if (editorViewport < editorMinimum) {
    return {
      catalogHeight: catalogMinimum,
      editorHeight: editorViewport,
      rowHeight: rowMinimum,
      editorScrolls: true,
    };
  }

  const fittedEditorHeight = Math.min(editorViewport, editorMaximum);
  const fittedRowHeight = clamp(
    (fittedEditorHeight - editorFixed - rowGapTotal) / rowCount,
    rowMinimum,
    rowMaximum
  );
  const editorContentHeight =
    editorFixed + rowCount * fittedRowHeight + rowGapTotal;
  const catalogHeight = clamp(
    availableHeight - editorContentHeight,
    catalogMinimum,
    catalogMaximum
  );

  return {
    catalogHeight,
    editorHeight: availableHeight - catalogHeight,
    rowHeight: fittedRowHeight,
    editorScrolls: false,
  };
}
