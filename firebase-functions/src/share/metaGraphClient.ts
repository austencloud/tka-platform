/**
 * Every outbound call to Meta.
 *
 * Isolated from the callables so the publish flow can be read as a sequence of
 * steps, and so the endpoint/parameter details verified against Meta's docs
 * live in one place:
 *
 *   Instagram (Instagram Login):
 *     POST  graph.instagram.com/{ig-id}/media          → container
 *     GET   graph.instagram.com/{container}?fields=status_code
 *     POST  graph.instagram.com/{ig-id}/media_publish  → published media
 *   Facebook Page photo:
 *     POST  graph.facebook.com/{page-id}/photos        (url + caption)
 *   Facebook Page video (hosted URL → reel):
 *     POST  graph.facebook.com/{page-id}/video_reels   upload_phase=start
 *     POST  rupload.facebook.com/video-upload/{video}  file_url header
 *     POST  graph.facebook.com/{page-id}/video_reels   upload_phase=finish
 */

import {
  MetaPublishError,
  mapMetaError,
  type MetaErrorPayload,
} from "./metaPublishPolicy";

export const GRAPH_VERSION = "v23.0";
const IG_GRAPH = `https://graph.instagram.com`;
const FB_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const FB_RUPLOAD = `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}`;
const IG_OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

const REQUEST_TIMEOUT_MS = 30_000;

async function graphRequest<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new MetaPublishError(
      error instanceof Error && error.name === "AbortError"
        ? "meta/timed-out"
        : "meta/provider-error",
      "Could not reach Meta"
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw mapMetaError(payload as MetaErrorPayload | null, response.status);
  }
  return payload as T;
}

function form(params: Record<string, string | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.set(key, value);
  }
  return body;
}

// ---------------------------------------------------------------- Instagram

export interface InstagramTokenResult {
  accessToken: string;
  /** Seconds until expiry, as Meta reports it. */
  expiresIn: number;
}

/**
 * Short-lived code → short-lived token. Separate host from the graph calls;
 * this one is form-encoded, not query-string.
 */
export async function exchangeInstagramCode(input: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUrl: string;
}): Promise<{ accessToken: string; userId: string }> {
  const payload = await graphRequest<{
    access_token?: string;
    user_id?: number | string;
  }>(IG_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_id: input.appId,
      client_secret: input.appSecret,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUrl,
      code: input.code,
    }),
  });

  if (!payload?.access_token || payload.user_id === undefined) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Instagram returned an incomplete token response"
    );
  }
  return {
    accessToken: payload.access_token,
    userId: String(payload.user_id),
  };
}

/** Short-lived (1 hour) → long-lived (60 days). */
export async function exchangeInstagramLongLivedToken(input: {
  shortLivedToken: string;
  appSecret: string;
}): Promise<InstagramTokenResult> {
  const url = new URL(`${IG_GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("access_token", input.shortLivedToken);

  const payload = await graphRequest<{
    access_token?: string;
    expires_in?: number;
  }>(url.toString());
  if (!payload?.access_token) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Instagram did not return a long-lived token"
    );
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 60 * 24 * 60 * 60,
  };
}

/** Extends a long-lived token by another 60 days. Requires age ≥ 24 hours. */
export async function refreshInstagramLongLivedToken(
  accessToken: string
): Promise<InstagramTokenResult> {
  const url = new URL(`${IG_GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const payload = await graphRequest<{
    access_token?: string;
    expires_in?: number;
  }>(url.toString());
  if (!payload?.access_token) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Instagram did not return a refreshed token"
    );
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 60 * 24 * 60 * 60,
  };
}

export async function fetchInstagramAccount(accessToken: string): Promise<{
  igUserId: string;
  username: string;
}> {
  const url = new URL(`${IG_GRAPH}/${GRAPH_VERSION}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);

  const payload = await graphRequest<{
    user_id?: string;
    id?: string;
    username?: string;
  }>(url.toString());
  const igUserId = payload?.user_id ?? payload?.id;
  if (!igUserId) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Instagram did not identify the account"
    );
  }
  return { igUserId: String(igUserId), username: payload?.username ?? "" };
}

export async function createInstagramContainer(input: {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrl: string;
  mediaType: "image" | "video";
}): Promise<string> {
  const payload = await graphRequest<{ id?: string }>(
    `${IG_GRAPH}/${GRAPH_VERSION}/${input.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        caption: input.caption,
        access_token: input.accessToken,
        ...(input.mediaType === "video"
          ? { media_type: "REELS", video_url: input.mediaUrl }
          : { image_url: input.mediaUrl }),
      }),
    }
  );
  if (!payload?.id) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Instagram did not return a media container"
    );
  }
  return payload.id;
}

export async function readInstagramContainerStatus(input: {
  containerId: string;
  accessToken: string;
}): Promise<string | undefined> {
  const url = new URL(`${IG_GRAPH}/${GRAPH_VERSION}/${input.containerId}`);
  url.searchParams.set("fields", "status_code");
  url.searchParams.set("access_token", input.accessToken);

  const payload = await graphRequest<{ status_code?: string }>(url.toString());
  return payload?.status_code;
}

