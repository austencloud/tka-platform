export type SequenceActionsHelpEntry = "selector" | "direct";

/** Desktop Help returns to its action browser. Mobile long-press has no
 * browser underneath it, so closing the detail returns to Sequence Actions. */
export function getHelpModeAfterDetailClose(
  entry: SequenceActionsHelpEntry
): "inactive" | "selecting" {
  return entry === "direct" ? "inactive" : "selecting";
}
