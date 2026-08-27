/**
 * R2 Cloud Functions
 *
 * Firebase Cloud Functions (v2, onCall) that generate presigned URLs
 * for client-side uploads to Cloudflare R2. All functions require
 * Firebase Auth. The client never touches R2 credentials.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  getR2Client,
  getPresignedPutUrl,
  createMultipartUpload,
  getMultipartPartUrl,
  completeMultipartUpload as completeMultipartUploadHelper,
  abortMultipartUpload as abortMultipartUploadHelper,
  listMultipartParts,
  deleteObject as deleteObjectHelper,
  deleteByPrefix as deleteByPrefixHelper,
  PRESIGN_EXPIRES_SINGLE,
  PRESIGN_EXPIRES_MULTIPART,
  MAX_VIDEO_FILE_SIZE,
  MAX_THUMBNAIL_FILE_SIZE,
} from "./r2-client";

// Secrets

const r2AccountId = defineSecret("R2_ACCOUNT_ID");
const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");
const r2BucketName = defineSecret("R2_BUCKET_NAME");
const r2PublicUrl = defineSecret("R2_PUBLIC_URL");

const ALL_SECRETS = [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2PublicUrl];

// Trim secrets to guard against trailing whitespace/newlines from copy-paste.
// Firebase Secret Manager preserves exact bytes, so secrets set from editors
// that add trailing newlines will silently corrupt S3 presigned URL signatures.
const secret = {
  accountId: (): string => r2AccountId.value().trim(),
  accessKeyId: (): string => r2AccessKeyId.value().trim(),
  secretAccessKey: (): string => r2SecretAccessKey.value().trim(),
  bucketName: (): string => r2BucketName.value().trim(),
  publicUrl: (): string => r2PublicUrl.value().trim(),
};

// Allowed MIME types

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

const ALLOWED_TYPES = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_IMAGE_TYPES];

// Helpers

/** Build the R2 object key from structured inputs. The client never controls the key directly. */
function buildKey(
  userId: string,
  category: string,
  sequenceId: string,
  fileName: string
): string {
  // Sanitize inputs to prevent path traversal
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-\.]/g, "");
  return `users/${safe(userId)}/${safe(category)}/${safe(sequenceId)}/${safe(fileName)}`;
}

