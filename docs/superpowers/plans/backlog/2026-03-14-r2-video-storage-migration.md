# R2 Video Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase Storage with Cloudflare R2 for video, animation, and thumbnail storage to eliminate egress costs.

**Architecture:** Client-side R2VideoUploader calls Firebase Cloud Functions to get presigned URLs, then uploads directly to R2. Cloud Functions validate auth and generate presigned URLs using @aws-sdk/client-s3. No data touches the server.

**Tech Stack:** Cloudflare R2, @aws-sdk/client-s3, Firebase Cloud Functions v2 (onCall), Firebase Auth

---

## Task 1: Cloudflare R2 Setup (Manual)

**This task is done by hand in the Cloudflare dashboard and Firebase CLI. No code changes.**

- [ ] **1.1** Log into Cloudflare dashboard, navigate to R2
- [ ] **1.2** Create bucket named `tka-videos` with automatic location
- [ ] **1.3** Enable public access on the bucket (Settings > Public Access > Enable)
- [ ] **1.4** Configure CORS rules on the bucket. Go to Settings > CORS Policy and add:

```json
[
  {
    "AllowedOrigins": [
      "https://tkaflowarts.com",
      "https://www.tkaflowarts.com",
      "http://localhost:5173",
      "http://localhost:5174"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- [ ] **1.5** Set lifecycle rule: `AbortIncompleteMultipartUpload` after 1 day. Go to Settings > Object lifecycle rules and add:

```json
{
  "Rules": [
    {
      "ID": "abort-incomplete-multipart",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 1
      }
    }
  ]
}
```

- [ ] **1.6** Create a scoped API token in Cloudflare:
  - Permissions: **R2 Object Read & Write**
  - Scope: **Single bucket** (`tka-videos` only)
  - No other Cloudflare permissions
  - Copy the Access Key ID and Secret Access Key

- [ ] **1.7** Store credentials in Firebase Secret Manager. Run each command and paste the value when prompted:

```bash
firebase functions:secrets:set R2_ACCOUNT_ID
firebase functions:secrets:set R2_ACCESS_KEY_ID
firebase functions:secrets:set R2_SECRET_ACCESS_KEY
firebase functions:secrets:set R2_BUCKET_NAME
firebase functions:secrets:set R2_PUBLIC_URL
```

`R2_ACCOUNT_ID` is the Cloudflare account ID (visible in dashboard URL). `R2_PUBLIC_URL` is the public bucket URL, e.g. `https://pub-{hash}.r2.dev` (shown on the bucket's Settings > Public Access page after enabling).

- [ ] **1.8** Verify secrets are stored:

```bash
firebase functions:secrets:access R2_BUCKET_NAME
```

Expected output: `tka-videos`

---

## Task 2: R2 Client Module (Server-Side)

**Create:** `firebase-functions/src/r2/r2-client.ts`
**Modify:** `firebase-functions/package.json`

- [ ] **2.1** Add AWS SDK dependencies to `firebase-functions/package.json`:

```bash
cd firebase-functions && npm install @aws-sdk/client-s3@^3.700.0 @aws-sdk/s3-request-presigner@^3.700.0
```

Expected output: packages added to `dependencies` in `firebase-functions/package.json`:

```json
"@aws-sdk/client-s3": "^3.700.0",
"@aws-sdk/s3-request-presigner": "^3.700.0"
```

- [ ] **2.2** Create `firebase-functions/src/r2/r2-client.ts`:

```typescript
/**
 * R2 Client Module
 *
 * S3-compatible client for Cloudflare R2. Provides helpers for
 * generating presigned URLs and managing multipart uploads.
 * All R2 credentials come from Firebase Secret Manager via defineSecret().
 *
 * This module is used exclusively by Cloud Functions. The browser never
 * touches R2 credentials directly.
 */

import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ============================================================================
// Constants
// ============================================================================

/** Single-file presigned URL expiry: 15 minutes */
export const PRESIGN_EXPIRES_SINGLE = 900;

/** Multipart part presigned URL expiry: 60 minutes */
export const PRESIGN_EXPIRES_MULTIPART = 3600;

/** Maximum video file size: 500 MB */
export const MAX_VIDEO_FILE_SIZE = 500 * 1024 * 1024;

/** Maximum thumbnail file size: 10 MB */
export const MAX_THUMBNAIL_FILE_SIZE = 10 * 1024 * 1024;

// ============================================================================
// Client factory
// ============================================================================

let cachedClient: S3Client | null = null;

/**
 * Get or create an S3-compatible client pointing at the R2 endpoint.
 * Credentials are read from the secret values passed in.
 */
export function getR2Client(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string
): S3Client {
  if (cachedClient) return cachedClient;

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}

// ============================================================================
// Presigned URL helpers
// ============================================================================

/**
 * Generate a presigned PUT URL for a single file upload.
 */
export async function getPresignedPutUrl(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number = PRESIGN_EXPIRES_SINGLE
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

// ============================================================================
// Multipart upload helpers
// ============================================================================

/**
 * Start a multipart upload. Returns the uploadId R2 assigns.
 */
export async function createMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!result.UploadId) {
    throw new Error("R2 did not return an UploadId");
  }
  return result.UploadId;
}

/**
 * Generate a presigned URL for uploading one part of a multipart upload.
 */
export async function getMultipartPartUrl(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn: number = PRESIGN_EXPIRES_MULTIPART
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Complete a multipart upload by submitting the part ETags.
 */
export async function completeMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<void> {
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          ETag: p.ETag,
          PartNumber: p.PartNumber,
        })),
      },
    })
  );
}

/**
 * Abort a multipart upload, freeing any uploaded parts.
 */
export async function abortMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    })
  );
}

/**
 * List parts that have been uploaded for a multipart upload.
 * Used for resume: compare against saved state to find missing parts.
 */
export async function listMultipartParts(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<{
  parts: Array<{ ETag: string; PartNumber: number; Size: number }>;
  expired: boolean;
}> {
  try {
    const result = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      })
    );

    const parts = (result.Parts || []).map((p) => ({
      ETag: p.ETag || "",
      PartNumber: p.PartNumber || 0,
      Size: p.Size || 0,
    }));

    return { parts, expired: false };
  } catch (error: unknown) {
    // If the upload no longer exists (expired or aborted), return expired flag
    const errorName = (error as { name?: string })?.name;
    if (errorName === "NoSuchUpload") {
      return { parts: [], expired: true };
    }
    throw error;
  }
}

// ============================================================================
// Delete helpers
// ============================================================================

/**
 * Delete a single object from R2.
 */
export async function deleteObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Delete all objects matching a prefix. Handles pagination for large sets.
 * Returns the total number of objects deleted.
 */
export async function deleteByPrefix(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<number> {
  let continuationToken: string | undefined;
  let totalDeleted = 0;

  do {
    const listResult = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    );

    const objects = listResult.Contents;
    if (!objects || objects.length === 0) break;

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objects.map((obj) => ({ Key: obj.Key })),
          Quiet: true,
        },
      })
    );

    totalDeleted += objects.length;
    continuationToken = listResult.IsTruncated
      ? listResult.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return totalDeleted;
}
```

