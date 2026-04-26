---
status: backlog
value: 5
effort: S
score: 20
remaining: "Core live. Verify multipart for large files"
last_triaged: 2026-04-26
---
# R2 Video Storage Migration

## Overview

Replace Firebase Storage with Cloudflare R2 for all user-uploaded video, animation, and thumbnail storage.

### Why

Firebase Storage charges $0.12/GB for egress (downloads). Every time a user watches a video or loads a thumbnail, that's egress. R2 charges $0.00/GB for egress. The storage cost is comparable ($0.015/GB/month for R2 vs $0.026/GB/month for Firebase Storage), but the egress difference is the entire point.

At scale, this is the difference between a manageable bill and a runaway one.

### Cost Projection

| Scale | Firebase Storage (store) | Firebase Egress (100x reads) | Firebase Total/mo | R2 Storage | R2 Egress | R2 Total/mo |
|-------|--------------------------|------------------------------|---------------------|------------|-----------|-------------|
| 100 GB | $2.60 | $1,200 | $1,202.60 | $1.50 | $0 | $1.50 |
| 1 TB | $26.00 | $12,000 | $12,026 | $15.00 | $0 | $15.00 |
| 10 TB | $260.00 | $120,000 | $120,260 | $150.00 | $0 | $150.00 |

Firebase egress assumes each GB is downloaded 100 times per month (modest for a social/sharing app). R2 Class A operations (writes) cost $4.50/million; Class B (reads) cost $0.36/million -- negligible at any realistic scale.

The app is pre-launch. There are few or no real user videos in Firebase Storage, so no data migration is needed. This is a clean swap.

---

## Architecture

### Critical Constraint: Static Adapter

TKA uses `@sveltejs/adapter-static`. There are no SvelteKit server routes in production. All server-side logic (presigned URL generation, multipart orchestration) must live in **Firebase Cloud Functions**, not SvelteKit API routes.

Cirque Aflame uses SvelteKit server routes (`src/routes/api/r2/...`) because it runs on a server adapter. TKA cannot do this. The pattern must be adapted to use callable Cloud Functions instead.

### Component Map

```
Browser (client)                         Firebase Cloud Functions (server)
┌─────────────────────┐                  ┌──────────────────────────────┐
│ R2VideoUploader      │ ── HTTPS ──►    │ r2PresignUrl                 │
│ (implements          │                  │ r2MultipartStart             │
│  IVideoUploader)     │ ◄── presigned   │ r2MultipartPartUrl           │
│                      │     URLs ──      │ r2MultipartComplete          │
│                      │                  │ r2MultipartAbort             │
│                      │ ── PUT ──►      │ r2MultipartListParts         │
│                      │  directly to    │ r2DeleteObject               │
│                      │  R2 bucket      │ r2DeleteByPrefix             │
└─────────────────────┘                  │ All use @aws-sdk/client-s3   │
                                         │ with R2 credentials from     │
                                         │ functions.config() or        │
                                         │ Cloud Secret Manager         │
                                         └──────────────────────────────┘
```

The browser never touches R2 credentials. It calls a Cloud Function to get a presigned URL, then uploads directly to R2 via that URL. The Cloud Function validates Firebase Auth before issuing any presigned URL.

---

## Client-Side Components

### IVideoUploader Interface

**Path:** `src/lib/shared/share/services/contracts/IVideoUploader.ts`

Replaces `IFirebaseVideoUploader`. Same methods, but the return type changes: `storagePath` becomes the R2 object key, and `url` becomes the R2 public URL.

