import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEducationalTools } from "../src/tools/educational-tools.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

type ToolHandler = (input: { term: string }) => Promise<ToolResult>;

function getTermHandler(): ToolHandler {
  let handler: ToolHandler | undefined;
  const server = {
    tool(name: string, ...args: unknown[]) {
      if (name === "get_term_definition") {
        handler = args.at(-1) as ToolHandler;
      }
    },
  } as unknown as McpServer;

  registerEducationalTools(server);
  if (!handler) throw new Error("get_term_definition was not registered");
  return handler;
}

describe("canonical hand terminology", () => {
  const getTermDefinition = getTermHandler();

  it("defines blue as the left hand without inventing a lead role", async () => {
    const result = await getTermDefinition({ term: "blue" });
    const text = result.content[0]?.text ?? "";

    expect(text).toContain("performer's left hand");
    expect(text.toLowerCase()).not.toContain("lead hand");
  });

  it("defines red as the right hand without inventing a follow role", async () => {
    const result = await getTermDefinition({ term: "red" });
    const text = result.content[0]?.text ?? "";

    expect(text).toContain("performer's right hand");
    expect(text.toLowerCase()).not.toContain("follow hand");
    expect(text.toLowerCase()).not.toContain("following hand");
  });

  it("ships the same definitions and aliases in the standalone MCP package", () => {
    const glossary = JSON.parse(
      readFileSync(resolve("../mcp-server-pkg/data/tka-glossary.json"), "utf8")
    ) as Record<string, { definition?: string }>;
    const aliases = JSON.parse(
      readFileSync(
        resolve("../mcp-server-pkg/data/tka-term-aliases.json"),
        "utf8"
      )
    ) as Record<string, string>;

    expect(glossary.blue?.definition).toContain("performer's left hand");
    expect(glossary.red?.definition).toContain("performer's right hand");
    expect(glossary.turns?.definition).toContain("turns = (P/H - 1) / 2");
    expect(glossary.turns?.definition).toContain("-0.25 for 2:1");
    expect(glossary.turns?.definition).toContain("exceptional 1:0 ratio");
    expect(JSON.stringify({ glossary, aliases }).toLowerCase()).not.toContain(
      "lead hand"
    );
    expect(JSON.stringify({ glossary, aliases }).toLowerCase()).not.toContain(
      "follow hand"
    );
    expect(aliases["left hand"]).toBe("left-hand");
    expect(aliases["right hand"]).toBe("right-hand");
  });
});