export async function publishInstagramContainer(input: {
  igUserId: string;
  containerId: string;
  accessToken: string;
}): Promise<string> {
  const payload = await graphRequest<{ id?: string }>(
    `${IG_GRAPH}/${GRAPH_VERSION}/${input.igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        creation_id: input.containerId,
        access_token: input.accessToken,
      }),
    }
  );
  if (!payload?.id) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Instagram did not return the published media"
    );
  }
  return payload.id;
}

export async function readInstagramPermalink(input: {
  mediaId: string;
  accessToken: string;
}): Promise<string | null> {
  const url = new URL(`${IG_GRAPH}/${GRAPH_VERSION}/${input.mediaId}`);
  url.searchParams.set("fields", "permalink");
  url.searchParams.set("access_token", input.accessToken);

  try {
    const payload = await graphRequest<{ permalink?: string }>(url.toString());
    return payload?.permalink ?? null;
  } catch {
    // A missing permalink is cosmetic — the post is already live.
    return null;
  }
}

// ----------------------------------------------------------------- Facebook

export async function exchangeFacebookCode(input: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUrl: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${FB_GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("redirect_uri", input.redirectUrl);
  url.searchParams.set("code", input.code);

  const payload = await graphRequest<{
    access_token?: string;
    expires_in?: number;
  }>(url.toString());
  if (!payload?.access_token) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Facebook returned an incomplete token response"
    );
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 60 * 60,
  };
}

export async function exchangeFacebookLongLivedToken(input: {
  shortLivedToken: string;
  appId: string;
  appSecret: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${FB_GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("fb_exchange_token", input.shortLivedToken);

  const payload = await graphRequest<{
    access_token?: string;
    expires_in?: number;
  }>(url.toString());
  if (!payload?.access_token) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Facebook did not return a long-lived token"
    );
  }
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in ?? 60 * 24 * 60 * 60,
  };
}

/** The Pages this person administers, each with its own page access token. */
export async function listFacebookPages(userAccessToken: string): Promise<
  Array<{ id: string; name: string; accessToken: string }>
> {
  const url = new URL(`${FB_GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", userAccessToken);

  const payload = await graphRequest<{
    data?: Array<{ id?: string; name?: string; access_token?: string }>;
  }>(url.toString());

  return (payload?.data ?? []).flatMap((page) =>
    page.id && page.access_token
      ? [
          {
            id: page.id,
            name: page.name ?? page.id,
            accessToken: page.access_token,
          },
        ]
      : []
  );
}

/**
 * The permissions Meta actually granted, as opposed to the ones asked for.
 *
 * An empty Page list is ambiguous — it reads the same whether no Page was
 * shared or the token never carried `pages_show_list` to ask with, and those
 * two want opposite fixes. Graph reports declined permissions alongside
 * granted ones, so both are returned rather than filtered here.
 */
export async function listPermissionStatuses(
  userAccessToken: string
): Promise<Record<string, string>> {
  const url = new URL(`${FB_GRAPH}/me/permissions`);
  url.searchParams.set("access_token", userAccessToken);
  const payload = await graphRequest<{
    data?: { permission?: string; status?: string }[];
  }>(url.toString());

  const statuses: Record<string, string> = {};
  for (const entry of payload?.data ?? []) {
    if (entry.permission) statuses[entry.permission] = entry.status ?? "unknown";
  }
  return statuses;
}

/**
 * Hands the whole grant back to Meta, de-authorizing the app for this person.
 *
 * Meta — not this app — owns which Pages were shared, and it will not re-ask
 * while the app is still authorized: returning to the login dialog offers
 * "continue with your previous settings" and replays the original selection.
 * Revoking is what makes the next dialog a first-time one, which is the only
 * route back to Meta's own Page picker.
 */
export async function revokeFacebookPermissions(
  userAccessToken: string
): Promise<void> {
  const url = new URL(`${FB_GRAPH}/me/permissions`);
  url.searchParams.set("access_token", userAccessToken);
  await graphRequest<{ success?: boolean }>(url.toString(), {
    method: "DELETE",
  });
}

export async function publishFacebookPagePhoto(input: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<{ postId: string | null }> {
  const payload = await graphRequest<{ id?: string; post_id?: string }>(
    `${FB_GRAPH}/${input.pageId}/photos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        url: input.imageUrl,
        caption: input.caption,
        access_token: input.pageAccessToken,
      }),
    }
  );
  return { postId: payload?.post_id ?? payload?.id ?? null };
}

/**
 * Page video as a reel, in the three phases Meta documents for hosted media.
 * The middle phase is the odd one: the video URL travels as a REQUEST HEADER
 * on the upload host, not as a body parameter.
 */
export async function publishFacebookPageReel(input: {
  pageId: string;
  pageAccessToken: string;
  videoUrl: string;
  description: string;
}): Promise<{ postId: string | null }> {
  const start = await graphRequest<{ video_id?: string }>(
    `${FB_GRAPH}/${input.pageId}/video_reels`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        upload_phase: "start",
        access_token: input.pageAccessToken,
      }),
    }
  );
  const videoId = start?.video_id;
  if (!videoId) {
    throw new MetaPublishError(
      "meta/provider-error",
      "Facebook did not open an upload session"
    );
  }

  await graphRequest<{ success?: boolean }>(`${FB_RUPLOAD}/${videoId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${input.pageAccessToken}`,
      file_url: input.videoUrl,
    },
  });

  await graphRequest<{ success?: boolean }>(
    `${FB_GRAPH}/${input.pageId}/video_reels`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        upload_phase: "finish",
        video_id: videoId,
        video_state: "PUBLISHED",
        description: input.description,
        access_token: input.pageAccessToken,
      }),
    }
  );

  return { postId: videoId };
}

export async function readFacebookPermalink(input: {
  objectId: string;
  pageAccessToken: string;
}): Promise<string | null> {
  const url = new URL(`${FB_GRAPH}/${input.objectId}`);
  url.searchParams.set("fields", "permalink_url");
  url.searchParams.set("access_token", input.pageAccessToken);

  try {
    const payload = await graphRequest<{ permalink_url?: string }>(
      url.toString()
    );
    if (!payload?.permalink_url) return null;
    return payload.permalink_url.startsWith("http")
      ? payload.permalink_url
      : `https://www.facebook.com${payload.permalink_url}`;
  } catch {
    return null;
  }
}