- [ ] **2.3** Verify it compiles:

```bash
cd firebase-functions && npx tsc --noEmit src/r2/r2-client.ts
```

Expected: no errors.

- [ ] **2.4** Commit:

```
git add firebase-functions/package.json firebase-functions/package-lock.json firebase-functions/src/r2/r2-client.ts
git commit -m "feat(r2): add R2 client module with S3-compatible helpers"
```

---

## Task 3: Cloud Functions - Presign & Single Upload

**Create:** `firebase-functions/src/r2/index.ts`
**Modify:** `firebase-functions/src/index.ts`

- [ ] **3.1** Create `firebase-functions/src/r2/index.ts` with the presign function:

```typescript
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

// ============================================================================
// Secrets
// ============================================================================

const r2AccountId = defineSecret("R2_ACCOUNT_ID");
const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");
const r2BucketName = defineSecret("R2_BUCKET_NAME");
const r2PublicUrl = defineSecret("R2_PUBLIC_URL");

const ALL_SECRETS = [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2PublicUrl];

// ============================================================================
// Allowed MIME types
// ============================================================================

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

// ============================================================================
// Helpers
// ============================================================================

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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    const presignedUrl = await getPresignedPutUrl(
      client,
      bucket,
      key,
      contentType,
      PRESIGN_EXPIRES_SINGLE
    );

    const publicUrl = `${r2PublicUrl.value()}/${key}`;

    return { presignedUrl, publicUrl, key };
  }
);
```

- [ ] **3.2** Export `r2PresignUrl` from `firebase-functions/src/index.ts`. Add this line after the existing exports:

```typescript
// Export R2 presign function (multipart and delete exports added in Tasks 4 and 5)
export { r2PresignUrl } from "./r2/index";
```

- [ ] **3.3** Verify build:

```bash
cd firebase-functions && npm run build
```

Expected: compiles without errors.

- [ ] **3.4** Commit:

```
git add firebase-functions/src/r2/index.ts firebase-functions/src/index.ts
git commit -m "feat(r2): add r2PresignUrl Cloud Function with auth and validation"
```

---

## Task 4: Cloud Functions - Multipart Operations

**Modify:** `firebase-functions/src/r2/index.ts`

- [ ] **4.1** Add the following functions to the bottom of `firebase-functions/src/r2/index.ts`:

```typescript
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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    const uploadId = await createMultipartUpload(client, bucket, key, contentType);

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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    const presignedUrl = await getMultipartPartUrl(
      client,
      bucket,
      key,
      uploadId,
      partNumber,
      PRESIGN_EXPIRES_MULTIPART
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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    await completeMultipartUploadHelper(client, bucket, key, uploadId, parts);

    const publicUrl = `${r2PublicUrl.value()}/${key}`;

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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    await abortMultipartUploadHelper(client, bucket, key, uploadId);

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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    return listMultipartParts(client, bucket, key, uploadId);
  }
);
```

- [ ] **4.2** Verify build:

```bash
cd firebase-functions && npm run build
```

Expected: compiles without errors.

- [ ] **4.3** Update the export in `firebase-functions/src/index.ts` to include multipart functions:

```typescript
// Export R2 storage functions (presigned URLs and multipart; delete exports added in Task 5)
export {
  r2PresignUrl,
  r2MultipartStart,
  r2MultipartPartUrl,
  r2MultipartComplete,
  r2MultipartAbort,
  r2MultipartListParts,
} from "./r2/index";
```

- [ ] **4.4** Commit:

```
git add firebase-functions/src/r2/index.ts firebase-functions/src/index.ts
git commit -m "feat(r2): add multipart upload Cloud Functions (start, part, complete, abort, list)"
```

---

## Task 5: Cloud Functions - Delete Operations

**Modify:** `firebase-functions/src/r2/index.ts`

- [ ] **5.1** Add the following functions to the bottom of `firebase-functions/src/r2/index.ts`:

```typescript
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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    await deleteObjectHelper(client, bucket, key);

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
      r2AccountId.value(),
      r2AccessKeyId.value(),
      r2SecretAccessKey.value()
    );
    const bucket = r2BucketName.value();

    const deletedCount = await deleteByPrefixHelper(client, bucket, prefix);

    return { deletedCount };
  }
);
```

- [ ] **5.2** Verify build:

```bash
cd firebase-functions && npm run build
```

Expected: compiles without errors.

- [ ] **5.3** Update the export in `firebase-functions/src/index.ts` to include delete functions:

```typescript
// Export R2 storage functions (presigned URLs, multipart, delete)
export {
  r2PresignUrl,
  r2MultipartStart,
  r2MultipartPartUrl,
  r2MultipartComplete,
  r2MultipartAbort,
  r2MultipartListParts,
  r2DeleteObject,
  r2DeleteByPrefix,
} from "./r2/index";
```

- [ ] **5.4** Commit:

```
git add firebase-functions/src/r2/index.ts firebase-functions/src/index.ts
git commit -m "feat(r2): add delete Cloud Functions (single object and prefix-based batch)"
```

---

## Task 6: Deploy Cloud Functions

- [ ] **6.1** Install dependencies:

```bash
cd firebase-functions && npm install
```

- [ ] **6.2** Build:

```bash
cd firebase-functions && npm run build
```

Expected: no errors.

- [ ] **6.3** Deploy only R2 functions:

```bash
firebase deploy --only functions:r2PresignUrl,functions:r2MultipartStart,functions:r2MultipartPartUrl,functions:r2MultipartComplete,functions:r2MultipartAbort,functions:r2MultipartListParts,functions:r2DeleteObject,functions:r2DeleteByPrefix
```

