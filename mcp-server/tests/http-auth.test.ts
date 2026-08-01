import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import { createHttpApp, type HttpApp } from "../src/http/create-http-app.js";
import type { AuthConfig } from "../src/http/auth-config.js";

const config: AuthConfig = {
	issuer: "https://as.example.com",
	resourceUrl: new URL("https://mcp.example.com/mcp"),
	audience: "https://mcp.example.com/mcp",
	jwksUri: new URL("https://as.example.com/.well-known/jwks.json"),
	requiredScope: "mcp:use",
	tokenHeader: "authorization",
	allowedHosts: ["mcp.example.com", "localhost", "127.0.0.1"],
};

const USER_A = "token-a";
const USER_B = "token-b";
const NO_SCOPE = "token-no-scope";

let constructed = 0;
let harness: HttpApp;

const verifier = {
	async verifyAccessToken(token: string): Promise<AuthInfo> {
		const base = {
			token,
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
			resource: config.resourceUrl,
		};
		if (token === USER_A) {
			return { ...base, clientId: "claude-ai", scopes: ["mcp:use"], extra: { sub: "user-a", iss: config.issuer } };
		}
		if (token === USER_B) {
			return { ...base, clientId: "claude-ai", scopes: ["mcp:use"], extra: { sub: "user-b", iss: config.issuer } };
		}
		if (token === NO_SCOPE) {
			return { ...base, clientId: "claude-ai", scopes: [], extra: { sub: "user-a", iss: config.issuer } };
		}
		throw new InvalidTokenError("The access token is invalid");
	},
};

function build() {
	constructed = 0;
	harness = createHttpApp({
		config,
		verifier,
		createMcpServer: () => new McpServer({ name: "test", version: "0.0.0" }),
		onServerConstructed: () => {
			constructed++;
		},
		sweep: false,
	});
	return harness.app;
}

const INITIALIZE = {
	jsonrpc: "2.0" as const,
	method: "initialize",
	id: 1,
	params: {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "test", version: "0.0.0" },
	},
};

const ACCEPT = "application/json, text/event-stream";

beforeEach(() => {
	build();
});

afterEach(async () => {
	await harness?.shutdown();
});

describe("health and discovery", () => {
	it("answers the health probe install-service.ps1 depends on", async () => {
		const res = await request(harness.app).get("/");
		expect(res.status).toBe(200);
	});

	it("SERVES metadata at the RFC 9728 path including the resource path", async () => {
		// Audit round 2, finding 1: metadataHandler returns an express.Router
		// whose route is "/", so app.get(path, router) never matched and this
		// returned 404 — with the WWW-Authenticate challenge pointing at it.
		const res = await request(harness.app).get("/.well-known/oauth-protected-resource/mcp");
		expect(res.status).toBe(200);
		expect(res.body.resource).toBe("https://mcp.example.com/mcp");
		expect(res.body.authorization_servers).toEqual(["https://as.example.com"]);
	});

	it("advertises the required scope", async () => {
		const res = await request(harness.app).get("/.well-known/oauth-protected-resource/mcp");
		expect(res.body.scopes_supported).toEqual(["mcp:use"]);
	});

	it("also answers the bare well-known path", async () => {
		expect((await request(harness.app).get("/.well-known/oauth-protected-resource")).status).toBe(200);
	});

	it("allows a cross-origin preflight on metadata", async () => {
		// The SDK handler brings its own public CORS; a browser client must be
		// able to read discovery from any origin.
		const res = await request(harness.app)
			.options("/.well-known/oauth-protected-resource/mcp")
			.set("Origin", "https://anywhere.example.com");
		expect(res.status).toBeLessThan(300);
	});
});

describe("proxy-terminated auth (Cloudflare Access)", () => {
	// The live deployment runs in this mode: Access resolves the client's opaque
	// token and hands the origin a verifiable JWT on its own header, so a server
	// that only reads Authorization 401s every authenticated request.
	function buildProxied() {
		return createHttpApp({
			config: { ...config, requiredScope: "", tokenHeader: "cf-access-jwt-assertion" },
			verifier,
			createMcpServer: () => new McpServer({ name: "test", version: "0.0.0" }),
			sweep: false,
		});
	}

	let proxied: HttpApp;
	beforeEach(() => {
		proxied = buildProxied();
	});
	afterEach(async () => {
		await proxied?.shutdown();
	});

	it("accepts a token on the configured header", async () => {
		const res = await request(proxied.app)
			.post("/mcp")
			.set("Accept", ACCEPT)
			.set("Cf-Access-Jwt-Assertion", NO_SCOPE)
			.send(INITIALIZE);
		expect(res.status).toBe(200);
	});

	it("still rejects a caller that presents no token at all", async () => {
		const res = await request(proxied.app).post("/mcp").set("Accept", ACCEPT).send(INITIALIZE);
		expect(res.status).toBe(401);
	});

	it("still rejects an invalid token on that header", async () => {
		const res = await request(proxied.app)
			.post("/mcp")
			.set("Accept", ACCEPT)
			.set("Cf-Access-Jwt-Assertion", "forged")
			.send(INITIALIZE);
		expect(res.status).toBe(401);
	});

	it("publishes no scopes_supported when the AS issues none", async () => {
		const res = await request(proxied.app).get("/.well-known/oauth-protected-resource/mcp");
		expect(res.body.scopes_supported).toBeUndefined();
	});
});

