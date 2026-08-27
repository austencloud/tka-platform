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

// Constants

/** Single-file presigned URL expiry: 15 minutes */
export const PRESIGN_EXPIRES_SINGLE = 900;

/** Multipart part presigned URL expiry: 60 minutes */
export const PRESIGN_EXPIRES_MULTIPART = 3600;

/** Maximum video file size: 500 MB */
export const MAX_VIDEO_FILE_SIZE = 500 * 1024 * 1024;

/** Maximum thumbnail file size: 10 MB */
export const MAX_THUMBNAIL_FILE_SIZE = 10 * 1024 * 1024;

// Client factory

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
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // AWS SDK v3.723+ adds CRC32 checksums to all requests by default.
    // Presigned URLs include these as signed query params, but browser
    // XHR can't send the matching headers, causing R2 to return 403.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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