```typescript
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

Key changes from `IFirebaseVideoUploader`:
1. `storagePath: string` becomes `key: string` (R2 object key)
2. `onProgress` callback moves into an `UploadOptions` object alongside `signal` for cancellation
3. `getPublicUrl` becomes synchronous (just concatenates base URL + key, no async Firebase SDK call)
4. Adds `MultipartUploadState` for resume capability

### Breaking Signature Changes

Every consumer that calls these methods needs updating. Here are the exact changes:

| Method | Old Signature (`IFirebaseVideoUploader`) | New Signature (`IVideoUploader`) |
|--------|------------------------------------------|----------------------------------|
| `uploadPerformanceVideo` | `(sequenceId, videoFile, onProgress?) => Promise<{url, storagePath}>` | `(sequenceId, videoFile, options?) => Promise<{url, key}>` |
| `uploadAnimatedSequence` | `(sequenceId, animationBlob, format) => Promise<{url, storagePath}>` | `(sequenceId, animationBlob, format, options?) => Promise<{url, key}>` |
| `uploadVideoThumbnail` | `(sequenceId, thumbnailBlob, videoTimestamp) => Promise<{url, storagePath}>` | `(sequenceId, thumbnailBlob, videoTimestamp, options?) => Promise<{url, key}>` |
| `uploadSequenceThumbnail` | `(sequenceId, thumbnailBlob, format?) => Promise<{url, storagePath}>` | `(sequenceId, thumbnailBlob, format?, options?) => Promise<{url, key}>` |
| `getPublicUrl` | `(storagePath) => Promise<string>` | `(key) => string` (sync) |
| `deleteSequenceAssets` | `(sequenceId) => Promise<void>` | `(sequenceId) => Promise<void>` (unchanged) |

The `onProgress` callback moves from a standalone parameter to `options.onProgress`. Any caller passing a progress callback needs to wrap it: `(p) => logger.log(p)` becomes `{ onProgress: (p) => logger.log(p) }`.

The return type field rename (`storagePath` to `key`) means any destructuring like `const { storagePath } = await upload(...)` must become `const { key } = await upload(...)`.

### `getPublicUrl` Async-to-Sync Migration

The old `getPublicUrl` returned `Promise<string>` because it called Firebase's `getDownloadURL()` which requires a network round-trip. The new version returns `string` synchronously because it just concatenates the R2 public base URL with the object key. No callers in the current codebase `await` the result of `getPublicUrl` (they all use it inline in template expressions or assignment), so this change is safe and requires no caller updates beyond the type annotation.

### R2VideoUploader Implementation

**Path:** `src/lib/shared/share/services/implementations/R2VideoUploader.ts`

This is the core client-side class. It handles:

1. **Small files (<100MB):** Single presigned PUT via XHR with progress tracking
2. **Large files (>=100MB):** Multipart upload with 10MB chunks, 3 concurrent parts, per-part progress
3. **Cancellation:** AbortSignal propagated to XHR requests
4. **Resume:** Multipart state persisted to localStorage; on resume, queries R2 for which parts exist and uploads only the missing ones
5. **Error handling:** Uses the project's `IErrorHandler` for user-facing error feedback

#### Upload Flow (Single File <100MB)

```
1. R2VideoUploader.uploadPerformanceVideo() called
2. Get Firebase Auth ID token
3. Call r2PresignUrl Cloud Function with { fileName, contentType, contentLength, userId, category, sequenceId }
4. Cloud Function validates auth, generates presigned PUT URL + public URL, returns both
5. XHR PUT the file bytes directly to the presigned URL
6. XHR.upload.onprogress reports progress to caller
7. On success, return { url: publicUrl, key }
```

#### Upload Flow (Multipart >=100MB)

```
1. R2VideoUploader detects file.size >= MULTIPART_THRESHOLD
2. Call r2MultipartStart Cloud Function -> { uploadId, key }
3. Calculate parts (Math.ceil(file.size / PART_SIZE))
4. For each part (3 concurrent):
   a. Call r2MultipartPartUrl Cloud Function -> { presignedUrl }
   b. XHR PUT the chunk to presigned URL
   c. Capture ETag from response header
   d. Report per-part progress
   e. Persist multipart state to localStorage