describe("rejecting unauthenticated callers", () => {
	it("rejects a POST with no Authorization header", async () => {
		const res = await request(harness.app).post("/mcp").set("Accept", ACCEPT).send(INITIALIZE);
		expect(res.status).toBe(401);
	});

	it("CONSTRUCTS NOTHING for an unauthenticated caller", async () => {
		await request(harness.app).post("/mcp").set("Accept", ACCEPT).send(INITIALIZE);
		expect(constructed).toBe(0);
		expect(harness.sessionCount()).toBe(0);
	});

	it("returns 401, not 500, for a bad token", async () => {
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", "Bearer nope")
			.set("Accept", ACCEPT)
			.send(INITIALIZE);
		expect(res.status).toBe(401);
	});

	it("challenges with the metadata URL so a client can discover the AS", async () => {
		const res = await request(harness.app).post("/mcp").set("Accept", ACCEPT).send(INITIALIZE);
		expect(res.headers["www-authenticate"]).toContain(
			"https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
		);
	});

	it("rejects a valid token that lacks the required scope", async () => {
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", `Bearer ${NO_SCOPE}`)
			.set("Accept", ACCEPT)
			.send(INITIALIZE);
		expect(res.status).toBe(403);
		expect(constructed).toBe(0);
	});
});

describe("session lifecycle", () => {
	async function openSession(token: string) {
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", `Bearer ${token}`)
			.set("Accept", ACCEPT)
			.send(INITIALIZE);
		return res;
	}

	it("lets a valid token initialize and constructs exactly one server", async () => {
		const res = await openSession(USER_A);
		expect(res.status).toBe(200);
		expect(res.headers["mcp-session-id"]).toBeTruthy();
		expect(constructed).toBe(1);
		expect(harness.sessionCount()).toBe(1);
	});

	it("lets the SAME principal reuse its session", async () => {
		const first = await openSession(USER_A);
		const sessionId = first.headers["mcp-session-id"];
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", `Bearer ${USER_A}`)
			.set("mcp-session-id", sessionId)
			.set("Accept", ACCEPT)
			.send({ jsonrpc: "2.0", method: "ping", id: 2 });
		expect(res.status).toBeLessThan(400);
		expect(constructed).toBe(1);
	});

	it("refuses a session id presented by a DIFFERENT principal", async () => {
		const first = await openSession(USER_A);
		const sessionId = first.headers["mcp-session-id"];
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", `Bearer ${USER_B}`)
			.set("mcp-session-id", sessionId)
			.set("Accept", ACCEPT)
			.send({ jsonrpc: "2.0", method: "ping", id: 2 });
		expect(res.status).toBe(403);
	});

	it("404s an unknown session rather than opening a new one", async () => {
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", `Bearer ${USER_A}`)
			.set("mcp-session-id", "does-not-exist")
			.set("Accept", ACCEPT)
			.send({ jsonrpc: "2.0", method: "ping", id: 2 });
		expect(res.status).toBe(404);
		expect(constructed).toBe(0);
	});

	it("refuses to open a session for a non-initialize body", async () => {
		// Otherwise any authenticated caller can force server construction with
		// an arbitrary payload.
		const res = await request(harness.app)
			.post("/mcp")
			.set("Authorization", `Bearer ${USER_A}`)
			.set("Accept", ACCEPT)
			.send({ jsonrpc: "2.0", method: "ping", id: 9 });
		expect(res.status).toBe(400);
		expect(constructed).toBe(0);
		expect(harness.sessionCount()).toBe(0);
	});

	it("releases the session on DELETE", async () => {
		const first = await openSession(USER_A);
		const sessionId = first.headers["mcp-session-id"];
		expect(harness.sessionCount()).toBe(1);

		await request(harness.app)
			.delete("/mcp")
			.set("Authorization", `Bearer ${USER_A}`)
			.set("mcp-session-id", sessionId)
			.set("Accept", ACCEPT);

		expect(harness.sessionCount()).toBe(0);
	});

	it("closes every session on shutdown", async () => {
		await openSession(USER_A);
		expect(harness.sessionCount()).toBe(1);
		await harness.shutdown();
		expect(harness.sessionCount()).toBe(0);
	});
});