/** Validate that the caller owns the path they're trying to access. */
function assertOwnership(callerUid: string, key: string): void {
  const expectedPrefix = `users/${callerUid}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new HttpsError(
      "permission-denied",
      "Cannot access objects outside your own path"
    );
  }
}

/** Validate content type against allowlist. */
function assertContentType(contentType: string): void {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new HttpsError(
      "invalid-argument",
      `Content type "${contentType}" is not allowed. Allowed: ${ALLOWED_TYPES.join(", ")}`
    );
  }
}

/** Validate file size against category-specific limits. */
function assertFileSize(contentLength: number, category: string): void {
  const limit = category === "thumbnails" ? MAX_THUMBNAIL_FILE_SIZE : MAX_VIDEO_FILE_SIZE;
  if (contentLength > limit) {
    throw new HttpsError(
      "invalid-argument",
      `File too large. Maximum ${limit / (1024 * 1024)}MB for ${category}.`
    );
  }
}

/** Require auth and return the caller's UID. */
function requireAuth(request: { auth?: { uid: string } }): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }
  return request.auth.uid;
}

/**
 * Wrap R2 client calls so AWS SDK / network errors propagate as
 * HttpsError("internal", realMessage) instead of Firebase's default
 * opaque "INTERNAL" with no details.
 */
async function wrapR2<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const name = (error as { name?: string })?.name ?? "UnknownError";
    throw new HttpsError(
      "internal",
      `R2 ${operation} failed: [${name}] ${message}`
    );
  }
}

// ============================================================================
// r2PresignUrl
// ============================================================================

export const r2PresignUrl = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { fileName, contentType, contentLength, userId, category, sequenceId } =
      request.data as {
        fileName: string;
        contentType: string;
        contentLength: number;
        userId: string;
        category: string;
        sequenceId: string;
      };

    // Validate inputs
    if (!fileName || !contentType || !contentLength || !userId || !category || !sequenceId) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    // Caller must match the userId in the path
    if (callerUid !== userId) {
      throw new HttpsError("permission-denied", "Cannot upload to another user's path");
    }

    assertContentType(contentType);
    assertFileSize(contentLength, category);

    const key = buildKey(userId, category, sequenceId, fileName);
    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    const presignedUrl = await wrapR2("presign-url", () =>
      getPresignedPutUrl(client, bucket, key, contentType, PRESIGN_EXPIRES_SINGLE)
    );

    const publicUrl = `${secret.publicUrl()}/${key}`;

    return { presignedUrl, publicUrl, key };
  }
);

// ============================================================================
// r2MultipartStart
// ============================================================================

export const r2MultipartStart = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { fileName, contentType, userId, category, sequenceId } =
      request.data as {
        fileName: string;
        contentType: string;
        userId: string;
        category: string;
        sequenceId: string;
      };

    if (!fileName || !contentType || !userId || !category || !sequenceId) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    if (callerUid !== userId) {
      throw new HttpsError("permission-denied", "Cannot upload to another user's path");
    }

    assertContentType(contentType);

    const key = buildKey(userId, category, sequenceId, fileName);
    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    const uploadId = await wrapR2("multipart-start", () =>
      createMultipartUpload(client, bucket, key, contentType)
    );

    return { uploadId, key };
  }
);

// ============================================================================
// r2MultipartPartUrl
// ============================================================================

export const r2MultipartPartUrl = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { key, uploadId, partNumber } = request.data as {
      key: string;
      uploadId: string;
      partNumber: number;
    };

    if (!key || !uploadId || !partNumber) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    assertOwnership(callerUid, key);

    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    const presignedUrl = await wrapR2("multipart-part-url", () =>
      getMultipartPartUrl(client, bucket, key, uploadId, partNumber, PRESIGN_EXPIRES_MULTIPART)
    );

    return { presignedUrl };
  }
);

// ============================================================================
// r2MultipartComplete
// ============================================================================

export const r2MultipartComplete = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { key, uploadId, parts } = request.data as {
      key: string;
      uploadId: string;
      parts: Array<{ ETag: string; PartNumber: number }>;
    };

    if (!key || !uploadId || !parts || !Array.isArray(parts)) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    assertOwnership(callerUid, key);

    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    await wrapR2("multipart-complete", () =>
      completeMultipartUploadHelper(client, bucket, key, uploadId, parts)
    );

    const publicUrl = `${secret.publicUrl()}/${key}`;

    return { publicUrl };
  }
);

// ============================================================================
// r2MultipartAbort
// ============================================================================

export const r2MultipartAbort = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { key, uploadId } = request.data as {
      key: string;
      uploadId: string;
    };

    if (!key || !uploadId) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    assertOwnership(callerUid, key);

    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    await wrapR2("multipart-abort", () =>
      abortMultipartUploadHelper(client, bucket, key, uploadId)
    );

    return { success: true };
  }
);

// ============================================================================
// r2MultipartListParts
// ============================================================================

export const r2MultipartListParts = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { key, uploadId } = request.data as {
      key: string;
      uploadId: string;
    };

    if (!key || !uploadId) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    assertOwnership(callerUid, key);

    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    return wrapR2("multipart-list-parts", () =>
      listMultipartParts(client, bucket, key, uploadId)
    );
  }
);

// ============================================================================
// r2DeleteObject
// ============================================================================

export const r2DeleteObject = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { key } = request.data as { key: string };

    if (!key) {
      throw new HttpsError("invalid-argument", "key is required");
    }

    assertOwnership(callerUid, key);

    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    await wrapR2("delete-object", () =>
      deleteObjectHelper(client, bucket, key)
    );

    return { success: true };
  }
);

// ============================================================================
// r2DeleteByPrefix
// ============================================================================

export const r2DeleteByPrefix = onCall(
  { secrets: ALL_SECRETS },
  async (request) => {
    const callerUid = requireAuth(request);

    const { prefix } = request.data as { prefix: string };

    if (!prefix || typeof prefix !== "string") {
      throw new HttpsError("invalid-argument", "prefix is required");
    }

    // Auth check: prefix must start with "users/{callerUid}/"
    // This prevents users from deleting other users' assets.
    const expectedPrefix = `users/${callerUid}/`;
    if (!prefix.startsWith(expectedPrefix)) {
      throw new HttpsError(
        "permission-denied",
        "Cannot delete objects outside your own path"
      );
    }

    const client = getR2Client(
      secret.accountId(),
      secret.accessKeyId(),
      secret.secretAccessKey()
    );
    const bucket = secret.bucketName();

    const deletedCount = await wrapR2("delete-by-prefix", () =>
      deleteByPrefixHelper(client, bucket, prefix)
    );

    return { deletedCount };
  }
);
