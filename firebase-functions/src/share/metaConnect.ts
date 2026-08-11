/**
 * Connecting a Meta account for PUBLISHING.
 *
 * Runs entirely beside the Instagram sign-in handshake in `../auth`, never
 * through it. Sign-in resolves an identity and mints a Firebase custom token;
 * this flow assumes the person is already signed in and only attaches a
 * publishing credential to their uid. Keeping them apart means a change here
 * can never lock anyone out of the app.
 *
 * What it shares with sign-in: the return-origin allowlist and the popup
 * callback page. What it does not share: state documents, tokens, and any
 * write to Firebase Auth.
 */

import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { isAllowedInstagramReturnOrigin } from "../auth/instagramAuthPolicy";
import { sendProviderCallbackPage } from "../auth/providerCallbackPage";
import {
  exchangeFacebookCode,
  exchangeFacebookLongLivedToken,
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramAccount,
  listFacebookPages,
} from "./metaGraphClient";
import {
  clearConnection,
  readConnections,
  selectFacebookPage,
  syncStatus,
  writeFacebookConnection,
  writeInstagramConnection,
  type MetaConnectionTarget,
} from "./metaConnectionStore";
import {
  claimMetaConnectState,
  createMetaConnectState,
  getMetaConnectState,
  isMetaConnectStateId,
  markMetaConnectComplete,
  markMetaConnectError,
  MetaConnectError,
  metaConnectFailureMessage,
  type MetaConnectFailureCode,
} from "./metaConnectStateStore";
import * as admin from "firebase-admin";

const instagramAppId = defineSecret("INSTAGRAM_APP_ID");
const instagramAppSecret = defineSecret("INSTAGRAM_APP_SECRET");
const facebookAppId = defineSecret("FACEBOOK_APP_ID");
const facebookAppSecret = defineSecret("FACEBOOK_APP_SECRET");

const CONNECT_SECRETS = [
  instagramAppId,
  instagramAppSecret,
  facebookAppId,
  facebookAppSecret,
];

export const META_CONNECT_CALLBACK_URL =
  "https://tkaflowarts.com/api/share/meta/callback";

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const FACEBOOK_AUTHORIZE_URL = "https://www.facebook.com/v23.0/dialog/oauth";

/**
 * `instagram_business_content_publish` is the scope Meta app review gates. The
 * basic scope stays in the list because the flow reads the account's username
 * to label the connection.
 */
const INSTAGRAM_PUBLISH_SCOPE =
  "instagram_business_basic,instagram_business_content_publish";

/**
 * Facebook names its permission set in the dashboard, not in the URL.
 *
 * The publishing app is `type: Business`, and the only login product such an
 * app can add is Facebook Login for Business, where `config_id` replaced
 * `scope` outright. The permissions live in the app's "Page posting"
 * configuration and are, in order: `pages_show_list`, `pages_read_engagement`,
 * `pages_manage_posts`, `publish_video` — `publish_video` being separate from
 * `pages_manage_posts` and what a Page reel needs. Editing that list is a
 * dashboard action; this constant only points at it.
 */
const FACEBOOK_LOGIN_CONFIG_ID = "1026384010306248";

function configuredSecret(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpsError("failed-precondition", "Posting is not configured", {
      reason: "meta/not-configured",
      missing: name,
    });
  }
  return trimmed;
}

function requireSignedInCaller(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to connect an account", {
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
  throw new HttpsError("invalid-argument", "Unknown connection target", {
    reason: "meta/target-invalid",
  });
}

function stringQueryValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function publicFailureCode(error: unknown): MetaConnectFailureCode {
  return error instanceof MetaConnectError ? error.code : "meta/provider-error";
}

export const startMetaConnect = onCall(
  { secrets: CONNECT_SECRETS },
  async (request) => {
    const uid = requireSignedInCaller(request);
    const target = parseTarget(request.data?.target);

    const returnOrigin =
      typeof request.data?.returnOrigin === "string"
        ? request.data.returnOrigin
        : "";
    if (!isAllowedInstagramReturnOrigin(returnOrigin)) {
      throw new HttpsError("invalid-argument", "Return origin is not allowed", {
        reason: "meta/origin-not-allowed",
      });
    }

    const { state, expiresAtMs } = await createMetaConnectState({
      requesterUid: uid,
      target,
      returnOrigin,
    });

    const authorizationUrl =
      target === "instagram"
        ? buildAuthorizeUrl({
            base: INSTAGRAM_AUTHORIZE_URL,
            clientId: configuredSecret(
              instagramAppId.value(),
              "INSTAGRAM_APP_ID"
            ),
            grant: { kind: "scope", scope: INSTAGRAM_PUBLISH_SCOPE },
            state,
          })
        : buildAuthorizeUrl({
            base: FACEBOOK_AUTHORIZE_URL,
            clientId: configuredSecret(
              facebookAppId.value(),
              "FACEBOOK_APP_ID"
            ),
            grant: { kind: "config", configId: FACEBOOK_LOGIN_CONFIG_ID },
            state,
          });

    return { authorizationUrl, state, expiresAtMs };
  }
);

