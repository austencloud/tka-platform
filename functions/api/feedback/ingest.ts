/**
 * Agent Feedback Ingest — Cloudflare Pages Function
 *
 * POST /api/feedback/ingest
 *   Header: x-api-key: <SECRET>
 *   Body JSON: { title, description, type?, priority?, module?, tab?, agent? }
 *
 * Writes directly to Firestore via REST API (no Node SDK needed).
 * Auth is via a shared secret in the `x-api-key` header (not query params,
 * which leak to logs, CDN, and Referer headers).
 */

interface Env {
	FEEDBACK_INGEST_KEY: string;
	FIREBASE_SERVICE_ACCOUNT_JSON: string;
}

// ── Constants ────────────────────────────────────────────────────────

const FIRESTORE_PROJECT = "the-kinetic-alphabet";
const COLLECTION = "feedback";
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FIELD_LENGTH = 60;

const VALID_TYPES = ["bug", "feature", "general"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

const AGENT_USER = {
	userId: "agent-ingest",
	userEmail: "agent@thekineticalphabetapp.com",
	userDisplayName: "Agent",
};

// ── Rate limiter (in-memory, resets on cold start) ───────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = { maxRequests: 20, windowMs: 15 * 60 * 1000 };

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	if (!entry || entry.resetAt < now) {
		rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
		return { allowed: true, retryAfter: 0 };
	}

	if (entry.count >= RATE_LIMIT.maxRequests) {
		return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
	}

	entry.count++;
	return { allowed: true, retryAfter: 0 };
}

// ── Helpers ──────────────────────────────────────────────────────────

function sanitize(input: string, maxLength: number): string {
	return input.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

function jsonResponse(body: Record<string, unknown>, status: number, headers?: Record<string, string>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

// ── Google Auth (service account JWT → access token) ─────────────────

async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = {
		iss: serviceAccount.client_email,
		scope: "https://www.googleapis.com/auth/datastore",
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600,
	};

	const encode = (obj: unknown) =>
		btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

	const unsignedToken = `${encode(header)}.${encode(payload)}`;

	// Import the RSA private key
	const pemContents = serviceAccount.private_key
		.replace(/-----BEGIN PRIVATE KEY-----/, "")
		.replace(/-----END PRIVATE KEY-----/, "")
		.replace(/\n/g, "");

	const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		"pkcs8",
		binaryKey,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"]
	);

	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		cryptoKey,
		new TextEncoder().encode(unsignedToken)
	);

	const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

	const jwt = `${unsignedToken}.${sig}`;

	// Exchange JWT for access token
	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
	});

	const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
	if (!tokenData.access_token) {
		throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
	}

	return tokenData.access_token;
}

// ── Firestore REST write ─────────────────────────────────────────────

async function writeToFirestore(
	accessToken: string,
	docData: Record<string, unknown>
): Promise<string> {
	const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/${COLLECTION}`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ fields: toFirestoreFields(docData) }),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Firestore write failed (${res.status}): ${err}`);
	}

	const result = (await res.json()) as { name: string };
	// name is like "projects/.../documents/feedback/DOC_ID"
	const docId = result.name.split("/").pop()!;
	return docId;
}

/** Convert a plain JS object to Firestore REST API field format */
function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		fields[key] = toFirestoreValue(value);
	}
	return fields;
}

function toFirestoreValue(value: unknown): unknown {
	if (value === null || value === undefined) return { nullValue: null };
	if (typeof value === "string") return { stringValue: value };
	if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
	if (typeof value === "boolean") return { booleanValue: value };
	if (value instanceof Date) return { timestampValue: value.toISOString() };
	if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
	if (typeof value === "object") return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
	return { stringValue: String(value) };
}

// ── Tombstone: old GET endpoint ─────────────────────────────────────

/** @deprecated Migrated to POST with x-api-key header. */
export const onRequestGet: PagesFunction<Env> = async () => {
	return jsonResponse(
		{
			ok: false,
			error:
				"This endpoint has been migrated from GET to POST. " +
				"Send a POST request with the API key in the x-api-key header " +
				"and parameters in the JSON request body.",
		},
		410
	);
};

// ── Handler ──────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
	const { request, env } = context;

	// 1. Auth: validate API key from header (not query params)
	if (!env.FEEDBACK_INGEST_KEY) {
		return jsonResponse({ ok: false, error: "Ingest endpoint not configured" }, 500);
	}

	const apiKey = request.headers.get("x-api-key");
	if (!apiKey || apiKey !== env.FEEDBACK_INGEST_KEY) {
		return jsonResponse({ ok: false, error: "Invalid or missing API key" }, 401);
	}

	// 2. Rate limit
	const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
	const rl = checkRateLimit(ip);
	if (!rl.allowed) {
		return jsonResponse(
			{ error: "Too many requests. Please try again later.", code: "rate_limited", retryAfter: rl.retryAfter },
			429,
			{ "Retry-After": String(rl.retryAfter) }
		);
	}

	// 3. Parse and validate body
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
	}

	const rawTitle = typeof body.title === "string" ? body.title : null;
	const rawDescription = typeof body.description === "string" ? body.description : null;

	if (!rawTitle) return jsonResponse({ ok: false, error: "Missing required field: title" }, 400);
	if (!rawDescription) return jsonResponse({ ok: false, error: "Missing required field: description" }, 400);

	const title = sanitize(rawTitle, MAX_TITLE_LENGTH);
	const description = sanitize(rawDescription, MAX_DESCRIPTION_LENGTH);

	if (!title) return jsonResponse({ ok: false, error: "Title is empty after sanitization" }, 400);
	if (!description) return jsonResponse({ ok: false, error: "Description is empty after sanitization" }, 400);

	const rawType = typeof body.type === "string" ? body.type : "general";
	const rawPriority = typeof body.priority === "string" ? body.priority : "medium";
	const rawModule = typeof body.module === "string" ? body.module : "system";
	const rawTab = typeof body.tab === "string" ? body.tab : "general";
	const rawAgent = typeof body.agent === "string" ? body.agent : "claude-chat";

	const type = VALID_TYPES.includes(rawType) ? rawType : "general";
	const priority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : "medium";
	const capturedModule = sanitize(rawModule, MAX_FIELD_LENGTH) || "system";
	const capturedTab = sanitize(rawTab, MAX_FIELD_LENGTH) || "general";
	const sourceAgent = sanitize(rawAgent, MAX_FIELD_LENGTH) || "claude-chat";

	// 4. Write to Firestore
	try {
		if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
			return jsonResponse({ ok: false, error: "Firebase not configured" }, 500);
		}

		const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
		const accessToken = await getAccessToken(sa);
		const now = new Date();

		const docData = {
			createdAt: now,
			updatedAt: null,
			userId: AGENT_USER.userId,
			userEmail: AGENT_USER.userEmail,
			userDisplayName: AGENT_USER.userDisplayName,
			type,
			title,
			description,
			originalTitle: title,
			originalDescription: description,
			priority,
			capturedModule,
			capturedTab,
			source: "agent",
			sourceAgent,
			status: "new",
			isDeleted: false,
			statusHistory: [
				{
					status: "new",
					timestamp: now,
					actorId: "system",
					actorName: `Agent (${sourceAgent})`,
					notes: `Submitted via ingest endpoint by ${sourceAgent}`,
				},
			],
		};

		const docId = await writeToFirestore(accessToken, docData);
		return jsonResponse({ ok: true, id: docId, title }, 201);
	} catch (err) {
		console.error("[feedback-ingest] Error:", err);
		return jsonResponse({ ok: false, error: "Internal server error" }, 500);
	}
};
