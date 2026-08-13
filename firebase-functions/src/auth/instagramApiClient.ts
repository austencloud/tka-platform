import * as functions from "firebase-functions";
import {
  InstagramAuthPolicyError,
  parseInstagramTokenResponse,
} from "./instagramAuthPolicy";

const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_PROFILE_URL =
  "https://graph.instagram.com/me?fields=id,username,name,account_type,profile_picture_url";

export interface InstagramProfile {
  username?: string;
  name?: string;
  accountType?: string;
  profilePictureUrl?: string;
}

export async function exchangeInstagramAuthorizationCode(input: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUrl: string;
}): Promise<{ accessToken: string; userId: string }> {
  const form = new FormData();
  form.set("client_id", input.appId);
  form.set("client_secret", input.appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", input.redirectUrl);
  form.set("code", input.code);

  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const responseText = await response.text();
  if (!response.ok) {
    functions.logger.warn("Instagram token exchange was rejected", {
      httpStatus: response.status,
      requestId: response.headers.get("x-fb-request-id"),
      body: responseText.slice(0, 600),
    });
    const professionalAccountRequired = /professional|business|creator/i.test(
      responseText
    );
    throw new InstagramAuthPolicyError(
      professionalAccountRequired
        ? "instagram/account-type-required"
        : "instagram/provider-error"
    );
  }

  return parseInstagramTokenResponse(responseText);
}

function safeProfileString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

export async function fetchInstagramProfile(
  accessToken: string
): Promise<InstagramProfile> {
  try {
    const response = await fetch(INSTAGRAM_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      functions.logger.warn(
        "Instagram profile lookup failed after OAuth exchange",
        {
          status: response.status,
          requestId: response.headers.get("x-fb-request-id"),
        }
      );
      return {};
    }

    const value = (await response.json()) as Record<string, unknown>;
    const picture = safeProfileString(value.profile_picture_url, 2048);
    return {
      username: safeProfileString(value.username, 30),
      name: safeProfileString(value.name, 120),
      accountType: safeProfileString(value.account_type, 40),
      profilePictureUrl:
        picture && picture.startsWith("https://") ? picture : undefined,
    };
  } catch (error) {
    functions.logger.warn("Instagram profile lookup did not complete", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return {};
  }
}
