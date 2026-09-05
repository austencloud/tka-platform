import type { TikaDirectorResponse } from "../domain/tika-director";

export interface TikaDirectorSubmitResult {
  response: TikaDirectorResponse;
  undo?: () => boolean;
}

/** A request and its undo belong to the scene revision that produced them. */
export function createTikaDirectorSession(input: {
  getRevision: () => string;
  isDisposed: () => boolean;
}) {
  async function execute(
    resolve: () => Promise<TikaDirectorResponse>,
    apply: (
      response: Extract<TikaDirectorResponse, { kind: "apply" }>
    ) => (() => void) | undefined,
    signal: AbortSignal
  ): Promise<TikaDirectorSubmitResult> {
    signal.throwIfAborted();
    const revision = input.getRevision();
    const response = await resolve();
    signal.throwIfAborted();
    if (input.isDisposed()) {
      throw new DOMException("The Stage was closed.", "AbortError");
    }
    if (response.kind !== "apply") return { response };
    if (input.getRevision() !== revision) {
      throw new Error(
        "The scene changed while TIKA was thinking. Send the direction again for the updated scene."
      );
    }
    const undo = apply(response);
    if (!undo) return { response };
    const appliedRevision = input.getRevision();
    let consumed = false;
    return {
      response,
      undo: () => {
        if (
          consumed ||
          input.isDisposed() ||
          input.getRevision() !== appliedRevision
        )
          return false;
        consumed = true;
        undo();
        return true;
      },
    };
  }

  return { execute };
}