/**
 * How the two providers name the permissions they are being asked for. They do
 * not accept each other's form: Instagram business login takes a raw scope
 * list, and Facebook Login for Business rejects `scope` in favour of a
 * configuration id.
 */
type AuthorizeGrant =
  | { kind: "scope"; scope: string }
  | { kind: "config"; configId: string };

function buildAuthorizeUrl(input: {
  base: string;
  clientId: string;
  grant: AuthorizeGrant;
  state: string;
}): string {
  const url = new URL(input.base);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", META_CONNECT_CALLBACK_URL);
  url.searchParams.set("response_type", "code");
  if (input.grant.kind === "config") {
    url.searchParams.set("config_id", input.grant.configId);
    // A configuration carries its own default response type, and for a
    // user-token configuration that default is a token handed to the browser.
    // This flow exchanges a code server-side, so the request has to say so.
    url.searchParams.set("override_default_response_type", "true");
  } else {
    url.searchParams.set("scope", input.grant.scope);
  }
  url.searchParams.set("state", input.state);
  return url.toString();
}

export const metaConnectCallback = onRequest(
  { secrets: CONNECT_SECRETS, cors: false },
  async (request, response) => {
    if (request.method !== "GET") {
      response.set("Allow", "GET").status(405).send("Method not allowed");
      return;
    }

    const stateValue = stringQueryValue(request.query.state);
    let claimed: Awaited<ReturnType<typeof claimMetaConnectState>> | undefined;

    try {
      claimed = await claimMetaConnectState(stateValue);

      const providerError = stringQueryValue(request.query.error);
      if (providerError) {
        throw new MetaConnectError(
          providerError === "access_denied"
            ? "meta/cancelled"
            : "meta/provider-error"
        );
      }

      const code = stringQueryValue(request.query.code);
      if (!code || code.length > 4096) {
        throw new MetaConnectError("meta/provider-error");
      }

      const accountName =
        claimed.data.target === "instagram"
          ? await connectInstagram(claimed.data.requesterUid, code)
          : await connectFacebookPage(claimed.data.requesterUid, code);

      await markMetaConnectComplete(claimed.ref, accountName);
      sendProviderCallbackPage(response, {
        messageType: "tka:meta-connect",
        title: "Account connected",
        returnOrigin: claimed.data.returnOrigin,
        state: stateValue,
        status: "complete",
        message: "Return to TKA — you can post from the share sheet now.",
      });
    } catch (error) {
      const code = publicFailureCode(error);
      if (claimed) {
        await markMetaConnectError(claimed.ref, code).catch((writeError) => {
          functions.logger.error("Could not record Meta connect failure", {
            code,
            error: writeError instanceof Error ? writeError.name : "unknown",
          });
        });
      }
      functions.logger.warn("Meta publish connect did not complete", { code });
      sendProviderCallbackPage(
        response,
        {
          messageType: "tka:meta-connect",
          title: "Connection failed",
          returnOrigin: claimed?.data.returnOrigin,
          state: isMetaConnectStateId(stateValue) ? stateValue : undefined,
          status: "error",
          message: metaConnectFailureMessage(code),
        },
        claimed ? 200 : 400
      );
    }
  }
);

async function connectInstagram(uid: string, code: string): Promise<string> {
  const appSecret = configuredSecret(
    instagramAppSecret.value(),
    "INSTAGRAM_APP_SECRET"
  );
  const shortLived = await exchangeInstagramCode({
    code,
    appId: configuredSecret(instagramAppId.value(), "INSTAGRAM_APP_ID"),
    appSecret,
    redirectUrl: META_CONNECT_CALLBACK_URL,
  });
  const longLived = await exchangeInstagramLongLivedToken({
    shortLivedToken: shortLived.accessToken,
    appSecret,
  });
  const account = await fetchInstagramAccount(longLived.accessToken);

  const now = Date.now();
  await writeInstagramConnection(uid, {
    igUserId: account.igUserId || shortLived.userId,
    username: account.username,
    accessToken: longLived.accessToken,
    issuedAt: admin.firestore.Timestamp.fromMillis(now),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      now + longLived.expiresIn * 1000
    ),
    connectedAt: admin.firestore.Timestamp.fromMillis(now),
  });

  return account.username || "Instagram";
}

