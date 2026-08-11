/**
 * The callable that actually posts.
 *
 * One entry point for both targets because the caller's decision is "post this
 * artifact there", not "run the Instagram container protocol". The protocol
 * differences (a two-phase container on Instagram, a photo endpoint or a
 * three-phase reel upload on a Page) stay inside `metaGraphClient`.
 *
 * The media itself is never uploaded from here. Meta fetches it from the R2
 * URL the share sheet already produced, which is why that URL is validated
 * against the app's own host before it is handed over.
 */

import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  createInstagramContainer,
  publishFacebookPagePhoto,
  publishFacebookPageReel,
  publishInstagramContainer,
  readFacebookPermalink,
  readInstagramContainerStatus,
  readInstagramPermalink,
} from "./metaGraphClient";
import {
  readConnections,
  type MetaConnectionTarget,
} from "./metaConnectionStore";
import {
  assertAllowedMediaUrl,
  assertInstagramImageFormat,
  interpretContainerStatus,
  MetaPublishError,
  sanitizeCaption,
  type MetaPublishMediaType,
} from "./metaPublishPolicy";

const r2PublicUrl = defineSecret("R2_PUBLIC_URL");

/** Instagram processes a reel asynchronously; a short poll is the documented
 *  way to find out when the container is publishable. */
const CONTAINER_POLL_INTERVAL_MS = 3_000;
const CONTAINER_POLL_BUDGET_MS = 180_000;

function requireSignedInCaller(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to post", {
      reason: "meta/session-required",
    });
  }
  const firebaseClaim = request.auth.token.firebase as
    | { sign_in_provider?: string }
    | undefined;
  if (firebaseClaim?.sign_in_provider === "anonymous") {
    throw new HttpsError(
      "failed-precondition",
      "A full account is required to post to Meta",
      { reason: "meta/account-required" }
    );
  }
  return request.auth.uid;
}

function parseTarget(value: unknown): MetaConnectionTarget {
  if (value === "instagram" || value === "facebook-page") return value;
  throw new HttpsError("invalid-argument", "Unknown post target", {
    reason: "meta/target-invalid",
  });
}

function parseMediaType(value: unknown): MetaPublishMediaType {
  if (value === "image" || value === "video") return value;
  throw new HttpsError("invalid-argument", "Unknown media type", {
    reason: "meta/media-type-invalid",
  });
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof MetaPublishError) {
    return new HttpsError("failed-precondition", error.message, {
      reason: error.code,
    });
  }
  return new HttpsError("internal", "Could not publish this post", {
    reason: "meta/provider-error",
  });
}

export const publishToMeta = onCall(
  { secrets: [r2PublicUrl], timeoutSeconds: 300, memory: "256MiB" },
  async (request) => {
    const uid = requireSignedInCaller(request);
    const target = parseTarget(request.data?.target);
    const mediaType = parseMediaType(request.data?.mediaType);
    const mediaUrl =
      typeof request.data?.mediaUrl === "string" ? request.data.mediaUrl : "";
    const rawCaption =
      typeof request.data?.caption === "string" ? request.data.caption : "";

    try {
      assertAllowedMediaUrl(mediaUrl, r2PublicUrl.value().trim());
      const { caption } = sanitizeCaption(rawCaption);
      const connections = await readConnections(uid);

      const result =
        target === "instagram"
          ? await publishInstagram({
              connection: connections.instagram,
              caption,
              mediaUrl,
              mediaType,
            })
          : await publishFacebookPage({
              connection: connections.facebookPage,
              caption,
              mediaUrl,
              mediaType,
            });

      functions.logger.info("Published to Meta", {
        uid,
        target,
        mediaType,
        hasPermalink: Boolean(result.permalink),
      });
      return { target, ...result };
    } catch (error) {
      functions.logger.warn("Meta publish failed", {
        uid,
        target,
        mediaType,
        reason:
          error instanceof MetaPublishError
            ? error.code
            : error instanceof HttpsError
              ? error.code
              : "unknown",
      });
      throw toHttpsError(error);
    }
  }
);

async function publishInstagram(input: {
  connection: Awaited<ReturnType<typeof readConnections>>["instagram"];
  caption: string;
  mediaUrl: string;
  mediaType: MetaPublishMediaType;
}): Promise<{ permalink: string | null; postId: string }> {
  const connection = input.connection;
  if (!connection) throw new MetaPublishError("meta/not-connected");
  if (connection.expiresAt.toMillis() <= Date.now()) {
    throw new MetaPublishError("meta/token-expired");
  }
  if (input.mediaType === "image") {
    assertInstagramImageFormat(input.mediaUrl);
  }

  const containerId = await createInstagramContainer({
    igUserId: connection.igUserId,
    accessToken: connection.accessToken,
    caption: input.caption,
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaType,
  });

  await waitForContainer({
    containerId,
    accessToken: connection.accessToken,
    // An image container is ready on creation; polling it wastes a round trip.
    skipPolling: input.mediaType === "image",
  });

  const mediaId = await publishInstagramContainer({
    igUserId: connection.igUserId,
    containerId,
    accessToken: connection.accessToken,
  });
  const permalink = await readInstagramPermalink({
    mediaId,
    accessToken: connection.accessToken,
  });

  return { permalink, postId: mediaId };
}

async function waitForContainer(input: {
  containerId: string;
  accessToken: string;
  skipPolling: boolean;
}): Promise<void> {
  if (input.skipPolling) return;

  const deadline = Date.now() + CONTAINER_POLL_BUDGET_MS;
  while (Date.now() < deadline) {
    const statusCode = await readInstagramContainerStatus({
      containerId: input.containerId,
      accessToken: input.accessToken,
    });
    const progress = interpretContainerStatus(statusCode);

    if (progress.state === "ready") return;
    if (progress.state === "failed") {
      throw new MetaPublishError(progress.code, progress.message);
    }
    await delay(CONTAINER_POLL_INTERVAL_MS);
  }

  throw new MetaPublishError(
    "meta/timed-out",
    "Instagram is still processing this video. Check your profile in a minute."
  );
}

async function publishFacebookPage(input: {
  connection: Awaited<ReturnType<typeof readConnections>>["facebookPage"];
  caption: string;
  mediaUrl: string;
  mediaType: MetaPublishMediaType;
}): Promise<{ permalink: string | null; postId: string }> {
  const connection = input.connection;
  if (!connection) throw new MetaPublishError("meta/not-connected");
  if (connection.expiresAt.toMillis() <= Date.now()) {
    throw new MetaPublishError("meta/token-expired");
  }

  // Distinct from not-connected: the account IS connected, it just administers
  // several Pages and none has been chosen. Posting to a guess is the failure
  // this separates out.
  if (!connection.selectedPageId) {
    throw new MetaPublishError("meta/page-required");
  }

  const page = connection.pages.find(
    (candidate) => candidate.id === connection.selectedPageId
  );
  if (!page) throw new MetaPublishError("meta/not-connected");

  const published =
    input.mediaType === "image"
      ? await publishFacebookPagePhoto({
          pageId: page.id,
          pageAccessToken: page.accessToken,
          imageUrl: input.mediaUrl,
          caption: input.caption,
        })
      : await publishFacebookPageReel({
          pageId: page.id,
          pageAccessToken: page.accessToken,
          videoUrl: input.mediaUrl,
          description: input.caption,
        });

  if (!published.postId) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Facebook did not confirm the post"
    );
  }

  const permalink = await readFacebookPermalink({
    objectId: published.postId,
    pageAccessToken: page.accessToken,
  });

  return { permalink, postId: published.postId };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
