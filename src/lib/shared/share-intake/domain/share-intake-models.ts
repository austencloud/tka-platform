/** Where an intake came from. Only "native" is implemented; "pwa" is reserved. */
export type ShareIntakeSource = "native" | "pwa";

export type ShareIntakeStatus =
  | "received"
  | "needs-auth"
  | "ready"
  | "partially-sent"
  | "failed";

/** A file as the plugin hands it to us: a path, not bytes. */
export interface SharedFileDescriptor {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/**
 * Why one piece of a share did not make it. Every drop in the pipeline pushes
 * one of these onto the intake and logs it. A bare `return` that swallows a
 * file is the failure mode this type exists to make impossible.
 */
export type IntakeProblemReason =
  | "unsupported-type"
  | "too-large"
  | "empty"
  | "too-many"
  | "unreachable"
  | "not-found"
  | "text-truncated"
  | "title-truncated"
  | "decode-failed"
  | "resolve-failed"
  | "route-failed"
  | "send-dropped";

export interface IntakeProblem {
  /** The file (or code) this concerns. Empty string when it concerns the share itself. */
  name: string;
  reason: IntakeProblemReason;
  /** Technical detail for the console. Never rendered raw to the user. */
  detail?: string;
}

/** Normalized payload. Everything downstream is platform-blind. */
export interface SharedIntake {
  receiptId: string;
  source: ShareIntakeSource;
  files: File[];
  text?: string;
  title?: string;
  status: ShareIntakeStatus;
  receivedAt: number;
  /** Everything that was dropped, truncated, or failed. Never empty silently. */
  problems: IntakeProblem[];
  /**
   * The conversation the user picked straight from the Android share sheet, if
   * they used a Direct Share target rather than the plain app row.
   *
   * Persisted with the record on purpose: it must survive the same reload,
   * crash and sign-in round trip the bytes do, or the share silently
   * downgrades to "pick someone" after an auth detour.
   */
  targetConversationId?: string;
}

/**
 * What `deriveReceiptId` hashes. Deliberately NOT `SharedIntake`: the id has to
 * be computed from the plugin's raw descriptors, before any File exists.
 *
 * `texts` is plural while `SharedIntake.text` is a single optional string
 * because Android can deliver several EXTRA_TEXT values. The adapter maps
 * absence to an EMPTY ARRAY, never to `[""]` - the two hash differently, and
 * picking the wrong one desyncs the id between the two cold-launch deliveries.
 *
 * `title` (Android EXTRA_SUBJECT) is intentionally NOT hashed: it is decorative,
 * and some senders populate it inconsistently between deliveries.
 */
export interface ReceiptInput {
  files: SharedFileDescriptor[];
  texts: string[];
}

/** Per-item routing decision. Classification is per file, never per batch. */
export type IntakeItem
  = { kind: "card"; code: string; file: File }
  | { kind: "image"; file: File }
  /**
   * A second photo of a card already seen in this batch. NOT an image: filing
   * it as one would send a picture of a card into a conversation, which is
   * what the first draft did and what its own test asserted.
   */
  | { kind: "duplicate"; code: string; file: File };

export interface IntakeClassification {
  items: IntakeItem[];
  /** A TKA code found in the shared text, if any. */
  textCode: string | null;
  /**
   * Shared text minus any code that was extracted from it. Becomes the
   * prefilled message note. Kept even when a code WAS found - "look at this
   * one" alongside a link is exactly the case that matters.
   */
  residualText: string | null;
  problems: IntakeProblem[];
}
