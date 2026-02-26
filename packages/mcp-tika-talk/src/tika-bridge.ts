/**
 * TIKA Bridge
 *
 * Instantiates the TIKA server container and exposes its tools
 * for use by MCP tool handlers. Imports directly from the app's
 * source tree — tsx resolves these at runtime without a build step.
 */

import { tool, jsonSchema, generateText, stepCountIs, type LanguageModel } from "ai";
import {
  deriveUserOverlay,
  getTypeComparison,
  getPositionComparison,
  getMotionTypeComparison,
  getRotationExplanation,
  getGridModeExplanation,
  getVTGMapping,
  getAlphabetOverview,
  getCommonAnswer,
  getTypeNamingOrigin,
  findDomainTopic,
  listDomainTopics,
} from "@tka/domain";
import {
  getTikaServerContainer,
  type TikaServerContainer,
} from "../../../src/lib/features/tika/services/server/tika-server-container";
import { buildSystemPrompt } from "../../../src/lib/features/tika/ai/system-prompts";
import {
  toDisplayOutput,
  filterLetterExplanation,
  filterTypeList,
  filterComparison,
  filterQuiz,
} from "../../../src/lib/features/tika/validation/output-filter";
import {
  validateResponse,
} from "../../../src/lib/features/tika/validation/TikaResponseValidator";
import { TikaCapabilityLookup } from "../../../src/lib/features/tika/services/implementations/TikaCapabilityLookup";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TikaBridge {
  /** Execute a single tool by name and return filtered output */
  executeTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  /** Build Vercel AI SDK tool definitions (same as +server.ts) */
  createTools(): ReturnType<typeof buildTools>;
  /** Build system prompt for a given level */
  buildPrompt(level?: number): string;
  /** Get a language model by key */
  getModel(key?: string): LanguageModel;
  /** Run full LLM round-trip and return diagnostics */
  ask(message: string, options?: AskOptions): Promise<AskResult>;
  /** Access the raw container */
  container: TikaServerContainer;
}

export interface AskOptions {
  level?: number;
  model?: string;
  steps?: number;
}