Expected: all 8 functions deploy successfully.

- [ ] **6.4** Verify `r2PresignUrl` responds to an unauthenticated call with an error (proves it's deployed and enforcing auth):

```bash
curl -X POST https://us-central1-the-kinetic-alphabet.cloudfunctions.net/r2PresignUrl \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
```

Expected: response contains `"code":"UNAUTHENTICATED"` or similar error.

---

## Task 7: Client-Side Interfaces

**Create:** `src/lib/shared/share/services/contracts/IVideoUploader.ts`
**Create:** `src/lib/shared/share/services/contracts/IR2Presigner.ts`

- [ ] **7.1** Create `src/lib/shared/share/services/contracts/IVideoUploader.ts`:

```typescript
/**
 * Video Upload Service Interface
 *
 * Defines the contract for uploading user videos, animations, and thumbnails
 * to cloud storage (R2). Replaces IFirebaseVideoUploader.
 *
 * Key differences from the old interface:
 * - Returns `key` (R2 object key) instead of `storagePath` (Firebase path)
 * - Progress callback is inside an `options` object alongside AbortSignal
 * - `getPublicUrl` is synchronous (just concatenates base URL + key)
 */

export interface VideoUploadResult {
  /** Public CDN URL for the uploaded file */
  url: string;
  /** R2 object key (for deletion) */
  key: string;
}

export interface UploadOptions {
  /** Progress callback, 0-100 */
  onProgress?: (percent: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface MultipartUploadState {
  uploadId: string;
  key: string;
  completedParts: Array<{ ETag: string; PartNumber: number }>;
  totalParts: number;
  partSize: number;
}

export interface IVideoUploader {
  uploadPerformanceVideo(
    sequenceId: string,
    videoFile: File | Blob,
    options?: UploadOptions
  ): Promise<VideoUploadResult>;

  uploadAnimatedSequence(
    sequenceId: string,
    animationBlob: Blob,
    format: "webp" | "gif",
    options?: UploadOptions
  ): Promise<VideoUploadResult>;

  deleteSequenceAssets(sequenceId: string): Promise<void>;

  getPublicUrl(key: string): string;

  uploadVideoThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    videoTimestamp: number,
    options?: UploadOptions
  ): Promise<VideoUploadResult>;

  uploadSequenceThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    format?: "png" | "jpeg" | "webp",
    options?: UploadOptions
  ): Promise<VideoUploadResult>;
}
```

- [ ] **7.2** Create `src/lib/shared/share/services/contracts/IR2Presigner.ts`:

```typescript
/**
 * R2 Presigner Interface
 *
 * Wraps Cloud Function calls for R2 presigned URL generation,
 * multipart upload orchestration, and object deletion.
 * Named "Presigner" because that's what it does: signs URLs.
 */

export interface IR2Presigner {
  /** Get a presigned PUT URL for a single file upload */
  getUploadUrl(params: {
    fileName: string;
    contentType: string;
    contentLength: number;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ presignedUrl: string; publicUrl: string; key: string }>;

  /** Start a multipart upload */
  startMultipart(params: {
    fileName: string;
    contentType: string;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ uploadId: string; key: string }>;

  /** Get presigned URL for one part of a multipart upload */
  getPartUrl(params: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<{ presignedUrl: string }>;

  /** Complete a multipart upload */
  completeMultipart(params: {
    key: string;
    uploadId: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }): Promise<{ publicUrl: string }>;

  /** Abort a multipart upload */
  abortMultipart(params: {
    key: string;
    uploadId: string;
  }): Promise<void>;

  /** List parts already uploaded (for resume) */
  listParts(params: {
    key: string;
    uploadId: string;
  }): Promise<{
    parts: Array<{ ETag: string; PartNumber: number; Size: number }>;
    expired: boolean;
  }>;

  /** Delete a single object from R2 */
  deleteObject(key: string): Promise<void>;

  /** Delete all objects matching a prefix */
  deleteByPrefix(prefix: string): Promise<{ deletedCount: number }>;
}
```

- [ ] **7.3** Verify types compile:

```bash
npm run check
```

Expected: no new errors from these files.

- [ ] **7.4** Commit:

```
git add src/lib/shared/share/services/contracts/IVideoUploader.ts src/lib/shared/share/services/contracts/IR2Presigner.ts
git commit -m "feat(r2): add IVideoUploader and IR2Presigner interfaces"
```

---

## Task 8: R2Presigner Implementation

**Create:** `src/lib/shared/share/services/implementations/R2Presigner.ts`

- [ ] **8.1** Create `src/lib/shared/share/services/implementations/R2Presigner.ts`:

```typescript
/**
 * R2Presigner
 *
 * Wraps Firebase Cloud Function calls for R2 presigned URL generation
 * and multipart upload orchestration. Uses httpsCallable from the
 * Firebase SDK, which handles auth token propagation automatically.
 *
 * Named "Presigner" per service naming convention: services are named
 * by what they do, not with a generic "Service" suffix.
 */

import type { IR2Presigner } from "../contracts/IR2Presigner";
import { getFunctionsInstance } from "$lib/shared/auth/firebase";

export class R2Presigner implements IR2Presigner {
  private async call<T>(functionName: string, data: unknown): Promise<T> {
    const { httpsCallable } = await import("firebase/functions");
    const functions = await getFunctionsInstance();
    const callable = httpsCallable<unknown, T>(functions, functionName);
    const result = await callable(data);
    return result.data;
  }

  async getUploadUrl(params: {
    fileName: string;
    contentType: string;
    contentLength: number;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
    return this.call("r2PresignUrl", params);
  }

  async startMultipart(params: {
    fileName: string;
    contentType: string;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ uploadId: string; key: string }> {
    return this.call("r2MultipartStart", params);
  }

  async getPartUrl(params: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<{ presignedUrl: string }> {
    return this.call("r2MultipartPartUrl", params);
  }

  async completeMultipart(params: {
    key: string;
    uploadId: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }): Promise<{ publicUrl: string }> {
    return this.call("r2MultipartComplete", params);
  }

  async abortMultipart(params: {
    key: string;
    uploadId: string;
  }): Promise<void> {
    await this.call("r2MultipartAbort", params);
  }

  async listParts(params: {
    key: string;
    uploadId: string;
  }): Promise<{
    parts: Array<{ ETag: string; PartNumber: number; Size: number }>;
    expired: boolean;
  }> {
    return this.call("r2MultipartListParts", params);
  }

  async deleteObject(key: string): Promise<void> {
    await this.call("r2DeleteObject", { key });
  }

  async deleteByPrefix(prefix: string): Promise<{ deletedCount: number }> {
    return this.call("r2DeleteByPrefix", { prefix });
  }
}
```

- [ ] **8.2** Verify the Firebase functions import works. Check what `getFunctionsInstance` looks like:

```bash
grep -n "getFunctionsInstance" src/lib/shared/auth/firebase.ts
```

If `getFunctionsInstance` doesn't exist, you need to find the correct function name. The codebase may use a different export. Check and update the import accordingly.

- [ ] **8.3** Commit:

```
git add src/lib/shared/share/services/implementations/R2Presigner.ts
git commit -m "feat(r2): add R2Presigner Cloud Function wrapper"
```

---

## Task 9: R2VideoUploader Implementation

**Create:** `src/lib/shared/share/services/implementations/R2VideoUploader.ts`

- [ ] **9.1** Create `src/lib/shared/share/services/implementations/R2VideoUploader.ts`:

```typescript
/**
 * R2VideoUploader
 *
 * Uploads user videos, animations, and thumbnails to Cloudflare R2 via
 * presigned URLs. Handles single-file uploads (<100MB) and multipart
 * uploads (>=100MB) with resume capability.
 *
 * The browser never touches R2 credentials. It calls Cloud Functions
 * to get presigned URLs, then PUTs directly to R2.
 */

import type {
  IVideoUploader,
  VideoUploadResult,
  UploadOptions,
  MultipartUploadState,
} from "../contracts/IVideoUploader";
import type { IR2Presigner } from "../contracts/IR2Presigner";
import { getAuthSync } from "$lib/shared/auth/firebase";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

// ============================================================================
// Constants
// ============================================================================

/** Files >= 100MB use multipart upload */
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

/** Each multipart chunk is 10MB */
const PART_SIZE = 10 * 1024 * 1024;

/** Upload up to 3 parts at a time */
const MAX_CONCURRENT_PARTS = 3;

/** localStorage key for multipart resume state */
const STORAGE_KEY = "tka-multipart-uploads";

/** Stale multipart entries older than 24 hours are purged */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// File fingerprinting (for duplicate detection and resume matching)
// ============================================================================

async function computeFileFingerprint(file: File | Blob): Promise<string> {
  const SAMPLE_SIZE = 1024 * 1024; // 1MB
  const head = file.slice(0, SAMPLE_SIZE);
  const tail = file.slice(Math.max(0, file.size - SAMPLE_SIZE));
  const combined = new Blob([head, tail]);
  const buffer = await combined.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return (
    hashArray.map((b) => b.toString(16).padStart(2, "0")).join("") +
    `-${file.size}`
  );
}

// ============================================================================
// localStorage helpers for multipart resume
// ============================================================================

function loadMultipartState(): Record<string, MultipartUploadState & { startedAt: number; fileName: string; fileSize: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMultipartState(
  fingerprint: string,
  state: MultipartUploadState & { startedAt: number; fileName: string; fileSize: number }
): void {
  const all = loadMultipartState();
  all[fingerprint] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function removeMultipartState(fingerprint: string): void {
  const all = loadMultipartState();
  delete all[fingerprint];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function purgeStaleEntries(): void {
  const all = loadMultipartState();
  const now = Date.now();
  let changed = false;
  for (const [key, entry] of Object.entries(all)) {
    if (now - entry.startedAt > STALE_THRESHOLD_MS) {
      delete all[key];
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

// ============================================================================
// XHR upload helper (supports progress and abort)
// ============================================================================

function xhrPut(
  url: string,
  body: Blob,
  contentType: string,
  options?: {
    onProgress?: (loaded: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options?.signal) {
      if (options.signal.aborted) {
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
      });
    }

    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        options.onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag") || "";
        resolve({ etag });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    xhr.send(body);
  });
}

// ============================================================================
// R2VideoUploader
// ============================================================================

export class R2VideoUploader implements IVideoUploader {
  private readonly presigner: IR2Presigner;

  constructor(presigner: IR2Presigner) {
    this.presigner = presigner;

    // Purge stale multipart entries on construction
    if (typeof window !== "undefined") {
      purgeStaleEntries();
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private getUserId(): string {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("User must be authenticated to upload");
    }
    return user.uid;
  }

  private handleError(error: unknown, action: string, additionalData?: Record<string, unknown>): never {
    console.error(`R2VideoUploader: Failed to ${action}:`, error);
    const errorHandler = container.items.errorHandler as IErrorHandler;
    errorHandler.showUserError({
      message: `Couldn't ${action.replace(/-/g, " ")}`,
      technicalDetails: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
      severity: "error",
      context: {
        module: "share",
        action,
        additionalData,
      },
    });
    throw error;
  }

  // --------------------------------------------------------------------------
  // Single file upload (<100MB)
  // --------------------------------------------------------------------------

  private async uploadSingle(
    fileName: string,
    contentType: string,
    file: File | Blob,
    userId: string,
    category: string,
    sequenceId: string,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    const { presignedUrl, publicUrl, key } = await this.presigner.getUploadUrl({
      fileName,
      contentType,
      contentLength: file.size,
      userId,
      category,
      sequenceId,
    });

    await xhrPut(presignedUrl, file, contentType, {
      onProgress: (loaded, total) => {
        options?.onProgress?.(Math.round((loaded / total) * 100));
      },
      signal: options?.signal,
    });

    return { url: publicUrl, key };
  }

  // --------------------------------------------------------------------------
  // Multipart upload (>=100MB)
  // --------------------------------------------------------------------------

  private async uploadMultipart(
    fileName: string,
    contentType: string,
    file: File | Blob,
    userId: string,
    category: string,
    sequenceId: string,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    const totalParts = Math.ceil(file.size / PART_SIZE);
    const fingerprint = await computeFileFingerprint(file instanceof File ? file : new File([file], "blob"));

    // Check for resumable state
    let savedState = loadMultipartState()[fingerprint];
    let uploadId: string;
    let key: string;
    let completedParts: Array<{ ETag: string; PartNumber: number }> = [];

    if (savedState && !savedState.startedAt) {
      // Stale entry with no timestamp, discard it
      removeMultipartState(fingerprint);
      savedState = null;
    }

    if (savedState) {
      // Resume: verify which parts R2 still has
      const { parts: confirmedParts, expired } = await this.presigner.listParts({
        key: savedState.key,
        uploadId: savedState.uploadId,
      });

      if (expired) {
        // Upload expired, start fresh
        removeMultipartState(fingerprint);
        const startResult = await this.presigner.startMultipart({ fileName, contentType, userId, category, sequenceId });
        uploadId = startResult.uploadId;
        key = startResult.key;
      } else {
        uploadId = savedState.uploadId;
        key = savedState.key;
        completedParts = confirmedParts.map((p) => ({
          ETag: p.ETag,
          PartNumber: p.PartNumber,
        }));
      }
    } else {
      const startResult = await this.presigner.startMultipart({
        fileName,
        contentType,
        userId,
        category,
        sequenceId,
      });
      uploadId = startResult.uploadId;
      key = startResult.key;
    }

    // Determine which parts still need uploading
    const completedPartNumbers = new Set(completedParts.map((p) => p.PartNumber));
    const missingParts: number[] = [];
    for (let i = 1; i <= totalParts; i++) {
      if (!completedPartNumbers.has(i)) {
        missingParts.push(i);
      }
    }

    // Track per-part progress for overall progress calculation
    const partProgress = new Map<number, number>();
    const totalBytes = file.size;
    // Already-completed bytes
    let completedBytes = 0;
    for (const pn of completedPartNumbers) {
      const start = (pn - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      completedBytes += end - start;
    }

    const updateOverallProgress = () => {
      let current = completedBytes;
      for (const bytes of partProgress.values()) {
        current += bytes;
      }
      options?.onProgress?.(Math.round((current / totalBytes) * 100));
    };

    // Upload missing parts with concurrency limit
    const uploadPart = async (partNumber: number) => {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const chunk = file.slice(start, end);

      const { presignedUrl } = await this.presigner.getPartUrl({
        key,
        uploadId,
        partNumber,
      });

      const { etag } = await xhrPut(presignedUrl, chunk, contentType, {
        onProgress: (loaded) => {
          partProgress.set(partNumber, loaded);
          updateOverallProgress();
        },
        signal: options?.signal,
      });

      partProgress.delete(partNumber);
      completedBytes += end - start;

      const part = { ETag: etag, PartNumber: partNumber };
      completedParts.push(part);

      // Persist state after each part for resume
      saveMultipartState(fingerprint, {
        uploadId,
        key,
        completedParts,
        totalParts,
        partSize: PART_SIZE,
        startedAt: savedState?.startedAt ?? Date.now(),
        fileName: file instanceof File ? file.name : "blob",
        fileSize: file.size,
      });
    };

    // Process parts with concurrency limit
    const queue = [...missingParts];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(MAX_CONCURRENT_PARTS, queue.length); i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const partNumber = queue.shift()!;
            await uploadPart(partNumber);
          }
        })()
      );
    }

    await Promise.all(workers);

    // Sort parts by number before completing
    completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    // Complete the multipart upload
    const { publicUrl } = await this.presigner.completeMultipart({
      key,
      uploadId,
      parts: completedParts,
    });

    // Clean up localStorage
    removeMultipartState(fingerprint);

    return { url: publicUrl, key };
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  async uploadPerformanceVideo(
    sequenceId: string,
    videoFile: File | Blob,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const timestamp = Date.now();
      const extension =
        videoFile instanceof File
          ? videoFile.name.split(".").pop() || "mp4"
          : "mp4";
      const fileName = `${timestamp}.${extension}`;
      const contentType = videoFile.type || "video/mp4";

      if (videoFile.size >= MULTIPART_THRESHOLD) {
        return await this.uploadMultipart(
          fileName, contentType, videoFile, userId, "recordings", sequenceId, options
        );
      }
      return await this.uploadSingle(
        fileName, contentType, videoFile, userId, "recordings", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-video", { sequenceId });
    }
  }

  async uploadAnimatedSequence(
    sequenceId: string,
    animationBlob: Blob,
    format: "webp" | "gif",
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const fileName = `sequence.${format}`;
      const contentType = format === "webp" ? "image/webp" : "image/gif";

      return await this.uploadSingle(
        fileName, contentType, animationBlob, userId, "animations", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-animation", { sequenceId, format });
    }
  }

  async deleteSequenceAssets(sequenceId: string): Promise<void> {
    try {
      const userId = this.getUserId();
      const prefixes = [
        `users/${userId}/recordings/${sequenceId}/`,
        `users/${userId}/animations/${sequenceId}/`,
        `users/${userId}/thumbnails/${sequenceId}/`,
      ];
      await Promise.all(
        prefixes.map((prefix) => this.presigner.deleteByPrefix(prefix))
      );
    } catch (error) {
      return this.handleError(error, "delete-assets", { sequenceId });
    }
  }

  getPublicUrl(key: string): string {
    // Constructs the full public URL from the R2 public base URL and the
    // object key. VITE_R2_PUBLIC_URL must be set in .env (e.g.,
    // VITE_R2_PUBLIC_URL=https://pub-xxx.r2.dev or a custom domain).
    // In practice, callers usually use the `url` from VideoUploadResult,
    // but this method is available for constructing URLs from stored keys.
    const baseUrl = import.meta.env.VITE_R2_PUBLIC_URL || "";
    return `${baseUrl}/${key}`;
  }

  async uploadVideoThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    videoTimestamp: number,
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const fileName = `${videoTimestamp}_thumb.jpg`;
      const contentType = "image/jpeg";

      return await this.uploadSingle(
        fileName, contentType, thumbnailBlob, userId, "thumbnails", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-thumbnail", { sequenceId });
    }
  }

  async uploadSequenceThumbnail(
    sequenceId: string,
    thumbnailBlob: Blob,
    format: "png" | "jpeg" | "webp" = "png",
    options?: UploadOptions
  ): Promise<VideoUploadResult> {
    try {
      const userId = this.getUserId();
      const fileName = `thumbnail.${format}`;
      const contentTypeMap: Record<string, string> = {
        png: "image/png",
        jpeg: "image/jpeg",
        webp: "image/webp",
      };
      const contentType = contentTypeMap[format];

      return await this.uploadSingle(
        fileName, contentType, thumbnailBlob, userId, "thumbnails", sequenceId, options
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      return this.handleError(error, "upload-thumbnail", { sequenceId, format });
    }
  }
}
```

- [ ] **9.2** Verify it compiles:

```bash
npm run check
```

Expected: no new errors.

- [ ] **9.3** Commit:

```
git add src/lib/shared/share/services/implementations/R2VideoUploader.ts
git commit -m "feat(r2): add R2VideoUploader with single, multipart, and resume support"
```

---

## Task 10: DI Container Wiring

**Modify:** `src/lib/shared/di/containers/share-container.ts`
**Modify:** `src/lib/shared/di/containers/library-container.ts`
**Modify:** `src/lib/shared/di/container-types.ts`
**Modify:** `src/lib/shared/di/index.ts`

- [ ] **10.1** Update `src/lib/shared/di/containers/share-container.ts`:

Replace the `FirebaseVideoUploader` import and registration with `R2Presigner` and `R2VideoUploader`:

```typescript
// OLD (remove these):
import { FirebaseVideoUploader } from "$lib/shared/share/services/implementations/FirebaseVideoUploader";
// ...
firebaseVideoUploader: () => new FirebaseVideoUploader(),

