export type ShortCodeShareErrorCode =
  | "MIXED_CHOREOGRAPHY_UNSUPPORTED"
  | "SOLO_TITLE_TOO_LONG";

export class ShortCodeShareError extends Error {
  constructor(
    readonly code: ShortCodeShareErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ShortCodeShareError";
  }
}

export function getShortCodeShareMessage(error: unknown): string | null {
  return error instanceof ShortCodeShareError ? error.message : null;
}