export interface AskResult {
  text: string;
  toolsCalled: Array<{ name: string; args: Record<string, unknown> }>;
  inlineContentCount: number;
  hasJsonLeak: boolean;
  responseLength: number;
  validation: {
    passed: boolean;
    errorCount: number;
    warningCount: number;
    violations: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════════════════

export function initializeBridge(): TikaBridge {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    console.error("[tika-talk] WARNING: ANTHROPIC_API_KEY not set");
  }

  const container = getTikaServerContainer({
    anthropicApiKey: apiKey,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  });

  return {
    executeTool: (name, args) => executeTool(container, name, args),
    createTools: () => buildTools(container),
    buildPrompt: (level = 1) => {
      const overlay = deriveUserOverlay([]);
      overlay.majorLevel = level as 1 | 2 | 3;
      return buildSystemPrompt(overlay, "en");
    },
    getModel: (key = "haiku") => container.modelProvider.getModel(key),
    ask: (message, options) => runAsk(container, message, options),
    container,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution (direct, no LLM)
// ═══════════════════════════════════════════════════════════════════════════

async function executeTool(
  container: TikaServerContainer,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { toolExecutor, sequenceValidator, quizGenerator } = container;

  switch (name) {
    case "get_letter_explanation":
      return filterLetterExplanation(
        toolExecutor.getLetterExplanation(
          args.letter as string,
          (args.variation as number) ?? 0,
          (args.gridMode as "diamond" | "box") ?? "diamond"
        )
      );

    case "get_term_definition":
      return toDisplayOutput(toolExecutor.getTermDefinition(args.term as string));

    case "compare_letters":
      return filterComparison(
        toolExecutor.compareLetters(args.letter1 as string, args.letter2 as string)
      );

    case "list_letters_by_type":
      return filterTypeList(toolExecutor.listLettersByType(args.type as number));

    case "compare_positions":
      return getPositionComparison(args.position1 as string, args.position2 as string);

    case "compare_types":
      return getTypeComparison(args.type1 as number, args.type2 as number);

    case "compare_motion_types":
      return getMotionTypeComparison(args.motion1 as string, args.motion2 as string);

    case "get_rotation_info":
      return getRotationExplanation(args.rotation as string);

    case "get_grid_mode":
      return getGridModeExplanation(args.mode as string);

    case "get_vtg_mapping":
      return getVTGMapping(args.vtg_term as string);

    case "get_alphabet_overview":
      return getAlphabetOverview();

    case "answer_common_question": {
      const answer = getCommonAnswer(args.question as string);
      return answer || `No canonical answer found for "${args.question}".`;
    }

    case "get_type_naming_origin":
      return getTypeNamingOrigin(args.type as number);

    case "show_position_examples":
      return toolExecutor.showPositionExamples(args.position as string);

    case "show_motion_examples":
      return toolExecutor.showMotionExamples(
        args.motionType as string,
        (args.hand as "blue" | "red" | "both") ?? "both"
      );

    case "explain_sequence":
      return toolExecutor.explainSequence(args.word as string);

    case "validate_sequence": {
      const word = (args.word as string).toUpperCase();
      const letters = sequenceValidator.parseWordToLetters(word);
      if (letters.length === 0) {
        return { isValid: false, explanation: `No valid letters in "${word}"` };
      }
      for (const letter of letters) {
        if (!sequenceValidator.isValidLetter(letter)) {
          return { isValid: false, explanation: `Invalid letter "${letter}".` };
        }
      }
      if (letters.length === 1) {
        return { isValid: true, word: letters[0], explanation: `Single letter always valid.` };
      }
      const result = sequenceValidator.validateChaining(letters);
      return {
        isValid: result.isValid,
        word: result.word,
        explanation: result.explanation,
        invalidTransitions: result.invalidTransitions.length > 0 ? result.invalidTransitions : undefined,
        interpolatedSequence: result.interpolatedSequence,
        canBeInterpolated: !!result.interpolatedSequence,
      };
    }

    case "show_sequence_steps":
      return toolExecutor.showSequenceSteps(args.word as string);

    case "generate_quiz": {
      const quizType = args.quizType as string ?? "multiple-choice";
      const mapped: "pick-letter" | "pick-type" | "odd-one-out" | "match-motion" | "true-false" =
        quizType === "true-false" ? "true-false" : "pick-letter";
      return filterQuiz(
        quizGenerator.generateQuiz(
          args.topic as string,
          mapped,
          (args.difficulty as "easy" | "medium" | "hard") ?? "medium"
        )
      );
    }

    case "get_domain_topic": {
      const found = findDomainTopic(args.query as string);
      if (found) {
        return { found: true, key: found.key, title: found.title, content: found.content };
      }
      const available = listDomainTopics().map((t: { key: string; title: string }) => `${t.key}: ${t.title}`);
      return { found: false, message: `No topic for "${args.query}". Available: ${available.join(", ")}` };
    }

    case "find_app_feature": {
      const lookup = new TikaCapabilityLookup();
      const matches = lookup.findCapabilities(args.query as string, 3);
      if (matches.length === 0) {
        return { found: false, message: `No feature found for "${args.query}".` };
      }
      return {
        found: true,
        results: matches.map((m: { capability: { action: string; tab?: string; module: string; instructions: string }; relevance: number }) => ({
          action: m.capability.action,
          location: m.capability.tab
            ? `${m.capability.module} > ${m.capability.tab}`
            : m.capability.module,
          instructions: m.capability.instructions,
          relevance: m.relevance,
        })),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SDK Tool Definitions (mirrors +server.ts createTikaTools)
// ═══════════════════════════════════════════════════════════════════════════

function buildTools(container: TikaServerContainer) {
  const { toolExecutor, sequenceValidator, quizGenerator } = container;

  return {
    get_letter_explanation: tool({
      description: "Get pictograph data and explanation for a specific TKA letter.",
      inputSchema: jsonSchema<{ letter: string; variation?: number; gridMode?: string }>({
        type: "object",
        properties: {
          letter: { type: "string", description: "The letter (A-Z or Greek)" },
          variation: { type: "number", default: 0 },
          gridMode: { type: "string", enum: ["diamond", "box"], default: "diamond" },
        },
        required: ["letter"],
      }),
      execute: async ({ letter, variation = 0, gridMode = "diamond" }) =>
        filterLetterExplanation(toolExecutor.getLetterExplanation(letter, variation, gridMode as "diamond" | "box")),
    }),

    get_term_definition: tool({
      description: "Get the definition of a TKA glossary term.",
      inputSchema: jsonSchema<{ term: string }>({
        type: "object",
        properties: { term: { type: "string" } },
        required: ["term"],
      }),
      execute: async ({ term }) => toDisplayOutput(toolExecutor.getTermDefinition(term)),
    }),

    compare_letters: tool({
      description: "Compare two TKA letters side by side.",
      inputSchema: jsonSchema<{ letter1: string; letter2: string }>({
        type: "object",
        properties: {
          letter1: { type: "string" },
          letter2: { type: "string" },
        },
        required: ["letter1", "letter2"],
      }),
      execute: async ({ letter1, letter2 }) =>
        filterComparison(toolExecutor.compareLetters(letter1, letter2)),
    }),

    list_letters_by_type: tool({
      description: "List all letters of a specific type (1-6).",
      inputSchema: jsonSchema<{ type: number }>({
        type: "object",
        properties: {
          type: { type: "number", minimum: 1, maximum: 6 },
        },
        required: ["type"],
      }),
      execute: async ({ type }) => filterTypeList(toolExecutor.listLettersByType(type)),
    }),

    compare_positions: tool({
      description: "Compare two TKA positions.",
      inputSchema: jsonSchema<{ position1: string; position2: string }>({
        type: "object",
        properties: {
          position1: { type: "string" },
          position2: { type: "string" },
        },
        required: ["position1", "position2"],
      }),
      execute: async ({ position1, position2 }) => getPositionComparison(position1, position2),
    }),

    compare_types: tool({
      description: "Compare two letter types.",
      inputSchema: jsonSchema<{ type1: number; type2: number }>({
        type: "object",
        properties: {
          type1: { type: "number", minimum: 1, maximum: 6 },
          type2: { type: "number", minimum: 1, maximum: 6 },
        },
        required: ["type1", "type2"],
      }),
      execute: async ({ type1, type2 }) => getTypeComparison(type1, type2),
    }),

    compare_motion_types: tool({
      description: "Compare two motion types.",
      inputSchema: jsonSchema<{ motion1: string; motion2: string }>({
        type: "object",
        properties: {
          motion1: { type: "string" },
          motion2: { type: "string" },
        },
        required: ["motion1", "motion2"],
      }),
      execute: async ({ motion1, motion2 }) => getMotionTypeComparison(motion1, motion2),
    }),

    get_rotation_info: tool({
      description: "Get rotation direction explanation.",
      inputSchema: jsonSchema<{ rotation: string }>({
        type: "object",
        properties: { rotation: { type: "string" } },
        required: ["rotation"],
      }),
      execute: async ({ rotation }) => getRotationExplanation(rotation),
    }),

    get_grid_mode: tool({
      description: "Get grid mode explanation.",
      inputSchema: jsonSchema<{ mode: string }>({
        type: "object",
        properties: { mode: { type: "string" } },
        required: ["mode"],
      }),
      execute: async ({ mode }) => getGridModeExplanation(mode),
    }),

    get_vtg_mapping: tool({
      description: "Get TKA letters for a VTG term.",
      inputSchema: jsonSchema<{ vtg_term: string }>({
        type: "object",
        properties: { vtg_term: { type: "string" } },
        required: ["vtg_term"],
      }),
      execute: async ({ vtg_term }) => getVTGMapping(vtg_term),
    }),

    get_alphabet_overview: tool({
      description: "Get complete TKA alphabet overview.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => getAlphabetOverview(),
    }),

    answer_common_question: tool({
      description: "Answer common conceptual questions about TKA.",
      inputSchema: jsonSchema<{ question: string }>({
        type: "object",
        properties: { question: { type: "string" } },
        required: ["question"],
      }),
      execute: async ({ question }) => {
        const answer = getCommonAnswer(question);
        return answer || `No canonical answer found for "${question}".`;
      },
    }),

    get_type_naming_origin: tool({
      description: "Explain why a type has its name.",
      inputSchema: jsonSchema<{ type: number }>({
        type: "object",
        properties: { type: { type: "number", minimum: 1, maximum: 6 } },
        required: ["type"],
      }),
      execute: async ({ type }) => getTypeNamingOrigin(type),
    }),

    show_position_examples: tool({
      description: "Show visual examples for a position.",
      inputSchema: jsonSchema<{ position: string }>({
        type: "object",
        properties: { position: { type: "string" } },
        required: ["position"],
      }),
      execute: async ({ position }) => toolExecutor.showPositionExamples(position),
    }),

    show_motion_examples: tool({
      description: "Show visual examples for a motion type.",
      inputSchema: jsonSchema<{ motionType: string; hand?: "blue" | "red" | "both" }>({
        type: "object",
        properties: {
          motionType: { type: "string" },
          hand: { type: "string", enum: ["blue", "red", "both"], default: "both" },
        },
        required: ["motionType"],
      }),
      execute: async ({ motionType, hand = "both" }) =>
        toolExecutor.showMotionExamples(motionType, hand),
    }),

    explain_sequence: tool({
      description: "Generate and visualize a TKA sequence.",
      inputSchema: jsonSchema<{ word: string }>({
        type: "object",
        properties: { word: { type: "string" } },
        required: ["word"],
      }),
      execute: async ({ word }) => toolExecutor.explainSequence(word),
    }),

    validate_sequence: tool({
      description: "Validate if letters can chain into a valid sequence.",
      inputSchema: jsonSchema<{ word: string }>({
        type: "object",
        properties: { word: { type: "string" } },
        required: ["word"],
      }),
      execute: async ({ word }) => {
        const letters = sequenceValidator.parseWordToLetters(word.toUpperCase());
        if (letters.length === 0) return { isValid: false, explanation: `No valid letters in "${word}"` };
        for (const l of letters) {
          if (!sequenceValidator.isValidLetter(l)) return { isValid: false, explanation: `Invalid letter "${l}".` };
        }
        if (letters.length === 1) return { isValid: true, word: letters[0], explanation: "Single letter always valid." };
        const r = sequenceValidator.validateChaining(letters);
        return {
          isValid: r.isValid, word: r.word, explanation: r.explanation,
          invalidTransitions: r.invalidTransitions.length > 0 ? r.invalidTransitions : undefined,
          interpolatedSequence: r.interpolatedSequence,
          canBeInterpolated: !!r.interpolatedSequence,
        };
      },
    }),

    show_sequence_steps: tool({
      description: "Show sequence broken into individual pictographs.",
      inputSchema: jsonSchema<{ word: string }>({
        type: "object",
        properties: { word: { type: "string" } },
        required: ["word"],
      }),
      execute: async ({ word }) => toolExecutor.showSequenceSteps(word),
    }),

    generate_quiz: tool({
      description: "Generate an interactive quiz.",
      inputSchema: jsonSchema<{ topic: string; quizType?: string; difficulty?: string }>({
        type: "object",
        properties: {
          topic: { type: "string" },
          quizType: { type: "string", enum: ["multiple-choice", "identify-letter", "true-false"] },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["topic"],
      }),
      execute: async ({ topic, quizType = "multiple-choice", difficulty = "medium" }) => {
        const mapped: "pick-letter" | "true-false" =
          quizType === "true-false" ? "true-false" : "pick-letter";
        return filterQuiz(quizGenerator.generateQuiz(topic, mapped, difficulty as "easy" | "medium" | "hard"));
      },
    }),

    get_domain_topic: tool({
      description: "Look up deep theoretical TKA topics.",
      inputSchema: jsonSchema<{ query: string }>({
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      }),
      execute: async ({ query }) => {
        const result = findDomainTopic(query);
        if (result) return { found: true, key: result.key, title: result.title, content: result.content };
        const available = listDomainTopics().map((t: { key: string; title: string }) => `${t.key}: ${t.title}`);
        return { found: false, message: `No topic for "${query}". Available: ${available.join(", ")}` };
      },
    }),

    find_app_feature: tool({
      description: "Find how to do something in TKA Scribe.",
      inputSchema: jsonSchema<{ query: string }>({
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      }),
      execute: async ({ query }) => {
        const lookup = new TikaCapabilityLookup();
        const matches = lookup.findCapabilities(query, 3);
        if (matches.length === 0) return { found: false, message: `No feature for "${query}".` };
        return {
          found: true,
          results: matches.map((m: { capability: { action: string; tab?: string; module: string; instructions: string }; relevance: number }) => ({
            action: m.capability.action,
            location: m.capability.tab ? `${m.capability.module} > ${m.capability.tab}` : m.capability.module,
            instructions: m.capability.instructions,
            relevance: m.relevance,
          })),
        };
      },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Full LLM Round-Trip
// ═══════════════════════════════════════════════════════════════════════════

/** Regex to detect JSON objects leaked into response text */
const JSON_LEAK_PATTERN = /\{[\s\S]*?"(?:type|explanation|contextData|inlinePictograph|startPosition|endPosition|blueMotion|redMotion)"[\s\S]*?\}/;

/** Count inline content markers in tool results */
function countInlineContent(steps: Array<{ toolResults: Array<{ output: unknown }> }>): number {
  let count = 0;
  for (const step of steps) {
    for (const result of step.toolResults) {
      const text = JSON.stringify(result.output);
      const markers = ["inline-pictograph", "inline-gallery", "inline-sequence-player", "inline-step-grid", "inline-quiz"];
      for (const marker of markers) {
        if (text.includes(marker)) count++;
      }
    }
  }
  return count;
}

async function runAsk(
  container: TikaServerContainer,
  message: string,
  options: AskOptions = {}
): Promise<AskResult> {
  const { level = 1, model: modelKey = "haiku", steps = 6 } = options;

  const overlay = deriveUserOverlay([]);
  overlay.majorLevel = level as 1 | 2 | 3;
  const systemPrompt = buildSystemPrompt(overlay, "en");
  const languageModel = container.modelProvider.getModel(modelKey);
  const tools = buildTools(container);

  const result = await generateText({
    model: languageModel,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
    tools,
    stopWhen: stepCountIs(steps),
  });

  const text = result.text || "";
  const toolsCalled: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      toolsCalled.push({
        name: call.toolName,
        args: ("input" in call ? call.input : {}) as Record<string, unknown>,
      });
    }
  }

  const inlineContentCount = countInlineContent(
    result.steps.map((s) => ({
      toolResults: s.toolResults.map((r) => ({
        output: "output" in r ? r.output : undefined,
      })),
    }))
  );

  const hasJsonLeak = JSON_LEAK_PATTERN.test(text);

  // Run validation
  const report = validateResponse(
    text,
    message,
    toolsCalled.map((t) => t.name)
  );

  return {
    text,
    toolsCalled,
    inlineContentCount,
    hasJsonLeak,
    responseLength: text.length,
    validation: {
      passed: report.passed,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      violations: report.violations.map(
        (v: { severity: string; validatorName: string; message: string }) =>
          `[${v.severity}] ${v.validatorName}: ${v.message}`
      ),
    },
  };
}