// NEW (add these):
import { R2Presigner } from "$lib/shared/share/services/implementations/R2Presigner";
import { R2VideoUploader } from "$lib/shared/share/services/implementations/R2VideoUploader";
```

In the `baseContainer`, replace `firebaseVideoUploader`:

```typescript
const baseContainer = createContainer()
  .add({
    instagramLinker: () => new InstagramLinker(),
    r2Presigner: () => new R2Presigner(),
    recordingPersister: () => new RecordingPersister(),
    collaborativeVideoManager: () => new CollaborativeVideoManager(),
    cloudThumbnailCache: () => new CloudThumbnailCache(),
  });
```

Then add a layer that depends on `r2Presigner`:

```typescript
// Layer 1.5: Services that depend on r2Presigner
const withUploader = baseContainer.add((ctx) => ({
  videoUploader: () => new R2VideoUploader(ctx.r2Presigner),
}));

// Layer 2: Services that depend on external dependencies
const withSharer = withUploader.add({
  sharer: () => new Sharer(sequenceRenderer),
  sequenceImageSharer: () => new SequenceImageSharer(sequenceRenderer),
});
```

Update the full container to chain from `withSharer`:

```typescript
const fullContainer = withSharer.add((ctx) => ({
  exportPanelExportOrchestrator: () => new ExportPanelExportOrchestrator(ctx.sharer),
  mediaBundler: () => new MediaBundler(ctx.sharer),
}));
```

The complete file after changes should be:

```typescript
/**
 * Share Container - ITI Dependency Injection
 *
 * Contains all share-related services:
 * - Sharer, ExportPanelExportOrchestrator
 * - InstagramLinker, MediaBundler
 * - R2Presigner, R2VideoUploader, RecordingPersister
 * - CollaborativeVideoManager, CloudThumbnailCache
 */

