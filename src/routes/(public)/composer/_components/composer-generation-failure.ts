export type ComposerGenerationResult =
  | "idle"
  | "success"
  | "no-result"
  | "error";

/**
 * The generator currently reports an exhausted recipe as a plain Error. Keep
 * that expected outcome separate from an engine or chunk-loading failure so
 * the public demonstration can give the right recovery instruction.
 */
export function classifyComposerGenerationFailure(
  error: unknown
): Extract<ComposerGenerationResult, "no-result" | "error"> {
  if (!(error instanceof Error)) return "error";
  const message = error.message.toLowerCase();
  return message.includes("no valid") ||
    message.includes("unable to generate a valid")
    ? "no-result"
    : "error";
}
