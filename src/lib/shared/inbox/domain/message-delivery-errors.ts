const RETRYABLE_CODES = new Set([
  "functions/cancelled",
  "functions/deadline-exceeded",
  "functions/internal",
  "functions/resource-exhausted",
  "functions/unavailable",
  "functions/unknown",
  "storage/canceled",
  "storage/retry-limit-exceeded",
  "storage/server-file-wrong-size",
  "storage/unknown",
]);

const USER_MESSAGES: Record<string, string> = {
  "functions/already-exists": "That message ID is already in use.",
  "functions/failed-precondition":
    "The message it replied to is no longer available.",
  "functions/invalid-argument": "This message could not be sent as written.",
  "functions/not-found": "This conversation is no longer available.",
  "functions/permission-denied":
    "You no longer have permission to send to this conversation.",
  "functions/unauthenticated": "Sign in again to send this message.",
  "storage/unauthenticated": "Sign in again to send this image.",
  "storage/unauthorized": "This image could not be uploaded.",
};

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export interface MessageDeliveryFailure {
  retryable: boolean;
  message: string;
  technicalDetails: string;
}

export function describeMessageDeliveryFailure(
  error: unknown,
  online: boolean
): MessageDeliveryFailure {
  const code = getErrorCode(error);
  const technicalDetails =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (!online) {
    return {
      retryable: true,
      message: "Waiting for a connection",
      technicalDetails,
    };
  }

  if (code && RETRYABLE_CODES.has(code)) {
    return {
      retryable: true,
      message: "Delivery was interrupted. Retrying…",
      technicalDetails,
    };
  }

  return {
    retryable: false,
    message: (code && USER_MESSAGES[code]) || "Message could not be sent.",
    technicalDetails,
  };
}
