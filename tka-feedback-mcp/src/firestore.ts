/**
 * Firestore REST API client for Cloudflare Workers.
 *
 * Signs a JWT using the Firebase service account private key,
 * exchanges it for a Google OAuth2 access token, then writes
 * documents via the Firestore REST API.
 */

export interface FirestoreEnv {
	FIREBASE_PROJECT_ID: string;
	FIREBASE_CLIENT_EMAIL: string;
	FIREBASE_PRIVATE_KEY: string;
}

export interface FeedbackDoc {
	title: string;
	description: string;
	type: string;
	priority: string;
	capturedModule: string;
	capturedTab: string;
	sourceAgent: string;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
	const pemContents = pem
		.replace(/-----BEGIN PRIVATE KEY-----/g, "")
		.replace(/-----END PRIVATE KEY-----/g, "")
		.replace(/\\n/g, "")
		.replace(/\n/g, "")
		.trim();

	const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	return crypto.subtle.importKey(
		"pkcs8",
		binaryDer,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
}

async function getAccessToken(env: FirestoreEnv): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = {
		iss: env.FIREBASE_CLIENT_EMAIL,
		sub: env.FIREBASE_CLIENT_EMAIL,
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600,
		scope: "https://www.googleapis.com/auth/datastore",
	};

	const enc = (obj: unknown) =>
		btoa(JSON.stringify(obj))
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");

	const signingInput = `${enc(header)}.${enc(payload)}`;
	const key = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
	const sig = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(signingInput),
	);
	const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	const jwt = `${signingInput}.${sigB64}`;

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
	});

	const tokenData = (await tokenRes.json()) as {
		access_token?: string;
		error?: string;
	};
	if (!tokenData.access_token) {
		throw new Error(`Token exchange failed: ${tokenData.error || "unknown"}`);
	}
	return tokenData.access_token;
}

export async function writeFeedback(
	env: FirestoreEnv,
	doc: FeedbackDoc,
): Promise<{ id: string }> {
	const accessToken = await getAccessToken(env);
	const now = new Date().toISOString();

	const firestoreDoc = {
		fields: {
			createdAt: { timestampValue: now },
			updatedAt: { nullValue: null },
			userId: { stringValue: "agent-ingest" },
			userEmail: { stringValue: "agent@thekineticalphabetapp.com" },
			userDisplayName: { stringValue: "Agent" },
			type: { stringValue: doc.type },
			title: { stringValue: doc.title },
			description: { stringValue: doc.description },
			originalTitle: { stringValue: doc.title },
			originalDescription: { stringValue: doc.description },
			priority: { stringValue: doc.priority },
			capturedModule: { stringValue: doc.capturedModule },
			capturedTab: { stringValue: doc.capturedTab },
			source: { stringValue: "agent" },
			sourceAgent: { stringValue: doc.sourceAgent },
			status: { stringValue: "new" },
			isDeleted: { booleanValue: false },
			statusHistory: {
				arrayValue: {
					values: [
						{
							mapValue: {
								fields: {
									status: { stringValue: "new" },
									timestamp: { timestampValue: now },
									actorId: { stringValue: "system" },
									actorName: {
										stringValue: `Agent (${doc.sourceAgent})`,
									},
									notes: {
										stringValue: `Submitted via MCP tool by ${doc.sourceAgent}`,
									},
								},
							},
						},
					],
				},
			},
		},
	};

	const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/feedback`;

	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(firestoreDoc),
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Firestore write failed (${res.status}): ${errText}`);
	}

	const result = (await res.json()) as { name?: string };
	const docId = result.name?.split("/").pop() ?? "unknown";
	return { id: docId };
}
