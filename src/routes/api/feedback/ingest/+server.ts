/**
 * Agent Feedback Ingest Endpoint
 *
 * GET /api/feedback/ingest?key=<SECRET>&title=<TITLE>&description=<DESC>&...
 *
 * Allows LLM agents and external tools to submit feedback by visiting a URL.
 * Auth is via a shared secret in the `key` query param (not Firebase Auth).
 */

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { getAdminDb } from "$lib/server/firebaseAdmin";
import admin from "firebase-admin";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import {
	isFeedbackType,
	type FeedbackType,
	type FeedbackPriority,
} from "$lib/shared/feedback/domain/models/feedback-models";

// ── Constants ────────────────────────────────────────────────────────

const COLLECTION = "feedback";
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FIELD_LENGTH = 60;

const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

const AGENT_USER = {
	userId: "agent-ingest",
	userEmail: "agent@thekineticalphabetapp.com",
	userDisplayName: "Agent",
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Strip HTML tags and trim whitespace */
function sanitize(input: string, maxLength: number): string {
	return input
		.replace(/<[^>]*>/g, "")
		.trim()
		.slice(0, maxLength);
}

function isValidPriority(value: string): value is FeedbackPriority {
	return (VALID_PRIORITIES as readonly string[]).includes(value);
}

// ── Handler ──────────────────────────────────────────────────────────

export const GET: RequestHandler = async (event) => {
	// 1. Auth: validate API key
	const FEEDBACK_INGEST_KEY = env.FEEDBACK_INGEST_KEY;
	if (!FEEDBACK_INGEST_KEY) {
		return json(
			{ ok: false, error: "Ingest endpoint not configured" },
			{ status: 500 },
		);
	}

	const key = event.url.searchParams.get("key");
	if (!key || key !== FEEDBACK_INGEST_KEY) {
		return json(
			{ ok: false, error: "Invalid or missing API key" },
			{ status: 401 },
		);
	}

	// 2. Rate limit by IP
	const blocked = withRateLimit(event, RATE_LIMITS.FEEDBACK_INGEST, "ip");
	if (blocked) return blocked;

	// 3. Parse and validate params
	const rawTitle = event.url.searchParams.get("title");
	const rawDescription = event.url.searchParams.get("description");
	const rawType = event.url.searchParams.get("type") ?? "general";
	const rawPriority = event.url.searchParams.get("priority") ?? "medium";
	const rawModule = event.url.searchParams.get("module") ?? "system";
	const rawTab = event.url.searchParams.get("tab") ?? "general";
	const rawAgent = event.url.searchParams.get("agent") ?? "claude-chat";

	if (!rawTitle) {
		return json(
			{ ok: false, error: "Missing required parameter: title" },
			{ status: 400 },
		);
	}

	if (!rawDescription) {
		return json(
			{ ok: false, error: "Missing required parameter: description" },
			{ status: 400 },
		);
	}

	const title = sanitize(rawTitle, MAX_TITLE_LENGTH);
	const description = sanitize(rawDescription, MAX_DESCRIPTION_LENGTH);

	if (!title) {
		return json(
			{ ok: false, error: "Title is empty after sanitization" },
			{ status: 400 },
		);
	}

	if (!description) {
		return json(
			{ ok: false, error: "Description is empty after sanitization" },
			{ status: 400 },
		);
	}

	const type: FeedbackType = isFeedbackType(rawType) ? rawType : "general";
	const priority: FeedbackPriority = isValidPriority(rawPriority)
		? rawPriority
		: "medium";
	const capturedModule = sanitize(rawModule, MAX_FIELD_LENGTH) || "system";
	const capturedTab = sanitize(rawTab, MAX_FIELD_LENGTH) || "general";
	const sourceAgent = sanitize(rawAgent, MAX_FIELD_LENGTH) || "claude-chat";

	// 4. Write to Firestore
	try {
		const db = getAdminDb();
		const now = admin.firestore.Timestamp.now();

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
			source: "agent" as const,
			sourceAgent,
			status: "new" as const,
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

		const docRef = await db.collection(COLLECTION).add(docData);

		return json({ ok: true, id: docRef.id, title }, { status: 201 });
	} catch (err) {
		console.error("[feedback-ingest] Firestore write failed:", err);
		return json(
			{ ok: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
};
