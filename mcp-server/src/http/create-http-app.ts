/**
 * The HTTP surface.
 *
 * Built on the SDK's own primitives: createMcpExpressApp (Host-header /
 * DNS-rebinding protection), metadataHandler (RFC 9728 document, and it brings
 * its own public CORS), and getOAuthProtectedResourceMetadataUrl (the path
 * clients actually look at, which includes the resource path).
 *
 * Route order is load-bearing:
 *   1. GET /                     — health, public. install-service.ps1 probes it.
 *   2. metadata                  — public; read before a client holds a token.
 *   3. requireBearerAuth on /mcp — BEFORE anything is allocated.
 *   4. session handling
 */

import { randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { metadataHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/metadata.js";
import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import type { AuthConfig } from "./auth-config.js";

export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Absolute ceiling regardless of activity. */
export const SESSION_MAX_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const MAX_SESSIONS = 128;
const SWEEP_INTERVAL_MS = 60 * 1000;

type SessionRecord = {
	transport: StreamableHTTPServerTransport;
	/** Stable owner: issuer + subject + OAuth client. */
	owner: string;
	/** Token expiry, seconds since epoch. The session dies with the token. */
	expiresAt: number;
	createdAt: number;
	lastSeen: number;
};

export type CreateHttpAppOptions = {
	config: AuthConfig;
	verifier: OAuthTokenVerifier;
	createMcpServer: () => McpServer;
	/** Test seam: observe how many servers were actually constructed. */
	onServerConstructed?: () => void;
	/** Disable the background sweep in tests. */
	sweep?: boolean;
};

export type HttpApp = {
	app: Express;
	/** Stop the sweep timer and close every live session. */
	shutdown: () => Promise<void>;
	sessionCount: () => number;
};

function ownerOf(auth: { clientId: string; extra?: Record<string, unknown> } | undefined): string {
	const sub = typeof auth?.extra?.sub === "string" ? auth.extra.sub : "";
	const iss = typeof auth?.extra?.iss === "string" ? auth.extra.iss : "";
	return `${iss}|${sub}|${auth?.clientId ?? ""}`;
}

export function createHttpApp({
	config,
	verifier,
	createMcpServer,
	onServerConstructed,
	sweep = true,
}: CreateHttpAppOptions): HttpApp {
	const app = createMcpExpressApp({ allowedHosts: config.allowedHosts });
	const sessions = new Map<string, SessionRecord>();

	async function drop(id: string, record: SessionRecord): Promise<void> {
		sessions.delete(id);
		try {
			await record.transport.close();
		} catch {
			// A transport that fails to close is already gone; dropping the entry
			// is what matters. Swallowing here keeps one bad session from
			// breaking the sweep for every other one.
		}
	}

	async function sweepExpired(now = Date.now()): Promise<void> {
		const nowSeconds = Math.floor(now / 1000);
		for (const [id, record] of [...sessions]) {
			const idle = now - record.lastSeen > SESSION_IDLE_MS;
			const tooOld = now - record.createdAt > SESSION_MAX_LIFETIME_MS;
			const tokenDead = record.expiresAt <= nowSeconds;
			if (idle || tooOld || tokenDead) await drop(id, record);
		}
	}

	// A request-driven sweep is not expiration: with no further traffic a session
	// and its SSE stream live forever. unref() keeps this from holding the
	// process open.
	const timer = sweep ? setInterval(() => void sweepExpired(), SWEEP_INTERVAL_MS) : undefined;
	timer?.unref?.();

	// (1) Health. install-service.ps1 probes this and throws if it does not
	// answer, so removing it turns a deploy into a failed install.
	app.get("/", (_req, res) => {
		res.status(200).type("text/plain").send("Flow Arts Knowledge MCP Server");
	});

	// (2) Public discovery. metadataHandler returns an express.Router whose
	// internal route is "/", so it MUST be mounted with app.use — app.get does
	// not strip the mount path and the router never matches (a 404 that the
	// WWW-Authenticate challenge would point clients straight at).
	const metadataUrl = getOAuthProtectedResourceMetadataUrl(config.resourceUrl);
	const metadataPath = new URL(metadataUrl).pathname;
	const metadata = {
		resource: config.resourceUrl.href,
		authorization_servers: [config.issuer],
		bearer_methods_supported: ["header"],
		scopes_supported: [config.requiredScope],
	};
	app.use(metadataPath, metadataHandler(metadata));
	if (metadataPath !== "/.well-known/oauth-protected-resource") {
		// Some clients probe the bare path before the path-specific one.
		app.use("/.well-known/oauth-protected-resource", metadataHandler(metadata));
	}

	// (3) Auth ahead of any allocation. requiredScope is enforced by the SDK.
	app.all(
		"/mcp",
		requireBearerAuth({
			verifier,
			requiredScopes: [config.requiredScope],
			resourceMetadataUrl: metadataUrl,
		}),
		async (req, res) => {
			const auth = (req as Request & { auth?: { clientId: string; expiresAt?: number; extra?: Record<string, unknown> } }).auth;
			const owner = ownerOf(auth);
			const now = Date.now();
			const sessionId = req.headers["mcp-session-id"] as string | undefined;

			if (sessionId) {
				const record = sessions.get(sessionId);
				if (!record) {
					res.status(404).json({ error: "Session not found" });
					return;
				}
				// A session belongs to the principal that opened it. Without this,
				// anyone holding a valid token for this resource could drive
				// someone else's stateful server — a data boundary in Phase 2.
				if (record.owner !== owner) {
					res.status(403).json({ error: "Session belongs to a different principal" });
					return;
				}
				record.lastSeen = now;
				await record.transport.handleRequest(req, res, req.body);
				return;
			}

			if (req.method !== "POST") {
				res.status(400).json({ error: "Bad request — missing session" });
				return;
			}

			// Only an initialize request may open a session. Constructing a server
			// for arbitrary bodies lets any authenticated caller force expensive
			// allocation; the SDK's own example checks this first.
			if (!isInitializeRequest(req.body)) {
				res.status(400).json({ error: "Expected an initialize request to open a session" });
				return;
			}

			await sweepExpired(now);
			if (sessions.size >= MAX_SESSIONS) {
				res.status(503).json({ error: "Session capacity reached" });
				return;
			}

			const transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: () => randomUUID(),
				// Registering here rather than after handleRequest avoids racing
				// initialization and re-inserting a transport DELETE just closed.
				onsessioninitialized: (id: string) => {
					sessions.set(id, {
						transport,
						owner,
						expiresAt: auth?.expiresAt ?? Math.floor(now / 1000),
						createdAt: now,
						lastSeen: now,
					});
				},
			});
			transport.onclose = () => {
				if (transport.sessionId) sessions.delete(transport.sessionId);
			};

			onServerConstructed?.();
			await createMcpServer().connect(transport);
			await transport.handleRequest(req, res, req.body);
		},
	);

	return {
		app,
		sessionCount: () => sessions.size,
		shutdown: async () => {
			if (timer) clearInterval(timer);
			for (const [id, record] of [...sessions]) await drop(id, record);
		},
	};
}
