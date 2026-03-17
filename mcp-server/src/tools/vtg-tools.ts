/**
 * VTG (Vulcan Tech Gospel) Domain Tools
 *
 * Tools for querying VTG knowledge: categories, shapes, patterns,
 * transitions, contributors, cross-domain mappings, and free-text search.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Contributor, ExternalReference } from "@flow-arts/core";
import type { MinimalBeatShape, VTGCategory } from "@vtg/domain";
import {
  getVTGCategory,
  listVTGCategories,
  getVTGShape,
  listVTGShapes,
  getVTGPattern,
  getVTGPatterns,
  getVTGTransition,
  getTransitionsFrom,
  getTransitionBetween,
  vtgToTKA,
  tkaToVTG,
  searchVTG,
  VTG_CONTRIBUTORS,
  VTG_GLOSSARY,
  VTG_DOCUMENTS,
  VTG_ELEMENTS,
} from "@vtg/domain";

export function registerVTGTools(server: McpServer): void {
  // Tool: get_vtg_category
  server.tool(
    "get_vtg_category",
    "Get detailed information about a VTG timing/direction category. Categories: ss (Split-Same), ts (Together-Same), so (Split-Opposite), to (Together-Opposite), quarter-same, quarter-opp.",
    {
      id: z.string().describe("Category ID: 'ss', 'ts', 'so', 'to', 'quarter-same', or 'quarter-opp'"),
    },
    async ({ id }) => {
      const category = getVTGCategory(id);
      if (!category) {
        return {
          content: [{ type: "text" as const, text: `No VTG category found for "${id}". Valid IDs: ss, ts, so, to, quarter-same, quarter-opp.` }],
        };
      }
      const lines = [
        `## ${category.name} (${category.abbreviation})`,
        "",
        category.description,
        "",
        `**Timing:** ${category.timing}`,
        `**Direction:** ${category.direction}`,
        `**Source:** ${category.source.sourceRef || category.source.sourceType}`,
      ];
      if (category.tkaLetters && category.tkaLetters.length > 0) {
        lines.push(`**TKA Letters:** ${category.tkaLetters.join(", ")}`);
      }
      if ((category as any).elementalName) {
        lines.push(`**Elemental Name:** ${(category as any).elementalName}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // Tool: list_vtg_categories
  server.tool(
    "list_vtg_categories",
    "List all VTG timing/direction categories with their abbreviations and descriptions.",
    {},
    async () => {
      const categories = listVTGCategories();
      const lines = ["## VTG Timing/Direction Categories", ""];
      for (const c of categories) {
        const source = c.source.sourceType === "document" ? "(VTG V1)" : "(community extension)";
        lines.push(`**${c.abbreviation} - ${c.name}** ${source}`);
        lines.push(`  Timing: ${c.timing}, Direction: ${c.direction}`);
        if ((c as any).elementalName) lines.push(`  Element: ${(c as any).elementalName}`);
        lines.push("");
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // Tool: get_vtg_shape
  server.tool(
    "get_vtg_shape",
    "Get information about one of VTG's 10 minimal beat shapes. Examples: 'isolation', 'extension', 'vertical-antispin', 'ext-vanti'.",
    {
      id: z.string().describe("Shape ID (e.g., 'isolation', 'extension', 'vertical-antispin', 'horizontal-antispin', 'ext-vanti', 'ext-hanti', 'iso-ext', 'vanti-iso', 'hanti-iso', 'vanti-hanti')"),
    },
    async ({ id }) => {
      const shape = getVTGShape(id);
      if (!shape) {
        const allShapes = listVTGShapes();
        const ids = allShapes.map((s: MinimalBeatShape) => s.id).join(", ");
        return {
          content: [{ type: "text" as const, text: `No VTG shape found for "${id}". Valid IDs: ${ids}` }],
        };
      }
      const lines = [
        `## ${shape.name}`,
        "",
        shape.description,
        "",
        `**Source:** ${shape.source.sourceRef || shape.source.sourceType}`,
      ];
      if (shape.aliases && shape.aliases.length > 0) {
        lines.push(`**Also known as:** ${shape.aliases.join(", ")}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // Tool: get_vtg_pattern
  server.tool(
    "get_vtg_pattern",
    "Look up a specific VTG pattern by shape and category. There are 40 base patterns (10 shapes x 4 categories).",
    {
      shapeId: z.string().describe("Shape ID (e.g., 'extension', 'isolation')"),
      categoryId: z.string().describe("Category ID (e.g., 'ss', 'ts', 'so', 'to')"),
    },
    async ({ shapeId, categoryId }) => {
      const matches = getVTGPatterns({ shapeId, categoryId });
      const pattern = matches[0];
      if (!pattern) {
        return {
          content: [{ type: "text" as const, text: `No VTG pattern found for shape "${shapeId}" + category "${categoryId}".` }],
        };
      }
      const lines = [
        `## ${pattern.name}`,
        "",
        pattern.description,
        "",
        `**Shape:** ${pattern.shapeId}`,
        `**Category:** ${pattern.categoryId}`,
      ];
      if (pattern.aliases && pattern.aliases.length > 0) {
        lines.push(`**Also known as:** ${pattern.aliases.join(", ")}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // Tool: get_vtg_transition
  server.tool(
    "get_vtg_transition",
    "Get information about a VTG transition type (soft, hard, mixed-1, mixed-2) from Transition Theory by Noel Yee and Jordan Campbell.",
    {
      id: z.string().describe("Transition type: 'soft', 'hard', 'mixed-1', or 'mixed-2'"),
    },
    async ({ id }) => {
      const transition = getVTGTransition(id);
      if (!transition) {
        return {
          content: [{ type: "text" as const, text: `No VTG transition found for "${id}". Valid IDs: soft, hard, mixed-1, mixed-2.` }],
        };
      }
      const lines = [
        `## ${transition.name}`,
        "",
        transition.description,
        "",
        `**Hand behavior:** ${transition.handBehavior}`,
        `**Prop behavior:** ${transition.propBehavior}`,
        `**Source:** ${transition.source.sourceRef || transition.source.sourceType}`,
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // Tool: get_vtg_transition_between
  server.tool(
    "get_vtg_transition_between",
    "Find which transition type moves between two VTG categories. Example: 'ss' to 'to' requires a specific transition type.",
    {
      from: z.string().describe("Starting category ID (e.g., 'ss')"),
      to: z.string().describe("Target category ID (e.g., 'to')"),
    },
    async ({ from, to }) => {
      const result = getTransitionBetween(from, to);
      if (!result) {
        return {
          content: [{ type: "text" as const, text: `No transition found from "${from}" to "${to}".` }],
        };
      }
      return {
        content: [{ type: "text" as const, text: `**${from.toUpperCase()} → ${to.toUpperCase()}:** Use a **${result.transitionType}** transition. (Changes: ${result.whatChanges})` }],
      };
    }
  );

  // Tool: vtg_to_tka
  server.tool(
    "vtg_to_tka",
    "Translate a VTG category to its TKA letter mapping. Shows which TKA letters correspond to a VTG timing/direction category.",
    {
      categoryId: z.string().describe("VTG category ID (e.g., 'ss', 'ts', 'quarter-same')"),
    },
    async ({ categoryId }) => {
      const mapping = vtgToTKA(categoryId);
      if (!mapping) {
        return {
          content: [{ type: "text" as const, text: `No TKA mapping found for VTG category "${categoryId}".` }],
        };
      }
      return {
        content: [{ type: "text" as const, text: `**VTG ${mapping.vtgCategory.name} (${mapping.vtgCategory.abbreviation})** → TKA Letters: **${mapping.tkaLetterTypes.join(", ")}**${mapping.notes ? `\n\n${mapping.notes}` : ""}` }],
      };
    }
  );

  // Tool: tka_to_vtg
  server.tool(
    "tka_to_vtg",
    "Translate a TKA letter to its VTG classification. Shows which VTG timing/direction category a TKA letter belongs to.",
    {
      letter: z.string().describe("TKA letter (e.g., 'A', 'G', 'M', 'S')"),
    },
    async ({ letter }) => {
      const categories = tkaToVTG(letter);
      if (!categories || categories.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No VTG mapping found for TKA letter "${letter}". This letter may not be a Type 1 letter.` }],
        };
      }
      const cat = categories[0]!;
      return {
        content: [{ type: "text" as const, text: `**TKA letter ${letter}** → VTG: **${cat.name}** (${cat.abbreviation})${(cat as any).elementalName ? `\n\nElement: ${(cat as any).elementalName}` : ""}` }],
      };
    }
  );

  // Tool: search_vtg
  server.tool(
    "search_vtg",
    "Free-text search across all VTG knowledge: categories, shapes, patterns, glossary terms, contributors. Returns ranked results.",
    {
      query: z.string().describe("Search query (e.g., 'butterfly', 'transition', 'Noel Yee', 'antispin')"),
      maxResults: z.number().optional().default(10).describe("Maximum results to return (default: 10)"),
    },
    async ({ query, maxResults = 10 }) => {
      const results = searchVTG(query);
      const limited = results.slice(0, maxResults);

      if (limited.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No VTG results found for "${query}".` }],
        };
      }

      const lines = [`## VTG Search: "${query}" (${limited.length} results)`, ""];
      for (const r of limited) {
        lines.push(`**[${r.type}] ${r.name}** (relevance: ${r.score})`);
        lines.push(`  ${r.summary.substring(0, 150)}${r.summary.length > 150 ? "..." : ""}`);
        lines.push("");
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // Tool: get_vtg_contributor
  server.tool(
    "get_vtg_contributor",
    "Get information about a person who contributed to VTG or related flow arts theory.",
    {
      name: z.string().describe("Person's name (e.g., 'Noel Yee', 'Lorq Nichols', 'Jordan Campbell')"),
    },
    async ({ name }) => {
      const query = name.toLowerCase();
      const contributor = VTG_CONTRIBUTORS.find((c: Contributor) =>
        c.name.toLowerCase().includes(query) ||
        c.aliases?.some((a: string) => a.toLowerCase().includes(query))
      );
      if (!contributor) {
        const names = VTG_CONTRIBUTORS.map((c: Contributor) => c.name).join(", ");
        return {
          content: [{ type: "text" as const, text: `No contributor found for "${name}". Known contributors: ${names}` }],
        };
      }
      const lines = [
        `## ${contributor.name}`,
        "",
        `**Role:** ${contributor.role}`,
      ];
      if (contributor.aliases && contributor.aliases.length > 0) {
        lines.push(`**Also known as:** ${contributor.aliases.join(", ")}`);
      }
      lines.push(`**Contributions:** ${contributor.contributions.join("; ")}`);
      if (contributor.activeYears) lines.push(`**Active:** ${contributor.activeYears}`);
      if (contributor.links && contributor.links.length > 0) {
        lines.push(`**Links:** ${contributor.links.map((l: ExternalReference) => l.url).join(", ")}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );
}
