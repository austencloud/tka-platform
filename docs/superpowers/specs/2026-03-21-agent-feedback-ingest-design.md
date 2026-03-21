# Agent Feedback Ingest Endpoint — Design Spec

**Date:** 2026-03-21
**Status:** Implemented

## Problem

Submitting feedback to TKA Scribe currently requires either the in-app form (source: `"app"`) or the CLI script via Claude Code (source: `"terminal"`). When Austen is talking to an LLM in a conversational context (Claude.ai, other agents), ideas and bugs come up naturally but there is no way to capture them without context-switching to the app or terminal.

## Solution

A lightweight SvelteKit API route that accepts feedback via GET request with query parameters. Any agent that can visit a URL (via `web_fetch`, `curl`, or similar) can submit feedback by constructing the right URL. No auth token, no POST body, no SDK required.

## URL Format

```
GET /api/feedback/ingest?key=<SECRET>&type=<TYPE>&title=<TITLE>&description=<DESC>
```

### Required Parameters

| Param | Type | Description |
|-------|------|-------------|
| `key` | string | API secret. Must match `FEEDBACK_INGEST_KEY` env var. |
| `title` | string | Feedback title (max 120 chars, URL-encoded) |
| `description` | string | Feedback description (max 2000 chars, URL-encoded) |

### Optional Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `"bug"` \| `"feature"` \| `"general"` | `"general"` | Feedback type |
| `priority` | `"low"` \| `"medium"` \| `"high"` \| `"critical"` | `"medium"` | Priority level |
| `module` | string | `"system"` | Which app module this relates to |
| `tab` | string | `"general"` | Which tab within the module |
| `agent` | string | `"claude-chat"` | Agent identifier (for attribution in the UI) |

## Response Format

### Success (201)
```json
{ "ok": true, "id": "abc123def456", "title": "Card back clips on diamond mode" }
```

### Auth failure (401)
```json
{ "ok": false, "error": "Invalid or missing API key" }
```

### Validation failure (400)
```json
{ "ok": false, "error": "Missing required parameter: title" }
```

### Rate limited (429)
Uses existing `rateLimitResponse` helper. 20 requests per 15 minutes per IP.

## Security Model

- API key auth via `FEEDBACK_INGEST_KEY` env var (dynamic private)
- Rate limited by IP (20/15min)
- HTML tags stripped from all inputs
- Max lengths enforced (title: 120, description: 2000)

## Data Model Changes

- `FeedbackSource`: Added `"agent"` to union
- `FeedbackItem`: Added optional `sourceAgent?: string` field
- Agent user: `userId: "agent-ingest"`, `userEmail: "agent@thekineticalphabetapp.com"`

## Architecture

Route: `src/routes/api/feedback/ingest/+server.ts`
Dependencies: `getAdminDb()`, `withRateLimit`, `$env/dynamic/private`
