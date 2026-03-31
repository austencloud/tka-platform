import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { writeFeedback } from "./firestore";

export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "TKA Feedback",
		version: "1.0.0",
	});

	async init() {
		this.server.tool(
			"submit_feedback",
			"Submit a bug report, feature request, or general feedback to the TKA Scribe feedback system. Use this whenever Austen mentions a bug, an idea, or something that should be tracked.",
			{
				title: z.string().max(120).describe("Short title summarizing the feedback"),
				description: z
					.string()
					.max(2000)
					.describe("Detailed description of the bug, feature, or feedback"),
				type: z
					.enum(["bug", "feature", "general"])
					.default("general")
					.describe("Feedback type"),
				priority: z
					.enum(["low", "medium", "high", "critical"])
					.default("medium")
					.describe("Priority level"),
				module: z
					.string()
					.max(60)
					.default("system")
					.describe(
						"App module this relates to (e.g., choreo-card, fuse, generate, learn)",
					),
				tab: z
					.string()
					.max(60)
					.default("general")
					.describe(
						"Tab within the module (e.g., print-prep, shuffle, deck-browser)",
					),
			},
			async ({ title, description, type, priority, module, tab }) => {
				try {
					const result = await writeFeedback(this.env as any, {
						title: title.trim().slice(0, 120),
						description: description.trim().slice(0, 2000),
						type: type ?? "general",
						priority: priority ?? "medium",
						capturedModule: module ?? "system",
						capturedTab: tab ?? "general",
						sourceAgent: "claude-chat-mcp",
					});

					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									success: true,
									id: result.id,
									message: `Feedback submitted: ${title}`,
								}),
							},
						],
					};
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									success: false,
									error: message,
								}),
							},
						],
					};
				}
			},
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		if (url.pathname === "/") {
			return new Response("TKA Feedback MCP Server", { status: 200 });
		}

		return new Response("Not found", { status: 404 });
	},
};
