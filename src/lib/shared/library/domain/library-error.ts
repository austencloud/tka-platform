/**
 * Error class for library operations.
 *
 * Lives in domain/ so service modules (library-repository,
 * library-batch-operations, library-recycle-bin) can all throw it
 * without importing each other.
 */

export class LibraryError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "INVALID_DATA"
      | "NETWORK"
      | "QUOTA_EXCEEDED"
      | "ALREADY_EXISTS"
      | "GUEST_CAP",
    public sequenceId?: string
  ) {
    super(message);
    this.name = "LibraryError";
  }
}