5. Call r2MultipartComplete Cloud Function with all ETags
6. Return { url: publicUrl, key }
```

#### Upload Flow (Resume)

```
1. On page load, check localStorage for interrupted multipart state
2. Call r2MultipartListParts Cloud Function -> confirmed parts on R2
3. Compare with saved state, identify missing parts
4. Upload only missing parts (same concurrent worker pattern)
5. Complete multipart upload
```

### R2Presigner

**Path:** `src/lib/shared/share/services/implementations/R2Presigner.ts`

Wraps all Cloud Function calls. Keeps the R2VideoUploader focused on upload orchestration rather than HTTP plumbing. Named `R2Presigner` (not "Client") per the project naming convention where services are named by what they do.

```typescript
export class R2Presigner implements IR2Presigner {
  /** Get a presigned PUT URL for a single file upload */
  async getUploadUrl(params: {
    fileName: string;
    contentType: string;
    contentLength: number;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ presignedUrl: string; publicUrl: string; key: string }>;

  /** Start a multipart upload */
  async startMultipart(params: {
    fileName: string;
    contentType: string;
    userId: string;
    category: string;
    sequenceId: string;
  }): Promise<{ uploadId: string; key: string }>;

  /** Get presigned URL for one part of a multipart upload */
  async getPartUrl(params: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<{ presignedUrl: string }>;

  /** Complete a multipart upload */
  async completeMultipart(params: {
    key: string;
    uploadId: string;
    parts: Array<{ ETag: string; PartNumber: number }>;
  }): Promise<{ publicUrl: string }>;

  /** Abort a multipart upload */
  async abortMultipart(params: {
    key: string;
    uploadId: string;
  }): Promise<void>;

  /** List parts already uploaded (for resume) */
  async listParts(params: {
    key: string;
    uploadId: string;
  }): Promise<{ parts: Array<{ ETag: string; PartNumber: number; Size: number }>; expired: boolean }>;

  /** Delete an object from R2 */
  async deleteObject(key: string): Promise<void>;
}
```

Each method calls the corresponding Firebase Cloud Function using `httpsCallable` from the Firebase SDK. This handles auth token propagation automatically -- the Cloud Function receives `context.auth.uid` without any manual token passing.

### UploadAbortManager

**Path:** `src/lib/shared/share/services/implementations/UploadAbortManager.ts`

Manages cancellation for in-flight uploads. Tracks active XHR requests and can abort them all when the user cancels. Named `UploadAbortManager` (not "Controller") per the project naming convention.

Ported from Cirque Aflame's `UploadController` class in `media-r2.ts`, adapted to be a standalone DI-registered service rather than an inline class.

---

## Server-Side Components (Cloud Functions)

### R2 Client Module

**Path:** `firebase-functions/src/r2/r2-client.ts`

```typescript
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
```

Ported from Cirque Aflame's `ringmaster/src/lib/server/r2.ts`. Key differences:

1. Reads credentials from `functions.config().r2` or `defineSecret()` (Firebase's secret management), not SvelteKit `$env`
2. Same S3-compatible client setup (region: 'auto', R2 endpoint)
3. Same multipart helper functions (create, getPartUrl, complete, abort, listParts)

### Cloud Functions

**Path:** `firebase-functions/src/r2/index.ts`

Eight callable Cloud Functions, each thin wrappers around the R2 client:

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `r2PresignUrl` | Generate presigned PUT URL for single upload | Yes |
| `r2MultipartStart` | Initiate multipart upload, return uploadId | Yes |
| `r2MultipartPartUrl` | Generate presigned URL for one part | Yes |
| `r2MultipartComplete` | Finalize multipart upload with ETags | Yes |
| `r2MultipartAbort` | Abort and clean up multipart upload | Yes |
| `r2MultipartListParts` | List uploaded parts (for resume) | Yes |
| `r2DeleteObject` | Delete a single object from R2 | Yes |
| `r2DeleteByPrefix` | Delete all objects matching a prefix (for sequence asset cleanup) | Yes |

Every function:
1. Validates `context.auth` exists (rejects unauthenticated calls)
2. Validates the `userId` in the R2 key path matches `context.auth.uid` (users can only upload to their own path)
3. Validates content type (only video, image, animation MIME types)
4. Calls the R2 client module
5. Returns the result

Example function signature (using Firebase Functions v2):

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const r2AccountId = defineSecret("R2_ACCOUNT_ID");
const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");

export const r2PresignUrl = onCall(
  { secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }
    // ... generate presigned URL, return { presignedUrl, publicUrl, key }
  }
);
```

### Prefix Deletion: `r2DeleteByPrefix`

R2 (and S3) does NOT support prefix-based deletion natively. Firebase Storage lets you delete a folder path, but R2 requires a two-step process: list all objects with the prefix, then batch-delete them.

This function powers `deleteSequenceAssets()`. When a user deletes a sequence, the client calls this function with the sequence's prefix, and the function enumerates and removes all matching objects.

```typescript
import {
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

export const r2DeleteByPrefix = onCall(
  { secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { prefix } = request.data;
    if (!prefix || typeof prefix !== "string") {
      throw new HttpsError("invalid-argument", "prefix is required");
    }

    // Auth check: prefix must start with "users/{callerUid}/"
    // This prevents users from deleting other users' assets.
    const expectedPrefix = `users/${request.auth.uid}/`;
    if (!prefix.startsWith(expectedPrefix)) {
      throw new HttpsError(
        "permission-denied",
        "Cannot delete objects outside your own path"
      );
    }

    const s3 = getR2Client();
    let continuationToken: string | undefined;
    let totalDeleted = 0;

    // Paginate through all objects with this prefix and batch-delete them.
    // DeleteObjects handles up to 1000 keys per call.
    do {
      const listResult = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      const objects = listResult.Contents;
      if (!objects || objects.length === 0) break;

      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key })),
            Quiet: true, // Don't return individual results, just errors
          },
        })
      );

      totalDeleted += objects.length;
      continuationToken = listResult.IsTruncated
        ? listResult.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return { deletedCount: totalDeleted };
  }
);
```

The `R2Presigner` client-side class needs a corresponding method:

```typescript
async deleteByPrefix(prefix: string): Promise<{ deletedCount: number }>;
```

The `R2VideoUploader.deleteSequenceAssets()` implementation calls this:

```typescript
async deleteSequenceAssets(sequenceId: string): Promise<void> {
  const userId = getCurrentUserId();
  // Delete all asset types for this sequence across all categories
  const prefixes = [
    `users/${userId}/recordings/${sequenceId}/`,
    `users/${userId}/animations/${sequenceId}/`,
    `users/${userId}/thumbnails/${sequenceId}/`,
  ];
  await Promise.all(
    prefixes.map((prefix) => this.presigner.deleteByPrefix(prefix))
  );
}
```

### Dependencies Added to firebase-functions/package.json

```json
"@aws-sdk/client-s3": "^3.700.0",
"@aws-sdk/s3-request-presigner": "^3.700.0"
```

---

## Storage Structure

### Bucket

- **Name:** `tka-videos`
- **Account:** Same Cloudflare account as Cirque Aflame
- **Location:** Automatic (Cloudflare picks closest region)
- **Public access:** Enabled via R2 public bucket URL or custom domain (`media.tkascribe.com` later)

### Path Convention

```
users/{userId}/recordings/{sequenceId}/{timestamp}.mp4
users/{userId}/animations/{sequenceId}/sequence.{webp|gif}
users/{userId}/thumbnails/{sequenceId}/thumbnail.{png|jpeg|webp}
users/{userId}/recordings/{sequenceId}/{timestamp}_thumb.jpg
```

Same path structure as the current Firebase Storage layout. The `userId` prefix enables per-user authorization in the Cloud Functions (verify `context.auth.uid === userId` in the key).

### Key Generation

The Cloud Function generates the full R2 key. The client sends `{ userId, category, sequenceId, timestamp, extension }` and the function assembles the key. The client never controls the key directly -- this prevents path traversal or overwriting other users' files.

### Public URL

Format: `https://{R2_PUBLIC_URL}/users/{userId}/recordings/{sequenceId}/{timestamp}.mp4`

`R2_PUBLIC_URL` is either:
- R2's built-in public bucket URL: `https://pub-{hash}.r2.dev`
- A custom domain: `https://media.tkascribe.com` (configured via Cloudflare DNS, CNAME to the R2 bucket)

Custom domain is preferred for branding and URL stability. The R2 public URL can change if the bucket is recreated.

---

## Security

### Presigned URLs

- Single upload URLs expire after **15 minutes** (enough for a large upload on slow connections)
- Multipart part URLs expire after **60 minutes** (multipart uploads can take a while for very large files)
- URLs are single-use PUT-only. They cannot be used for GET, DELETE, or LIST.
- Content-Type is locked in the presigned URL. You cannot upload a different MIME type.

### Auth Flow

```
1. Client calls Cloud Function (Firebase Auth token attached automatically by SDK)
2. Cloud Function verifies context.auth.uid exists
3. Cloud Function verifies userId in the requested path matches context.auth.uid
4. Cloud Function generates presigned URL scoped to that specific key
5. Client PUTs directly to R2 using the presigned URL
```

No anonymous uploads. No cross-user uploads. The Cloud Function is the sole gatekeeper.

### R2 Bucket Configuration

- **Public read:** Enabled (via R2 public bucket or custom domain). Anyone can read uploaded files by URL. This is intentional -- videos are shared content.
- **Public write:** Disabled. All writes go through presigned URLs generated by authenticated Cloud Functions.
- **CORS:** Configure to allow PUT from the app's origin (`https://tkascribe.com` and `http://localhost:5173` for dev)
- **Lifecycle rule:** Set `AbortIncompleteMultipartUpload` to 1 day. Without this, failed or abandoned multipart uploads leave orphaned chunks in R2 that accumulate storage cost silently. R2 supports S3-compatible lifecycle rules. Configure via the Cloudflare dashboard or API:

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

### R2 Credentials

Stored in Firebase Cloud Secret Manager (not environment variables, not `.env`):

```bash
firebase functions:secrets:set R2_ACCOUNT_ID
firebase functions:secrets:set R2_ACCESS_KEY_ID
firebase functions:secrets:set R2_SECRET_ACCESS_KEY
firebase functions:secrets:set R2_BUCKET_NAME
firebase functions:secrets:set R2_PUBLIC_URL
```

Accessed in functions via `defineSecret()`. Never exposed to the client.

### Cloudflare API Token Scope

Create a dedicated API token in Cloudflare with:
- **Permissions:** R2 Object Read & Write
- **Scope:** Single bucket (`tka-videos` only)
- **No other Cloudflare permissions** (not DNS, not Workers, not anything else)

---

## Upload Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `MAX_VIDEO_FILE_SIZE` | 500 MB | Hard cap for video uploads. Prevents abuse and runaway storage costs. |
| `MAX_THUMBNAIL_FILE_SIZE` | 10 MB | Hard cap for thumbnail/image uploads. No thumbnail should be anywhere near this. |
| `MULTIPART_THRESHOLD` | 100 MB | R2's sweet spot. Below this, single PUT is faster. |
| `PART_SIZE` | 10 MB | Above R2's 5MB minimum. Good balance of parallelism and overhead. |
| `MAX_CONCURRENT_PARTS` | 3 | Enough to saturate most connections without overwhelming mobile browsers. |
| `PRESIGN_EXPIRES_SINGLE` | 900s (15 min) | Generous for slow connections but short enough to limit abuse. |
| `PRESIGN_EXPIRES_MULTIPART` | 3600s (60 min) | Multipart uploads can be long-running. |

The Cloud Function must validate `contentLength` against these limits when generating presigned URLs. Without this, a user (or attacker) could upload arbitrarily large files. The check happens server-side in `r2PresignUrl` and `r2MultipartStart`:

```typescript
const MAX_VIDEO = 500 * 1024 * 1024;   // 500 MB
const MAX_THUMBNAIL = 10 * 1024 * 1024; // 10 MB

const limit = category === "thumbnails" ? MAX_THUMBNAIL : MAX_VIDEO;
if (contentLength > limit) {
  throw new HttpsError(
    "invalid-argument",
    `File too large. Maximum ${limit / (1024 * 1024)}MB for ${category}.`
  );
}
```

The client should also check before calling the Cloud Function (fail fast, better UX), but the server-side check is the real enforcement.

---

## DI Integration

### New Registrations

In `src/lib/shared/di/containers/share-container.ts`:

```typescript
// Remove:
import { FirebaseVideoUploader } from "...";
firebaseVideoUploader: () => new FirebaseVideoUploader(),

// Add:
import { R2Presigner } from "...";
import { R2VideoUploader } from "...";

r2Presigner: () => new R2Presigner(),
videoUploader: () => new R2VideoUploader(items.r2Presigner),
```

### Container Type Updates

In `src/lib/shared/di/container-types.ts`, replace `firebaseVideoUploader` with `videoUploader` and `r2Presigner`.

### Consumer Updates

All files that reference `firebaseVideoUploader` or `IFirebaseVideoUploader` need updating:

| File | Change |
|------|--------|
| `share-container.ts` | Swap registration |
| `library-container.ts` | Update dep type from `IFirebaseVideoUploader` to `IVideoUploader` |
| `LibrarySaveService.ts` | Update import and field type |
| `VideoUploadSheet.svelte` | `container.items.videoUploader` instead of `container.items.firebaseVideoUploader` |
| `VideoRecordCoordinator.svelte` | Remove direct `new FirebaseVideoUploader()`, use DI container (see below) |
| `create-video-from-upload.ts` | Update import of `VideoUploadResult` to new path |
| `TrainingDataPersister.ts` | Update `syncToFirebase()` comment referencing `FirebaseVideoUploader` pattern (see below) |
| `di/index.ts` | Update re-export name |

### VideoRecordCoordinator DI Migration

`VideoRecordCoordinator.svelte` currently creates its own `FirebaseVideoUploader` instance directly:

```typescript
// CURRENT (line 19, 34, 43):
import { FirebaseVideoUploader } from "...";
let uploadService: FirebaseVideoUploader | null = $state(null);
onMount(() => { uploadService = new FirebaseVideoUploader(); });
```

This bypasses DI entirely. The migration:

```typescript
// NEW:
import { container } from "$lib/shared/di";
import type { IVideoUploader } from "...";

// In onMount or at top level:
const uploadService = container.items.videoUploader as IVideoUploader;
```

Remove the `$state(null)` pattern. The service is stateless and can be resolved from the container immediately. The null-check in `uploadRecording()` (`if (!uploadService)`) can also be removed since the container always returns an instance.

Also update line 173 where `uploadPerformanceVideo` is called with a bare progress callback -- wrap it in the new `UploadOptions` object:

```typescript
// CURRENT:
await uploadService.uploadPerformanceVideo(sequenceId, recording.videoBlob!, (progress) => logger.log(`Upload progress: ${progress}%`));

// NEW:
await uploadService.uploadPerformanceVideo(sequenceId, recording.videoBlob!, { onProgress: (progress) => logger.log(`Upload progress: ${progress}%`) });
```

And update the destructured result: `uploadResult.storagePath` becomes `uploadResult.key`.

### TrainingDataPersister

`TrainingDataPersister.ts` (at `src/lib/features/skel2tka/services/implementations/TrainingDataPersister.ts`) does not directly import or call `FirebaseVideoUploader`, but its `syncToFirebase()` method (line 169) contains a comment: "Implementation will follow the FirebaseVideoUploader pattern." Update this comment to reference the new `R2VideoUploader` pattern instead. This is a comment-only change, no logic update needed. The training data persister stores to IndexedDB, not to video storage.

### VideoUploadResult Import Path

`VideoUploadResult` is currently defined in `IFirebaseVideoUploader.ts`. It moves to `IVideoUploader.ts`. The type itself is the same (url + key), just the `storagePath` field is renamed to `key`.

---

## Resume Capability

### How It Works

Multipart upload state is persisted to `localStorage` after each part completes:

```typescript
const STORAGE_KEY = "tka-multipart-uploads";

// After each part:
localStorage.setItem(STORAGE_KEY, JSON.stringify({
  [fileHash]: {
    uploadId, key, completedParts, totalParts, partSize,
    fileName: file.name, fileSize: file.size, startedAt: Date.now()
  }
}));
```

On the next upload attempt for the same file:
1. Hash the file (first 1MB + last 1MB + file size = fast fingerprint, not full content hash)
2. Check localStorage for matching hash
3. If found, call `r2MultipartListParts` to verify which parts R2 still has
4. Upload only missing parts
5. Complete the multipart upload

### Cleanup

- Completed uploads remove their localStorage entry
- Entries older than 24 hours are purged on page load (R2 multipart uploads expire after 7 days by default, but the presigned URLs expire much sooner)
- Cancelled uploads call `r2MultipartAbort` to free R2 storage, then remove the localStorage entry

---

## Duplicate Detection

Before uploading, compute a fast content fingerprint:

```typescript
async function computeFileFingerprint(file: File): Promise<string> {
  const SAMPLE_SIZE = 1024 * 1024; // 1MB
  const head = file.slice(0, SAMPLE_SIZE);
  const tail = file.slice(Math.max(0, file.size - SAMPLE_SIZE));
  const combined = new Blob([head, tail]);
  const buffer = await combined.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("") + `-${file.size}`;
}
```

If the same fingerprint was recently uploaded (check localStorage or Firestore metadata), skip the upload and return the existing URL. This prevents double-uploads from retry logic or accidental button double-taps.

---

## CORS Configuration

Set on the R2 bucket via Cloudflare dashboard or API:

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

`ExposeHeaders: ["ETag"]` is critical. Without it, the browser cannot read the ETag response header from R2 PUT responses, and multipart uploads will fail because completeParts requires ETags.

---

## What Gets Deleted

| File | Why |
|------|-----|
| `src/lib/shared/share/services/implementations/FirebaseVideoUploader.ts` | Replaced by R2VideoUploader |
| `src/lib/shared/share/services/contracts/IFirebaseVideoUploader.ts` | Replaced by IVideoUploader |

Firebase Storage rules for video paths can also be removed, but this is low priority since unused rules don't cost anything.

---

## Implementation Order

1. **Cloudflare setup** (manual, ~15 min): Create `tka-videos` bucket, enable public access, configure CORS, set `AbortIncompleteMultipartUpload` lifecycle rule (1 day), create scoped API token
2. **Cloud Functions** (~2 hours): R2 client module + 8 callable functions (including `r2DeleteByPrefix`) + secret configuration + deploy
3. **Client services** (~3 hours): `IVideoUploader`, `IR2Presigner`, `R2Presigner`, `R2VideoUploader`, `UploadAbortManager`
4. **DI wiring** (~30 min): Container updates, consumer updates, remove old files
5. **Testing** (~1 hour): Upload a video end-to-end, verify progress bar, cancel mid-upload, resume after page reload, verify public URL works, test on mobile

Total estimated effort: ~7 hours of implementation, mostly mechanical porting from the Cirque Aflame codebase adapted for Cloud Functions instead of SvelteKit API routes.

---

## Success Criteria

- Video upload works end-to-end with R2 (record video, upload, see it play back from R2 URL)
- Progress bar updates smoothly during upload
- Cancellation stops the upload immediately and cleans up partial R2 data
- Resume works: close browser mid-upload, reopen, same file continues from where it left off
- Presigned URLs expire correctly (cannot reuse a URL after expiry)
- Upload works on mobile browsers (iOS Safari, Chrome Android)
- Zero Firebase Storage usage for new uploads
- All existing consumers (LibrarySaveService, VideoUploadSheet, VideoRecordCoordinator) work without changes beyond the interface swap
- Public URLs load videos with no CORS errors
- Cloud Function rejects unauthenticated requests and cross-user path access
