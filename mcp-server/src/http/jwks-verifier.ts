/**
 * Local JWT validation against the authorization server's JWKS.
 *
 * Chosen over RFC 7662 introspection because introspection needs authenticated,
 * vendor-specific credentials and turns every invalid token into an outbound
 * request. Verification here is in-process; `jose` caches the key set.
 *
 * IMPORTANT: `requireBearerAuth` checks scopes and expiry but does NOT compare
 * AuthInfo.resource to anything. Audience enforcement happens HERE or nowhere.
 */

import { createRemoteJWKSet, jwtVerify, type JWK, type JWTPayload } from "jose";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

/**
 * The SDK interpolates an error message into a quoted WWW-Authenticate value
 * without escaping it, and jose's messages contain quotes ('unexpected "aud"
 * claim value'), which produces a malformed header exactly when a client most
 * needs to parse one. Clients get this constant; the real reason is logged.
 */
const CLIENT_SAFE_MESSAGE = "The access token is invalid";

/** Asymmetric only. An application must choose its own set (RFC 8725). */
export const DEFAULT_ALGORITHMS = ["RS256", "RS384", "RS512", "ES256", "ES384", "PS256"];

export type JwksVerifierOptions = {
	/** Compared byte-for-byte against `iss`. Never normalized. */
	issuer: string;
	/** Expected `aud`. May differ from the resource identifier (RFC 8707). */
	audience: string;
	/** The RFC 9728 resource identifier reported on AuthInfo. Defaults to `audience` if it parses. */
	resource?: URL;
	algorithms?: string[];
	jwksUri?: URL;
	/** Test seam: supply a key directly instead of fetching a remote key set. */
	keyResolver?: () => Promise<JWK>;
	onError?: (error: unknown) => void;
};

function scopesOf(payload: JWTPayload): string[] {
	const raw = payload.scope;
	if (typeof raw !== "string" || raw.trim() === "") return [];
	return raw.split(" ").filter(Boolean);
}

function resourceOf(options: JwksVerifierOptions): URL | undefined {
	if (options.resource) return options.resource;
	try {
		return new URL(options.audience);
	} catch {
		// A mapped audience such as `api://tka-mcp` is not a URL. That is fine —
		// AuthInfo.resource is optional.
		return undefined;
	}
}

export function createJwksVerifier(options: JwksVerifierOptions): OAuthTokenVerifier {
	const { issuer, audience, jwksUri, keyResolver, onError } = options;
	const algorithms = options.algorithms ?? DEFAULT_ALGORITHMS;
	const resource = resourceOf(options);

	if (!keyResolver && !jwksUri) {
		throw new Error("[MCP] createJwksVerifier requires either jwksUri or keyResolver");
	}

	// createRemoteJWKSet caches and refetches on an unknown kid, so this is one
	// fetch amortised across requests rather than a per-request call.
	const remoteKeySet = jwksUri ? createRemoteJWKSet(jwksUri) : undefined;

	return {
		async verifyAccessToken(token: string): Promise<AuthInfo> {
			try {
				const claims = { issuer, audience, algorithms };
				// Branch rather than union-and-cast: each overload of jwtVerify is
				// then actually type-checked.
				const { payload } = keyResolver
					? await jwtVerify(token, await keyResolver(), claims)
					: await jwtVerify(token, remoteKeySet!, claims);

				if (typeof payload.exp !== "number") {
					throw new InvalidTokenError(CLIENT_SAFE_MESSAGE);
				}
				const sub = typeof payload.sub === "string" ? payload.sub : undefined;
				if (!sub) {
					throw new InvalidTokenError(CLIENT_SAFE_MESSAGE);
				}

				// clientId is the OAuth CLIENT identifier per the SDK's own type.
				// The subject is a different thing and is kept separately.
				const clientId = typeof payload.client_id === "string" ? payload.client_id : sub;

				return {
					token,
					clientId,
					scopes: scopesOf(payload),
					expiresAt: payload.exp,
					resource,
					extra: { sub, iss: payload.iss },
				};
			} catch (error) {
				if (error instanceof InvalidTokenError) throw error;
				onError?.(error);
				throw new InvalidTokenError(CLIENT_SAFE_MESSAGE);
			}
		},
	};
}