async function connectFacebookPage(uid: string, code: string): Promise<string> {
  const appId = configuredSecret(facebookAppId.value(), "FACEBOOK_APP_ID");
  const appSecret = configuredSecret(
    facebookAppSecret.value(),
    "FACEBOOK_APP_SECRET"
  );

  const shortLived = await exchangeFacebookCode({
    code,
    appId,
    appSecret,
    redirectUrl: META_CONNECT_CALLBACK_URL,
  });
  const longLived = await exchangeFacebookLongLivedToken({
    shortLivedToken: shortLived.accessToken,
    appId,
    appSecret,
  });
  const pages = await listFacebookPages(longLived.accessToken);
  if (pages.length === 0) {
    throw new MetaConnectError("meta/no-pages");
  }

  // Keep whichever Page was already selected if this is a reconnect, so
  // re-authorizing does not silently retarget a week of posts.
  //
  // With no prior selection there is nothing to keep, and picking the first
  // Page Meta happens to return is a decision wearing a default's clothing:
  // whoever connects gets whichever Page sorts first, never having been asked.
  // An empty id means "not chosen yet" — the sheet asks, and publishing
  // refuses until it has an answer. One Page is not a decision, so it stands.
  const existing = await readConnections(uid);
  const previous = existing.facebookPage?.selectedPageId;
  const selectedPageId =
    previous && pages.some((page) => page.id === previous)
      ? previous
      : pages.length === 1
        ? pages[0].id
        : "";

  const now = Date.now();
  await writeFacebookConnection(uid, {
    userAccessToken: longLived.accessToken,
    issuedAt: admin.firestore.Timestamp.fromMillis(now),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      now + longLived.expiresIn * 1000
    ),
    connectedAt: admin.firestore.Timestamp.fromMillis(now),
    pages,
    selectedPageId,
  });

  return (
    pages.find((page) => page.id === selectedPageId)?.name ?? "Facebook Page"
  );
}

/** Polled by the client after the popup reports back, mirroring the sign-in
 *  handshake's completion step. */
export const completeMetaConnect = onCall(async (request) => {
  const uid = requireSignedInCaller(request);
  const state =
    typeof request.data?.state === "string" ? request.data.state : "";
  if (!isMetaConnectStateId(state)) {
    throw new HttpsError("invalid-argument", "Invalid connection state", {
      reason: "meta/state-invalid",
    });
  }

  const stored = await getMetaConnectState(state);
  if (!stored.data) {
    throw new HttpsError("not-found", "Connection state was not found", {
      reason: "meta/state-invalid",
    });
  }
  if (stored.data.requesterUid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "That connection belongs to another session",
      { reason: "meta/state-invalid" }
    );
  }
  if (stored.data.expiresAt.toMillis() <= Date.now()) {
    return { status: "error" as const, errorCode: "meta/state-expired" };
  }
  if (stored.data.status === "error") {
    return {
      status: "error" as const,
      errorCode: stored.data.errorCode ?? "meta/provider-error",
    };
  }
  if (stored.data.status !== "complete") {
    return { status: "pending" as const };
  }

  return {
    status: "complete" as const,
    target: stored.data.target,
    accountName: stored.data.accountName ?? "",
  };
});

export const disconnectMetaAccount = onCall(async (request) => {
  const uid = requireSignedInCaller(request);
  const target = parseTarget(request.data?.target);
  await clearConnection(uid, target);
  return { disconnected: true };
});

export const selectMetaFacebookPage = onCall(async (request) => {
  const uid = requireSignedInCaller(request);
  const pageId =
    typeof request.data?.pageId === "string" ? request.data.pageId : "";
  const selected = await selectFacebookPage(uid, pageId);
  if (!selected) {
    throw new HttpsError("not-found", "That Page is not connected", {
      reason: "meta/page-unknown",
    });
  }
  return { selected: true };
});

/** Rebuilds the client-readable mirror. Cheap repair path for a status doc
 *  that predates a schema change or was never written. */
export const refreshMetaPublishStatus = onCall(async (request) => {
  const uid = requireSignedInCaller(request);
  return await syncStatus(uid);
});