import { createContainer } from "iti";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import { Sharer } from "$lib/shared/share/services/implementations/Sharer";
import { ExportPanelExportOrchestrator } from "$lib/shared/export-panel/services/implementations/ExportPanelExportOrchestrator";
import { InstagramLinker } from "$lib/shared/share/services/implementations/InstagramLinker";
import { MediaBundler } from "$lib/shared/share/services/implementations/MediaBundler";
import { R2Presigner } from "$lib/shared/share/services/implementations/R2Presigner";
import { R2VideoUploader } from "$lib/shared/share/services/implementations/R2VideoUploader";
import { RecordingPersister } from "$lib/shared/video-record/services/implementations/RecordingPersister";
import { CollaborativeVideoManager } from "$lib/shared/video-collaboration/services/implementations/CollaborativeVideoManager";
import { CloudThumbnailCache } from "$lib/features/browse/sequences/display/services/implementations/CloudThumbnailCache";
import { SequenceImageSharer } from "$lib/shared/share/services/implementations/SequenceImageSharer";

/**
 * Create the share container with external dependencies
 *
 * @param sequenceRenderer - Required dependency from render module
 */
export function createShareContainer(sequenceRenderer: ISequenceRenderer) {
  // Layer 1: Services with no internal dependencies
  const baseContainer = createContainer()
    .add({
      instagramLinker: () => new InstagramLinker(),
      r2Presigner: () => new R2Presigner(),
      recordingPersister: () => new RecordingPersister(),
      collaborativeVideoManager: () => new CollaborativeVideoManager(),
      cloudThumbnailCache: () => new CloudThumbnailCache(),
    });

  // Layer 1.5: Services that depend on r2Presigner
  const withUploader = baseContainer.add((ctx) => ({
    videoUploader: () => new R2VideoUploader(ctx.r2Presigner),
  }));

  // Layer 2: Services that depend on external dependencies
  const withSharer = withUploader.add({
    sharer: () => new Sharer(sequenceRenderer),
    sequenceImageSharer: () => new SequenceImageSharer(sequenceRenderer),
  });

  // Layer 3: Services that depend on sharer
  const fullContainer = withSharer.add((ctx) => ({
    exportPanelExportOrchestrator: () => new ExportPanelExportOrchestrator(ctx.sharer),
    mediaBundler: () => new MediaBundler(ctx.sharer),
  }));

  return fullContainer;
}

