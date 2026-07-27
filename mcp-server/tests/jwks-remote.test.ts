import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

import { createJwksVerifier } from "../src/http/jwks-verifier.js";

// The other verifier tests inject a key directly, which never exercises
// createRemoteJWKSet — the code path production actually uses. This one stands
// up a real JWKS endpoint over HTTP and fetches from it.

const AUDIENCE = "https://mcp.example.com/mcp";

let server: Server;
let issuer: string;
let jwksUri: URL;
let signingKey: CryptoKey;
let otherKey: CryptoKey;
let jwksRequests = 0;

beforeAll(async () => {
	const pair = await generateKeyPair("RS256", { extractable: true });
	signingKey = pair.privateKey;
	otherKey = (await generateKeyPair("RS256", { extractable: true })).privateKey;

	const jwk = await exportJWK(pair.publicKey);
	jwk.alg = "RS256";
	jwk.kid = "test-key-1";
	const body = JSON.stringify({ keys: [jwk] });

	server = createServer((req, res) => {
		if (req.url === "/.well-known/jwks.json") {
			jwksRequests++;
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(body);
			return;
		}
		res.writeHead(404);
		res.end();
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	issuer = `http://127.0.0.1:${port}`;
	jwksUri = new URL(`${issuer}/.well-known/jwks.json`);
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function mint(overrides: { aud?: string; key?: CryptoKey } = {}) {
	return new SignJWT({ scope: "mcp:use", client_id: "claude-ai" })
		.setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
		.setIssuer(issuer)
		.setAudience(overrides.aud ?? AUDIENCE)
		.setSubject("user-123")
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(overrides.key ?? signingKey);
}

function verifier() {
	return createJwksVerifier({ issuer, audience: AUDIENCE, jwksUri });
}

describe("createJwksVerifier against a real JWKS endpoint", () => {
	it("fetches the key set and accepts a correctly signed token", async () => {
		const info = await verifier().verifyAccessToken(await mint());
		expect(info.clientId).toBe("claude-ai");
		expect(info.extra?.sub).toBe("user-123");
		expect(jwksRequests).toBeGreaterThan(0);
	});

	it("rejects a wrong-audience token fetched against the same key set", async () => {
		await expect(verifier().verifyAccessToken(await mint({ aud: "https://other.example.com" }))).rejects.toThrow(
			InvalidTokenError,
		);
	});

	it("rejects a token signed by a key the endpoint does not publish", async () => {
		await expect(verifier().verifyAccessToken(await mint({ key: otherKey }))).rejects.toThrow(InvalidTokenError);
	});

	it("caches the key set instead of refetching per verification", async () => {
		const v = verifier();
		await v.verifyAccessToken(await mint());
		const after = jwksRequests;
		await v.verifyAccessToken(await mint());
		await v.verifyAccessToken(await mint());
		// Same kid every time, so no refetch is warranted.
		expect(jwksRequests).toBe(after);
	});

	it("reports an unreachable key set as an invalid token, not a crash", async () => {
		const unreachable = createJwksVerifier({
			issuer,
			audience: AUDIENCE,
			jwksUri: new URL("http://127.0.0.1:1/.well-known/jwks.json"),
		});
		await expect(unreachable.verifyAccessToken(await mint())).rejects.toThrow(InvalidTokenError);
	});
});
