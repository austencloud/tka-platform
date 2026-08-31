import { describe, expect, it } from "vitest";
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
});