// Type for the share container
export type ShareContainer = ReturnType<typeof createShareContainer>;
```

- [ ] **10.2** Update `src/lib/shared/di/containers/library-container.ts`:

Replace `IFirebaseVideoUploader` with `IVideoUploader`:

```typescript
// OLD:
import type { IFirebaseVideoUploader } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";

// NEW:
import type { IVideoUploader } from "$lib/shared/share/services/contracts/IVideoUploader";
```

Update `LibrarySaveServiceDeps`:

```typescript
// OLD:
interface LibrarySaveServiceDeps {
  sharer?: ISharer | null;
  firebaseVideoUploader?: IFirebaseVideoUploader | null;
  tagManager?: ITagManager | null;
}

// NEW:
interface LibrarySaveServiceDeps {
  sharer?: ISharer | null;
  videoUploader?: IVideoUploader | null;
  tagManager?: ITagManager | null;
}
```

Update the `LibrarySaveService` construction:

```typescript
// OLD:
deps.librarySaveService.firebaseVideoUploader ?? null,

// NEW:
deps.librarySaveService.videoUploader ?? null,
```

- [ ] **10.3** Update `src/lib/shared/di/index.ts`:

In the `libraryContainer` creation (around line 249), update the dep name:

```typescript
// OLD:
librarySaveService: {
  sharer: shareContainer.items.sharer,
  firebaseVideoUploader: shareContainer.items.firebaseVideoUploader,
  tagManager: coreContainer.items.tagManager,
},

