/**
 * Flow Arts Knowledge MCP Server
 *
 * Comprehensive MCP server for flow arts domain knowledge.
 * Provides TKA pictograph rendering, sequence generation, educational tools,
 * VTG (Vulcan Tech Gospel) domain queries, and cross-system translation.
 *
 * Tools:
 * - Pictograph Generation: generate_pictograph, generate_pictograph_url, view_pictograph
 * - Sequence Generation: generate_sequence_data, generate_sequence_image, view_sequence
 * - Sequence Constraints: parse_constraints, analyze_word_feasibility
 * - LOOP Sequences: validate_loop_options, generate_loop_sequence, generate_loop_image
 * - Data Queries: list_available_letters, list_letter_variations, get_pictograph_data, search_pictographs
 * - Educational: get_alphabet_info, get_letter_explanation, get_term_definition, compare_letters, list_letters_by_type, get_position_info
 * - User Presets: list_user_presets, save_user_preset, delete_user_preset, get_user_preset, generate_with_preset, seed_default_presets
 * - Preferences: set_preferences, get_preferences, reset_preferences
 * - Utilities: generate_random_word
 */

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerDataTools,
  registerPreferenceTools,
  registerEducationalTools,
  registerPictographTools,
  registerSequenceTools,
  registerLoopTools,
  registerPresetTools,
  registerUtilityTools,
  registerVTGTools,
} from "./src/tools/index.js";
import { ensureTransitionGraphInitialized } from "./src/core/letter-transition-graph.js";
import { loadKnowledgeBase } from "./src/shared/server-context.js";

const HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || "0", 10);

function createMcpServer() {
  const server = new McpServer({
    name: "flow-arts-knowledge",
    version: "3.0.0",
  });

  registerDataTools(server);
  registerPreferenceTools(server);
  registerEducationalTools(server);
  registerPictographTools(server);
  registerSequenceTools(server);
  registerLoopTools(server);
  registerPresetTools(server);
  registerUtilityTools(server);
  registerVTGTools(server);

  return server;
}

// Load knowledge base (glossary, letter types)
loadKnowledgeBase();

async function main() {
  console.error("[MCP] Starting Flow Arts Knowledge MCP Server v3.0.0...");

  console.error("[MCP] Initializing transition graph...");
  await ensureTransitionGraphInitialized();
  console.error("[MCP] Transition graph ready");

  // Stdio transport (default, for Claude Code)
  const stdioServer = createMcpServer();
  const stdioTransport = new StdioServerTransport();
  await stdioServer.connect(stdioTransport);
  console.error("[MCP] Stdio transport connected");

  // HTTP transport (optional, for Claude.ai via remote MCP)
  if (HTTP_PORT > 0) {
    // Track transports by session for stateful connections
    const sessions = new Map<string, StreamableHTTPServerTransport>();

    const httpServer = createServer(async (req, res) => {
      // CORS headers for remote MCP clients
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url !== "/mcp") {
        res.writeHead(req.url === "/" ? 200 : 404, { "Content-Type": "text/plain" });
        res.end(req.url === "/" ? "Flow Arts Knowledge MCP Server" : "Not found");
        return;
      }

      // Check for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId)!;
      } else if (!sessionId && req.method === "POST") {
        // New session — create a new server + transport pair
        const sessionServer = createMcpServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
            console.error(`[MCP-HTTP] Session ${transport.sessionId} closed`);
          }
        };

        await sessionServer.connect(transport);
      } else if (sessionId) {
        // Session ID provided but not found — may have expired
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Bad request — missing session" }));
        return;
      }

      await transport.handleRequest(req, res);

      // Store session after handleRequest assigns the ID
      if (transport.sessionId && !sessions.has(transport.sessionId)) {
        sessions.set(transport.sessionId, transport);
        console.error(`[MCP-HTTP] New session: ${transport.sessionId}`);
      }
    });

    httpServer.listen(HTTP_PORT, () => {
      console.error(`[MCP-HTTP] Listening on http://localhost:${HTTP_PORT}/mcp`);
    });
  }

  console.error("[MCP] Server connected and ready");
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});
