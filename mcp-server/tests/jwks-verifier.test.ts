import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

import { createJwksVerifier } from "../src/http/jwks-verifier.js";

const ISSUER = "https://as.example.com";
const AUDIENCE = "https://mcp.example.com/mcp";

let signingKey: CryptoKey;
let publicJwk: JWK;
let otherKey: CryptoKey;

beforeAll(async () => {
	const pair = await generateKeyPair("RS256", { extractable: true });
	signingKey = pair.privateKey;
	publicJwk = await exportJWK(pair.publicKey);
	publicJwk.alg = "RS256";
	otherKey = (await generateKeyPair("RS256", { extractable: true })).privateKey;
});

async function mint(
	overrides: {
		aud?: string;
		iss?: string;
		exp?: string | number;
		scope?: string;
		sub?: string;
		clientId?: string;
		key?: CryptoKey;
		alg?: string;
	} = {},
) {
	const jwt = new SignJWT({
		scope: overrides.scope ?? "mcp:use",
		client_id: overrides.clientId ?? "claude-ai",
	})
		.setProtectedHeader({ alg: overrides.alg ?? "RS256" })
		.setIssuer(overrides.iss ?? ISSUER)
		.setAudience(overrides.aud ?? AUDIENCE)
		.setSubject(overrides.sub ?? "user-123")
		.setIssuedAt()
		.setExpirationTime(overrides.exp ?? "5m");
	return jwt.sign(overrides.key ?? signingKey);
}

function verifier(overrides: Partial<Parameters<typeof createJwksVerifier>[0]> = {}) {
	return createJwksVerifier({
		issuer: ISSUER,
		audience: AUDIENCE,
		keyResolver: async () => publicJwk,
		...overrides,
	});
}

describe("createJwksVerifier", () => {
	it("accepts a valid token and reports its full principal", async () => {
		const info = await verifier().verifyAccessToken(await mint());
		expect(info.scopes).toContain("mcp:use");
		expect(info.resource?.href).toBe(AUDIENCE);
		expect(info.extra?.sub).toBe("user-123");
		expect(typeof info.expiresAt).toBe("number");
	});

	it("reports the OAuth client id in clientId, not the subject", async () => {
		// Audit round 2, finding 8: the SDK defines clientId as the OAuth client
		// identifier. Writing `sub` into it collides tokens from different
		// clients and breaks under pairwise subject identifiers.
		const info = await verifier().verifyAccessToken(await mint({ sub: "user-123", clientId: "claude-ai" }));
		expect(info.clientId).toBe("claude-ai");
		expect(info.extra?.sub).toBe("user-123");
	});

	it("REJECTS a token minted for a different audience", async () => {
		await expect(verifier().verifyAccessToken(await mint({ aud: "https://other-api.example.com" }))).rejects.toThrow(
			InvalidTokenError,
		);
	});

	it("REJECTS a token from a different issuer", async () => {
		await expect(verifier().verifyAccessToken(await mint({ iss: "https://evil.example.com" }))).rejects.toThrow(
			InvalidTokenError,
		);
	});

	it("compares the issuer exactly, without normalizing a trailing slash", async () => {
		// A verifier configured for the slashed form must accept the slashed
		// form — and one configured without it must not silently accept it.
		const slashed = verifier({ issuer: "https://as.example.com/" });
		await expect(slashed.verifyAccessToken(await mint({ iss: "https://as.example.com/" }))).resolves.toBeTruthy();
		await expect(slashed.verifyAccessToken(await mint({ iss: "https://as.example.com" }))).rejects.toThrow(
			InvalidTokenError,
		);
	});

	it("accepts a mapped audience that differs from the resource URL", async () => {
		const mapped = verifier({ audience: "api://tka-mcp", resource: new URL(AUDIENCE) });
		const info = await mapped.verifyAccessToken(await mint({ aud: "api://tka-mcp" }));
		// resource stays the RFC 9728 identifier even when the audience differs.
		expect(info.resource?.href).toBe(AUDIENCE);
	});

	it("rejects an expired token", async () => {
		await expect(
			verifier().verifyAccessToken(await mint({ exp: Math.floor(Date.now() / 1000) - 60 })),
		).rejects.toThrow(InvalidTokenError);
	});

	it("rejects a token signed by the wrong key", async () => {
		await expect(verifier().verifyAccessToken(await mint({ key: otherKey }))).rejects.toThrow(InvalidTokenError);
	});

	it("rejects a structurally invalid token", async () => {
		await expect(verifier().verifyAccessToken("not.a.jwt")).rejects.toThrow(InvalidTokenError);
	});

	it("rejects an algorithm outside the configured allowlist", async () => {
		// Audit round 2, finding 5: without an application-selected algorithm
		// set, any algorithm the key happens to support is accepted. RFC 8725
		// requires the application to choose.
		const rs512 = await generateKeyPair("RS512", { extractable: true });
		const jwk = await exportJWK(rs512.publicKey);
		jwk.alg = "RS512";
		const v = createJwksVerifier({
			issuer: ISSUER,
			audience: AUDIENCE,
			algorithms: ["RS256"],
			keyResolver: async () => jwk,
		});
		const token = await new SignJWT({ scope: "mcp:use", client_id: "c" })
			.setProtectedHeader({ alg: "RS512" })
			.setIssuer(ISSUER)
			.setAudience(AUDIENCE)
			.setSubject("user-123")
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(rs512.privateKey);
		await expect(v.verifyAccessToken(token)).rejects.toThrow(InvalidTokenError);
	});

	it("rejects a token with no subject", async () => {
		const token = await new SignJWT({ scope: "mcp:use", client_id: "c" })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(ISSUER)
			.setAudience(AUDIENCE)
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(signingKey);
		await expect(verifier().verifyAccessToken(token)).rejects.toThrow(InvalidTokenError);
	});

	it("throws InvalidTokenError, never a plain Error", async () => {
		// Only InvalidTokenError maps to 401 in the SDK middleware; a plain Error
		// surfaces as a 500 with no challenge.
		await expect(verifier().verifyAccessToken("garbage")).rejects.toBeInstanceOf(InvalidTokenError);
	});

	it("produces a header-safe error message", async () => {
		// Audit round 2, finding 12: the SDK interpolates the message into a
		// quoted WWW-Authenticate value without escaping, and a raw jose message
		// ('unexpected "aud" claim value') contains quotes that break the header.
		let message = "";
		try {
			await verifier().verifyAccessToken(await mint({ aud: "https://wrong.example.com" }));
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).not.toContain('"');
		expect(message).not.toContain("\\");
		expect(message).toBe("The access token is invalid");
	});

	it("returns an empty scope list when the token carries no scope claim", async () => {
		const info = await verifier().verifyAccessToken(await mint({ scope: "" }));
		expect(info.scopes).toEqual([]);
	});
});