// NEW:
librarySaveService: {
  sharer: shareContainer.items.sharer,
  videoUploader: shareContainer.items.videoUploader,
  tagManager: coreContainer.items.tagManager,
},
```

- [ ] **10.4** `container-types.ts` does not need manual changes. It imports `ShareContainer` and `LibraryContainer` types which will automatically reflect the new `videoUploader` and `r2Presigner` keys since those types are derived from `ReturnType<typeof createShareContainer>` and `ReturnType<typeof createLibraryContainer>`.

- [ ] **10.5** Verify build:

```bash
npm run check
```

Expected: may show errors in consumer files (fixed in Task 11). The DI wiring itself should be clean.

- [ ] **10.6** Commit:

```
git add src/lib/shared/di/containers/share-container.ts src/lib/shared/di/containers/library-container.ts src/lib/shared/di/index.ts
git commit -m "refactor(r2): rewire DI containers from FirebaseVideoUploader to R2VideoUploader"
```

---

## Task 11: Consumer Migration

**Modify:** Multiple files that reference `firebaseVideoUploader` or `IFirebaseVideoUploader`

- [ ] **11.1** Update `src/lib/features/library/services/implementations/LibrarySaveService.ts`:

```typescript
// OLD (line 17):
import type { IFirebaseVideoUploader } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";

// NEW:
import type { IVideoUploader } from "$lib/shared/share/services/contracts/IVideoUploader";

// OLD (line 35):
private readonly uploadService: IFirebaseVideoUploader | null;

// NEW:
private readonly uploadService: IVideoUploader | null;

// OLD (line 41):
uploadService: IFirebaseVideoUploader | null,

// NEW:
uploadService: IVideoUploader | null,
```

No other changes needed in this file. The `uploadSequenceThumbnail` call (line 208) already matches the new interface signature since the old call `uploadSequenceThumbnail(sequenceId, imageBlob, "png")` maps to the same positional args in the new interface.

- [ ] **11.2** Update `src/lib/shared/video-collaboration/components/VideoUploadSheet.svelte`:

```typescript
// OLD (line 10):
import type { IFirebaseVideoUploader } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";

// NEW:
import type { IVideoUploader } from "$lib/shared/share/services/contracts/IVideoUploader";

// OLD (line 40):
const uploadService = container.items.firebaseVideoUploader;

// NEW:
const uploadService = container.items.videoUploader;
```

Update the `handleUpload` function. The `uploadPerformanceVideo` call needs its progress callback wrapped in an options object:

```typescript
// OLD (lines 147-153):
const uploadResult = await uploadService.uploadPerformanceVideo(
  sequence.id,
  selectedFile,
  (progress: number) => {
    // Reserve 0-90% for video, 90-100% for thumbnail
    uploadProgress = Math.round(progress * 0.9);
  }
);

// NEW:
const uploadResult = await uploadService.uploadPerformanceVideo(
  sequence.id,
  selectedFile,
  {
    onProgress: (progress: number) => {
      uploadProgress = Math.round(progress * 0.9);
    },
  }
);
```

Update the `storagePath` reference to `key`:

```typescript
// OLD (line 162):
const videoTimestamp = parseInt(
  uploadResult.storagePath.split("/").pop()?.split(".")[0] || "0"
);

// NEW:
const videoTimestamp = parseInt(
  uploadResult.key.split("/").pop()?.split(".")[0] || "0"
);
```

- [ ] **11.3** Update `src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte`:

Replace the direct `FirebaseVideoUploader` instantiation with DI container access:

```typescript
// OLD (line 19):
import { FirebaseVideoUploader } from "$lib/shared/share/services/implementations/FirebaseVideoUploader";

// NEW:
import { container } from "$lib/shared/di";
import type { IVideoUploader } from "$lib/shared/share/services/contracts/IVideoUploader";

// OLD (line 34):
let uploadService: FirebaseVideoUploader | null = $state(null);

// NEW (no $state needed, resolved from DI immediately):
// (Remove this line, replace with const below)

// OLD (lines 42-44 in onMount):
onMount(() => {
  uploadService = new FirebaseVideoUploader();
  persistenceService = new RecordingPersister();
});

