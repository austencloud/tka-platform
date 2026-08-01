/**
 * Authorization configuration for the HTTP transport.
 *
 * There is deliberately NO unauthenticated fallback. If HTTP is enabled and this
 * cannot be resolved, the process refuses to start. A fallback would reopen the
 * endpoint the first time a deployment lost an env var.
 */

export type AuthConfig = {
	/**
	 * The issuer, EXACTLY as configured. Not normalized: RFC 8414 issuer
	 * matching is a byte-for-byte comparison against the `iss` claim, and
	 * round-tripping through URL.href appends a trailing slash that a real AS
	 * may not send.
	 */
	issuer: string;
	/** The RFC 9728 resource identifier this server publishes. */
	resourceUrl: URL;
	/**
	 * The audience expected in a token. Defaults to the resource identifier, but
	 * RFC 8707 lets an AS map a resource indicator onto a different audience, so
	 * it is separately configurable.
	 */
	audience: string;
	jwksUri: URL;
	/**
	 * Scope a token must carry to use this server at all. Empty means the AS
	 * does not express scopes — true of a Cloudflare Access assertion, which is
	 * already the output of an Access policy rather than a delegated grant.
	 */
	requiredScope: string;
	/**
	 * Header carrying the JWT, lowercased. Defaults to `authorization` (bearer).
	 * A reverse proxy that terminates the OAuth flow itself hands the origin a
	 * different header — Cloudflare Access uses `cf-access-jwt-assertion`, and
	 * the token in `Authorization` at that point is opaque and unverifiable.
	 */
	tokenHeader: string;
	/** Host header allowlist, lowercased. */
	allowedHosts: string[];
};

type Env = Record<string, string | undefined>;

/**
 * Values that parse but cannot work. The deployment launcher ships with
 * placeholders, and a syntactically valid one let the service start, pass its
 * health probe and report success while being unable to reach any key set.
 */
const PLACEHOLDER = /replace[-_ ]?me|example\.com\/REPLACE|your[-_]/i;

function rejectPlaceholder(raw: string, name: string): void {
	if (PLACEHOLDER.test(raw)) {
		throw new Error(`[MCP] ${name} still contains a placeholder value: ${raw}`);
	}
}

function required(env: Env, name: string): string {
	const value = env[name]?.trim();
	if (!value) {
		throw new Error(
			`[MCP] ${name} is required when MCP_HTTP_PORT is set. Refusing to start an unauthenticated HTTP transport.`,
		);
	}
	rejectPlaceholder(value, name);
	return value;
}

function parseUrl(raw: string, name: string, opts: { allowQuery?: boolean } = {}): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`[MCP] ${name} must be an absolute URL, got: ${raw}`);
	}

	const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
	if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
		throw new Error(`[MCP] ${name} must use https (http permitted only on loopback), got: ${raw}`);
	}
	if (url.username || url.password) {
		throw new Error(`[MCP] ${name} must not embed credentials`);
	}
	if (url.hash) {
		throw new Error(`[MCP] ${name} must not contain a fragment`);
	}
	if (!opts.allowQuery && url.search) {
		throw new Error(`[MCP] ${name} must not contain a query string`);
	}
	return url;
}

export function resolveAuthConfig(env: Env): AuthConfig {
	const issuerRaw = required(env, "MCP_AUTH_ISSUER");
	// Validated as a URL, but the ORIGINAL string is what gets compared.
	parseUrl(issuerRaw, "MCP_AUTH_ISSUER");

	const resourceUrl = parseUrl(required(env, "MCP_AUTH_RESOURCE_URL"), "MCP_AUTH_RESOURCE_URL");
	const jwksUri = parseUrl(required(env, "MCP_AUTH_JWKS_URI"), "MCP_AUTH_JWKS_URI", { allowQuery: true });

	// Optional, unlike the three above. Those three ARE the refusal to run
	// unauthenticated; a scope is a further restriction on an already-verified
	// token, and an AS that does not issue scopes (Cloudflare Access) cannot
	// satisfy one. Requiring it there would reject every valid token instead.
	const scopeRaw = env.MCP_AUTH_REQUIRED_SCOPE?.trim() ?? "";
	if (scopeRaw) rejectPlaceholder(scopeRaw, "MCP_AUTH_REQUIRED_SCOPE");
	const requiredScope = scopeRaw;

	const tokenHeader = (env.MCP_AUTH_TOKEN_HEADER?.trim() || "authorization").toLowerCase();

	const audienceRaw = env.MCP_AUTH_AUDIENCE?.trim();
	if (audienceRaw) rejectPlaceholder(audienceRaw, "MCP_AUTH_AUDIENCE");
	const audience = audienceRaw || resourceUrl.href;

	// The SDK lowercases a parsed Host header before comparing, so an allowlist
	// entry containing capitals would reject the host it names.
	const configuredHosts = (env.MCP_ALLOWED_HOSTS ?? "")
		.split(",")
		.map((h) => h.trim().toLowerCase())
		.filter(Boolean);

	const allowedHosts =
		configuredHosts.length > 0
			? configuredHosts
			: [resourceUrl.hostname.toLowerCase(), "localhost", "127.0.0.1"];

	return { issuer: issuerRaw, resourceUrl, audience, jwksUri, requiredScope, tokenHeader, allowedHosts };
}

/** 0 means "HTTP disabled". A malformed value is an error, never a silent disable. */
export function resolveHttpPort(raw: string | undefined): number {
	const value = raw?.trim();
	if (!value) return 0;
	if (!/^\d+$/.test(value)) {
		throw new Error(`[MCP] MCP_HTTP_PORT must be a non-negative integer, got: ${value}`);
	}
	const port = Number(value);
	if (port !== 0 && (port < 1 || port > 65535)) {
		throw new Error(`[MCP] MCP_HTTP_PORT must be 0 or 1-65535, got: ${value}`);
	}
	return port;
}
