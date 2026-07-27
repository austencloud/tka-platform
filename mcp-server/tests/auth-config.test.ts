import { describe, expect, it } from "vitest";

import { resolveAuthConfig, resolveHttpPort } from "../src/http/auth-config.js";

const valid = {
	MCP_AUTH_ISSUER: "https://as.example.com",
	MCP_AUTH_RESOURCE_URL: "https://mcp.example.com/mcp",
	MCP_AUTH_JWKS_URI: "https://as.example.com/.well-known/jwks.json",
	MCP_AUTH_REQUIRED_SCOPE: "mcp:use",
};

describe("resolveAuthConfig", () => {
	it("returns normalized values for a complete config", () => {
		const c = resolveAuthConfig(valid);
		expect(c.resourceUrl.href).toBe("https://mcp.example.com/mcp");
		expect(c.jwksUri.href).toBe("https://as.example.com/.well-known/jwks.json");
		expect(c.requiredScope).toBe("mcp:use");
	});

	it("preserves the issuer string EXACTLY as configured", () => {
		// Audit round 2, finding 4: an issuer is compared byte-for-byte against
		// the `iss` claim (RFC 8414). Normalizing it through URL.href appends a
		// trailing slash that the AS may not send, rejecting every valid token.
		expect(resolveAuthConfig(valid).issuer).toBe("https://as.example.com");
		expect(resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "https://as.example.com/" }).issuer).toBe(
			"https://as.example.com/",
		);
	});

	it("defaults the audience to the resource URL", () => {
		expect(resolveAuthConfig(valid).audience).toBe("https://mcp.example.com/mcp");
	});

	it("allows the audience to differ from the resource", () => {
		// RFC 8707 permits an AS to map a resource indicator onto a different
		// audience identifier. One value cannot represent both.
		const c = resolveAuthConfig({ ...valid, MCP_AUTH_AUDIENCE: "api://tka-mcp" });
		expect(c.audience).toBe("api://tka-mcp");
		expect(c.resourceUrl.href).toBe("https://mcp.example.com/mcp");
	});

	it.each([
		"MCP_AUTH_ISSUER",
		"MCP_AUTH_RESOURCE_URL",
		"MCP_AUTH_JWKS_URI",
		"MCP_AUTH_REQUIRED_SCOPE",
	])("throws when %s is missing", (missing) => {
		const env: Record<string, string | undefined> = { ...valid };
		delete env[missing];
		expect(() => resolveAuthConfig(env)).toThrow(new RegExp(missing));
	});

	it("throws on entirely absent config rather than defaulting", () => {
		expect(() => resolveAuthConfig({})).toThrow();
	});

	it("rejects placeholder values that would otherwise parse", () => {
		// Audit round 2, finding 2: REPLACE-ME.example.com is a syntactically
		// valid URL, so the service started, passed its health probe, reported
		// SUCCESS, and could never reach a JWKS.
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "https://REPLACE-ME.example.com" })).toThrow(
			/placeholder/i,
		);
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_AUDIENCE: "replace-me" })).toThrow(/placeholder/i);
	});

	it("rejects a non-HTTPS issuer off loopback", () => {
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "http://as.example.com" })).toThrow(/https/i);
	});

	it("allows http on loopback for local development", () => {
		expect(resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "http://localhost:8080" }).issuer).toBe(
			"http://localhost:8080",
		);
	});

	it("rejects a non-http scheme even on loopback", () => {
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "ftp://localhost" })).toThrow();
	});

	it("rejects credentials embedded in a URL", () => {
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "https://u:p@as.example.com" })).toThrow(
			/credential/i,
		);
	});

	it("rejects a fragment", () => {
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_RESOURCE_URL: "https://mcp.example.com/mcp#x" })).toThrow(
			/fragment/i,
		);
	});

	it("rejects a query on the resource URL", () => {
		// The resource identifier is also the default audience; a query makes
		// the two disagree once the SDK's metadata helper drops it.
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_RESOURCE_URL: "https://mcp.example.com/mcp?a=1" })).toThrow(
			/query/i,
		);
	});

	it("rejects a non-URL", () => {
		expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "not-a-url" })).toThrow();
	});

	it("parses the allowed-hosts list case-insensitively", () => {
		// Audit round 2, finding 2: the SDK lowercases the parsed hostname before
		// a case-sensitive compare, so an allowlist entry with capitals rejects
		// the very host it names.
		const c = resolveAuthConfig({ ...valid, MCP_ALLOWED_HOSTS: "MCP.Example.COM, localhost" });
		expect(c.allowedHosts).toEqual(["mcp.example.com", "localhost"]);
	});

	it("derives the allowed host from the resource URL when none is configured", () => {
		expect(resolveAuthConfig(valid).allowedHosts).toContain("mcp.example.com");
		expect(resolveAuthConfig(valid).allowedHosts).toContain("localhost");
		expect(resolveAuthConfig(valid).allowedHosts).toContain("127.0.0.1");
	});
});

describe("resolveHttpPort", () => {
	it("treats unset as disabled", () => {
		expect(resolveHttpPort(undefined)).toBe(0);
	});

	it("treats 0 as disabled", () => {
		expect(resolveHttpPort("0")).toBe(0);
	});

	it("parses a valid port", () => {
		expect(resolveHttpPort("3333")).toBe(3333);
	});

	it("throws on a malformed port instead of silently disabling HTTP", () => {
		// parseInt("abc") is NaN and NaN > 0 is false, so the old code skipped
		// the whole HTTP branch on a typo, with no error.
		expect(() => resolveHttpPort("abc")).toThrow();
		expect(() => resolveHttpPort("99999")).toThrow();
		expect(() => resolveHttpPort("-1")).toThrow();
	});
});