// NEW:
const uploadService = container.items.videoUploader as IVideoUploader;
// Keep persistenceService in onMount or move it out too:
onMount(() => {
  persistenceService = new RecordingPersister();
});
```

Update the `uploadRecording` function:

```typescript
// OLD (line 160):
if (!uploadService || !persistenceService) {

// NEW:
if (!persistenceService) {

// OLD (lines 169-172):
const uploadResult = await uploadService.uploadPerformanceVideo(
  sequenceId,
  recording.videoBlob!,
  (progress) => logger.log(`Upload progress: ${progress}%`)
);

// NEW:
const uploadResult = await uploadService.uploadPerformanceVideo(
  sequenceId,
  recording.videoBlob!,
  { onProgress: (progress) => logger.log(`Upload progress: ${progress}%`) }
);

// OLD (line 180):
storagePath: uploadResult.storagePath,

// NEW:
storagePath: uploadResult.key,
```

Note: `createRecordingMetadata` still uses `storagePath` as a field name. That's fine for now - the R2 key serves the same purpose (identifies the file for deletion). The field name in `RecordingMetadata` can be renamed in a follow-up if desired.

- [ ] **11.4** Update `src/lib/shared/video-collaboration/helpers/create-video-from-upload.ts`:

```typescript
// OLD (line 8):
import type { VideoUploadResult } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";

// NEW:
import type { VideoUploadResult } from "$lib/shared/share/services/contracts/IVideoUploader";
```

The `VideoUploadResult` type now has `key` instead of `storagePath`. Update the usage in `createVideoFromUpload`:

```typescript
// OLD (line 91):
storagePath: uploadResult.storagePath,

// NEW:
storagePath: uploadResult.key,
```

The `CollaborativeVideo` type still uses `storagePath` as its field name (it's a Firestore document field). The R2 key is stored in that field. Renaming the Firestore field would require a data migration, which is unnecessary for a pre-launch app, but the field semantics are the same: "path to the file for deletion."

- [ ] **11.5** Update `src/lib/features/skel2tka/services/implementations/TrainingDataPersister.ts`:

Comment-only change:

```typescript
// OLD (line 169):
// Implementation will follow the FirebaseVideoUploader pattern

// NEW:
// Implementation will follow the R2VideoUploader pattern
```

- [ ] **11.6** Verify build:

```bash
npm run check
```

Expected: no type errors.

- [ ] **11.7** Commit:

```
git add src/lib/features/library/services/implementations/LibrarySaveService.ts src/lib/shared/video-collaboration/components/VideoUploadSheet.svelte src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte src/lib/shared/video-collaboration/helpers/create-video-from-upload.ts src/lib/features/skel2tka/services/implementations/TrainingDataPersister.ts
git commit -m "refactor(r2): migrate all consumers from FirebaseVideoUploader to R2VideoUploader"
```

---

## Task 12: Delete Old Files

**Delete:** `src/lib/shared/share/services/implementations/FirebaseVideoUploader.ts`
**Delete:** `src/lib/shared/share/services/contracts/IFirebaseVideoUploader.ts`

- [ ] **12.1** Verify no remaining references to the old files:

```bash
grep -r "IFirebaseVideoUploader\|FirebaseVideoUploader" src/ --include="*.ts" --include="*.svelte"
```

Expected: zero results (or only the files about to be deleted).

- [ ] **12.2** Delete the files:

```bash
git rm src/lib/shared/share/services/implementations/FirebaseVideoUploader.ts
git rm src/lib/shared/share/services/contracts/IFirebaseVideoUploader.ts
```

- [ ] **12.3** Commit:

```
git add src/lib/shared/share/services/implementations/FirebaseVideoUploader.ts src/lib/shared/share/services/contracts/IFirebaseVideoUploader.ts
git commit -m "refactor(r2): delete FirebaseVideoUploader and IFirebaseVideoUploader (replaced by R2)"
```

---

## Task 13: Build Verification

- [ ] **13.1** Full build:

```bash
npm run build
```

Expected: builds without errors.

- [ ] **13.2** Type check:

```bash
npm run check
```

Expected: no type errors.

- [ ] **13.3** Run existing tests:

```bash
npm test
```

Expected: all existing tests pass (none test FirebaseVideoUploader directly).

- [ ] **13.4** If any errors, fix them and commit:

```
git add -A
git commit -m "fix(r2): resolve build errors from R2 migration"
```

---

## Task 14: End-to-End Testing

**This task is manual. Run through each scenario in the app.**

- [ ] **14.1** Upload a small video (<10MB):
  - Navigate to a saved sequence
  - Open the video record panel or video upload sheet
  - Record or select a small video
  - Verify progress bar updates smoothly
  - Verify the video appears and plays back from the R2 URL
  - Check browser DevTools Network tab: confirm PUT goes directly to R2, not Firebase Storage

- [ ] **14.2** Cancel mid-upload:
  - Start a video upload
  - Cancel while progress is between 10-90%
  - Verify upload stops immediately
  - Verify no partial data remains (check R2 dashboard)

- [ ] **14.3** Upload a sequence thumbnail:
  - Save a sequence to library
  - Verify the thumbnail is uploaded to R2 (check URL in browser DevTools)

- [ ] **14.4** Delete sequence assets:
  - Delete a sequence that has a video and thumbnail
  - Verify R2 objects are cleaned up (check R2 dashboard)

- [ ] **14.5** Test on mobile:
  - Open the app on a phone (iOS Safari and Chrome Android)
  - Upload a video
  - Verify progress and playback work

- [ ] **14.6** Verify zero Firebase Storage usage:
  - Check Firebase Console > Storage
  - Confirm no new files are being written for videos/thumbnails/animations

- [ ] **14.7** If multipart testing is needed (file >= 100MB):
  - Upload a large video file
  - Close the browser tab mid-upload
  - Reopen and upload the same file
  - Verify it resumes from where it left off (check localStorage for `tka-multipart-uploads` key)
  - Verify the file completes successfully

---

## Summary of All Files Changed

### Created (6 files)

| File | Purpose |
|------|---------|
| `firebase-functions/src/r2/r2-client.ts` | S3-compatible R2 client helpers |
| `firebase-functions/src/r2/index.ts` | 8 Cloud Functions for presign, multipart, delete |
| `src/lib/shared/share/services/contracts/IVideoUploader.ts` | New upload interface |
| `src/lib/shared/share/services/contracts/IR2Presigner.ts` | Cloud Function wrapper interface |
| `src/lib/shared/share/services/implementations/R2Presigner.ts` | Cloud Function wrapper implementation |
| `src/lib/shared/share/services/implementations/R2VideoUploader.ts` | Core upload orchestrator |

### Modified (9 files)

| File | Change |
|------|--------|
| `firebase-functions/package.json` | Add @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner |
| `firebase-functions/src/index.ts` | Export R2 Cloud Functions |
| `src/lib/shared/di/containers/share-container.ts` | Swap FirebaseVideoUploader for R2Presigner + R2VideoUploader |
| `src/lib/shared/di/containers/library-container.ts` | Update dep type from IFirebaseVideoUploader to IVideoUploader |
| `src/lib/shared/di/index.ts` | Update dep name from firebaseVideoUploader to videoUploader |
| `src/lib/features/library/services/implementations/LibrarySaveService.ts` | Update import and field type |
| `src/lib/shared/video-collaboration/components/VideoUploadSheet.svelte` | Update service access, progress callback, storagePath to key |
| `src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte` | Remove direct instantiation, use DI, update callback and field |
| `src/lib/shared/video-collaboration/helpers/create-video-from-upload.ts` | Update import path and storagePath to key |
| `src/lib/features/skel2tka/services/implementations/TrainingDataPersister.ts` | Comment update only |

### Deleted (2 files)

| File | Why |
|------|-----|
| `src/lib/shared/share/services/implementations/FirebaseVideoUploader.ts` | Replaced by R2VideoUploader |
| `src/lib/shared/share/services/contracts/IFirebaseVideoUploader.ts` | Replaced by IVideoUploader |
