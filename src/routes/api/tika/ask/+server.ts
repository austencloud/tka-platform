/**
 * TIKA Ask API Endpoint (AI SDK Streaming)
 *
 * Server-side endpoint for the TIKA AI assistant using Vercel AI SDK.
 * Streams responses word-by-word for modern chat UX.
 *
 * Uses extracted services for:
 * - Data loading (TikaPictographLoader)
 * - Sequence validation (TikaSequenceValidator)
 * - Sequence generation (TikaSequenceGenerator)
 * - Quiz generation (TikaQuizGenerator)
 * - Tool execution (TikaToolExecutor)
 * - Model selection (TikaModelProvider)
 */

import type { RequestHandler } from "@sveltejs/kit";
import { streamText, tool, convertToModelMessages, type UIMessage, jsonSchema } from "ai";
import { env } from "$env/dynamic/private";
import { buildSystemPrompt } from "$lib/features/tika/ai/system-prompts";
import type { MasteryContext } from "$lib/features/learn/domain/quiz-history-types";
import {
  deriveUserOverlay,
  getTypeComparison,
  getTypeExplanation,
  getPositionExplanation,
  getPositionComparison,
  getMotionTypeExplanation,
  getMotionTypeComparison,
  getRotationExplanation,
  getGridModeExplanation,
  getVTGMapping,
  getAlphabetOverview,
  getCommonAnswer,
  getTypeNamingOrigin,
} from "@tka/domain";
import {
  toDisplayOutput,
  filterLetterExplanation,
  filterTypeList,
  filterComparison,
  filterSequence,
  filterQuiz,
} from "$lib/features/tika/validation/output-filter";
import { getTikaServerContainer } from "$lib/features/tika/services/server/tika-server-container";

// ═══════════════════════════════════════════════════════════════════════════
// Container & Services
// ═══════════════════════════════════════════════════════════════════════════

function getContainer() {
  return getTikaServerContainer({
    anthropicApiKey: env.ANTHROPIC_API_KEY || "",
    deepseekApiKey: env.DEEPSEEK_API_KEY || "",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SDK Tools Definition
// ═══════════════════════════════════════════════════════════════════════════

function createTikaTools() {
  const container = getContainer();
  const { toolExecutor, sequenceValidator, sequenceGenerator, quizGenerator } = container;

  return {
    get_letter_explanation: tool({
      description:
        "MANDATORY for ANY question about a specific letter (A-Z, Greek letters). Returns pictograph data and detailed explanation. ALWAYS use this for \"What is X?\", \"Tell me about X\", \"Explain X\" where X is a letter.",
      inputSchema: jsonSchema<{ letter: string; variation?: number }>({
        type: "object",
        properties: {
          letter: { type: "string", description: "The letter to explain (A-Z or Greek)" },
          variation: { type: "number", description: "Variation index (0-based)", default: 0 },
        },
        required: ["letter"],
      }),
      execute: async ({ letter, variation = 0 }) =>
        filterLetterExplanation(toolExecutor.getLetterExplanation(letter, variation)),
    }),

    get_term_definition: tool({
      description:
        "Get the definition of a TKA domain term like alpha, pro, shift, static, beta, gamma, etc. Use this when asked what a term means.",
      inputSchema: jsonSchema<{ term: string }>({
        type: "object",
        properties: {
          term: { type: "string", description: "The term to define" },
        },
        required: ["term"],
      }),
      execute: async ({ term }) => toDisplayOutput(toolExecutor.getTermDefinition(term)),
    }),

    compare_letters: tool({
      description:
        "Compare two TKA letters side by side, explaining their differences. Use this when asked to compare or contrast letters.",
      inputSchema: jsonSchema<{ letter1: string; letter2: string }>({
        type: "object",
        properties: {
          letter1: { type: "string", description: "First letter to compare" },
          letter2: { type: "string", description: "Second letter to compare" },
        },
        required: ["letter1", "letter2"],
      }),
      execute: async ({ letter1, letter2 }) =>
        filterComparison(toolExecutor.compareLetters(letter1, letter2)),
    }),

    list_letters_by_type: tool({
      description:
        'MANDATORY for questions about letter types ("Type X letters", "Tell me about Type X", "What are Type X letters"). Returns visual gallery of example letters. ALWAYS use this instead of describing types in text.',
      inputSchema: jsonSchema<{ type: number }>({
        type: "object",
        properties: {
          type: {
            type: "number",
            minimum: 1,
            maximum: 6,
            description:
              "Letter type 1-6: 1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static",
          },
        },
        required: ["type"],
      }),
      execute: async ({ type }) => filterTypeList(toolExecutor.listLettersByType(type)),
    }),

    compare_positions: tool({
      description:
        "Compare two TKA positions (alpha, beta, gamma, etc). Use when asked about differences between positions.",
      inputSchema: jsonSchema<{ position1: string; position2: string }>({
        type: "object",
        properties: {
          position1: { type: "string", description: "First position name" },
          position2: { type: "string", description: "Second position name" },
        },
        required: ["position1", "position2"],
      }),
      execute: async ({ position1, position2 }) => getPositionComparison(position1, position2),
    }),

    compare_types: tool({
      description:
        'MANDATORY for comparing letter types ("Type X vs Type Y", "How do Type X and Type Y differ", "Difference between Type X and Type Y"). ALWAYS use this instead of explaining differences in text.',
      inputSchema: jsonSchema<{ type1: number; type2: number }>({
        type: "object",
        properties: {
          type1: { type: "number", minimum: 1, maximum: 6, description: "First type number (1-6)" },
          type2: { type: "number", minimum: 1, maximum: 6, description: "Second type number (1-6)" },
        },
        required: ["type1", "type2"],
      }),
      execute: async ({ type1, type2 }) => getTypeComparison(type1, type2),
    }),

    compare_motion_types: tool({
      description:
        "Compare two motion types (static, shift, dash). Use when asked about differences between motion types.",
      inputSchema: jsonSchema<{ motion1: string; motion2: string }>({
        type: "object",
        properties: {
          motion1: { type: "string", description: "First motion type" },
          motion2: { type: "string", description: "Second motion type" },
        },
        required: ["motion1", "motion2"],
      }),
      execute: async ({ motion1, motion2 }) => getMotionTypeComparison(motion1, motion2),
    }),

    get_rotation_info: tool({
      description:
        "Get canonical definition of a rotation direction (pro, anti, prospin, antispin, cw, ccw). ALWAYS use this for rotation questions.",
      inputSchema: jsonSchema<{ rotation: string }>({
        type: "object",
        properties: {
          rotation: {
            type: "string",
            description: "Rotation type (pro, anti, prospin, antispin, cw, ccw)",
          },
        },
        required: ["rotation"],
      }),
      execute: async ({ rotation }) => getRotationExplanation(rotation),
    }),

    get_grid_mode: tool({
      description:
        "Get canonical definition of a grid mode (diamond, box, skewed). ALWAYS use this for grid mode questions.",
      inputSchema: jsonSchema<{ mode: string }>({
        type: "object",
        properties: {
          mode: { type: "string", description: "Grid mode (diamond, box, skewed)" },
        },
        required: ["mode"],
      }),
      execute: async ({ mode }) => getGridModeExplanation(mode),
    }),

    get_vtg_mapping: tool({
      description:
        "Get the TKA letters that correspond to a VTG (Vulcan Tech Gospel) term. Use for VTG-to-TKA translation.",
      inputSchema: jsonSchema<{ vtg_term: string }>({
        type: "object",
        properties: {
          vtg_term: {
            type: "string",
            description:
              "VTG term (split-same, tog-same, split-opp, tog-opp, quarter-same, quarter-opp)",
          },
        },
        required: ["vtg_term"],
      }),
      execute: async ({ vtg_term }) => getVTGMapping(vtg_term),
    }),

    get_alphabet_overview: tool({
      description:
        'Get a complete overview of the TKA alphabet - all 6 types, letter counts, and organization. ALWAYS use this when asked "what is TKA" or for alphabet overviews.',
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
      }),
      execute: async () => getAlphabetOverview(),
    }),

    answer_common_question: tool({
      description:
        'Get canonical answer to common TKA questions. Use for: "what is TKA", "what is VTG", "what is a pictograph", "what is a sequence", "what is a loop", "why cross-shift".',
      inputSchema: jsonSchema<{ question: string }>({
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "The question topic (tka, vtg, pictograph, sequence, loop, why cross-shift)",
          },
        },
        required: ["question"],
      }),
      execute: async ({ question }) => {
        const answer = getCommonAnswer(question);
        return answer || `No canonical answer found for "${question}". Use other tools to construct a response.`;
      },
    }),

    get_type_naming_origin: tool({
      description:
        'Explain why a letter type has its name (e.g., why "Cross-Shift" not "Dash-Shift"). ALWAYS use this for "why is it called X" questions about type names.',
      inputSchema: jsonSchema<{ type: number }>({
        type: "object",
        properties: {
          type: { type: "number", minimum: 1, maximum: 6, description: "The type number (1-6)" },
        },
        required: ["type"],
      }),
      execute: async ({ type }) => getTypeNamingOrigin(type),
    }),

    show_position_examples: tool({
      description:
        'MANDATORY for position questions ("What is alpha?", "Tell me about gamma", "Show me beta"). Returns visual pictograph examples using hand props to teach positions. Shows BOTH diamond mode (common) and box mode variations. NEVER explain positions in text alone - always show examples. Uses beginner-friendly language without jargon.',
      inputSchema: jsonSchema<{ position: string }>({
        type: "object",
        properties: {
          position: {
            type: "string",
            description: "Position name (alpha, beta, gamma, zeta, eta)",
          },
        },
        required: ["position"],
      }),
      execute: async ({ position }) => toolExecutor.showPositionExamples(position),
    }),

    show_motion_examples: tool({
      description:
        'MANDATORY for motion type questions ("What is shift?", "Tell me about dash", "Show me static motion"). Returns visual pictograph examples. NEVER explain motion types in text alone - always show examples.',
      inputSchema: jsonSchema<{ motionType: string; hand?: "blue" | "red" | "both" }>({
        type: "object",
        properties: {
          motionType: { type: "string", description: "Motion type (shift, dash, static)" },
          hand: {
            type: "string",
            enum: ["blue", "red", "both"],
            default: "both",
            description: "Which hand to filter by",
          },
        },
        required: ["motionType"],
      }),
      execute: async ({ motionType, hand = "both" }) =>
        toolExecutor.showMotionExamples(motionType, hand),
    }),

    explain_sequence: tool({
      description:
        'MANDATORY for questions about sequences or "words" (multiple letters together). Generates and visualizes a valid TKA sequence. Use for "Show me sequence ABC", "What is the word XYZ", "Animate ABC".',
      inputSchema: jsonSchema<{ word: string }>({
        type: "object",
        properties: {
          word: { type: "string", description: 'The sequence word, e.g., "ABC" or "DEFGH"' },
        },
        required: ["word"],
      }),
      execute: async ({ word }) => toolExecutor.explainSequence(word),
    }),

    validate_sequence: tool({
      description:
        "MANDATORY: Call this BEFORE attempting to generate or display any sequence. Algorithmically validates if letters can chain together based on position groups. Returns detailed explanation of any breaks and suggests bridge letters to fix invalid sequences. Never guess about sequence validity - always call this tool.",
      inputSchema: jsonSchema<{ word: string }>({
        type: "object",
        properties: {
          word: {
            type: "string",
            description: 'The sequence word to validate, e.g., "ABC" or "DEF"',
          },
        },
        required: ["word"],
      }),
      execute: async ({ word }) => {
        try {
          const letters = sequenceValidator.parseWordToLetters(word.toUpperCase());

          if (letters.length === 0) {
            return { isValid: false, explanation: `No valid letters in "${word}"` };
          }

          for (const letter of letters) {
            if (!sequenceValidator.isValidLetter(letter)) {
              return {
                isValid: false,
                explanation: `Invalid letter "${letter}" in sequence. Use valid TKA letters.`,
              };
            }
          }

          if (letters.length === 1) {
            return {
              isValid: true,
              word: letters[0],
              explanation: `Single letter "${letters[0]}" is always valid.`,
            };
          }

          const result = sequenceValidator.validateChaining(letters);

          return {
            isValid: result.isValid,
            word: result.word,
            explanation: result.explanation,
            invalidTransitions:
              result.invalidTransitions.length > 0 ? result.invalidTransitions : undefined,
            interpolatedSequence: result.interpolatedSequence,
            canBeInterpolated: !!result.interpolatedSequence,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { isValid: false, explanation: `Validation error: ${errorMessage}` };
        }
      },
    }),

    show_sequence_steps: tool({
      description:
        "Shows a sequence broken down into individual pictographs with step labels. IMPORTANT: Call validate_sequence first to check if the word is valid. If invalid, explain the validation result to the user instead of calling this tool.",
      inputSchema: jsonSchema<{ word: string; useInterpolation?: boolean }>({
        type: "object",
        properties: {
          word: { type: "string", description: 'The sequence word, e.g., "ABC" or "DEFGH"' },
          useInterpolation: {
            type: "boolean",
            description: "If true and sequence is invalid, use bridge letters to make it valid",
          },
        },
        required: ["word"],
      }),
      execute: async ({ word }) => toolExecutor.showSequenceSteps(word),
    }),

    generate_quiz: tool({
      description:
        "Generate an interactive quiz to test knowledge. Use when the user asks to be quizzed, wants to test their understanding, or after explaining a concept to reinforce learning. Can quiz on letters, types, positions, motion types, or comparisons.",
      inputSchema: jsonSchema<{
        topic: string;
        quizType?: "multiple-choice" | "identify-letter" | "true-false";
        difficulty?: "easy" | "medium" | "hard";
      }>({
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              'Topic to quiz on: letter (e.g., "A"), type (e.g., "type1"), position (e.g., "alpha"), motion (e.g., "shift"), or general TKA concepts',
          },
          quizType: {
            type: "string",
            enum: ["multiple-choice", "identify-letter", "true-false"],
            description: "Type of quiz question",
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
            description: "Difficulty level",
          },
        },
        required: ["topic"],
      }),
      execute: async ({ topic, quizType = "multiple-choice", difficulty = "medium" }) => {
        // Map the incoming quiz type to the expected QuizType
        const mappedQuizType: "pick-letter" | "pick-type" | "odd-one-out" | "match-motion" | "true-false" =
          quizType === "multiple-choice" ? "pick-letter" :
          quizType === "identify-letter" ? "pick-letter" :
          quizType === "true-false" ? "true-false" :
          "pick-letter"; // default fallback

        const result = quizGenerator.generateQuiz(topic, mappedQuizType, difficulty);
        return filterQuiz(result);
      },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Request Handler
// ═══════════════════════════════════════════════════════════════════════════

interface TIKARequest {
  messages?: UIMessage[];
  question?: string;
  userId?: string;
  completedConcepts?: string[];
  masteryContext?: MasteryContext;
  language?: string;
  model?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: TIKARequest = await request.json();
    const container = getContainer();
    const { modelProvider } = container;

    // Determine which model to use (default to sonnet-4)
    const selectedModel = body.model || "sonnet-4";

    // Validate API key based on selected model
    if (selectedModel === "deepseek") {
      if (!modelProvider.isProviderConfigured("deepseek")) {
        return new Response(JSON.stringify({ error: "Deepseek API key not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      if (!modelProvider.isProviderConfigured("anthropic")) {
        return new Response(JSON.stringify({ error: "Anthropic API key not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Build system prompt based on user progress and mastery data
    const completedConcepts = body.completedConcepts || [];
    const language = body.language || "en";
    const userOverlay = deriveUserOverlay(completedConcepts);
    const systemPrompt = buildSystemPrompt(userOverlay, language, body.masteryContext);

    // Handle both new streaming format (messages array) and legacy format (question string)
    let messages: UIMessage[];

    // Convert to model messages format
    let modelMessages;

    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages;
      modelMessages = await convertToModelMessages(messages);
    } else if (body.question) {
      // Legacy format - convert question string directly to model message
      modelMessages = [{ role: "user" as const, content: body.question }];
    } else {
      return new Response(JSON.stringify({ error: "Missing messages or question" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the response using the selected model
    const result = streamText({
      model: modelProvider.getModel(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      tools: createTikaTools(),
      experimental_telemetry: {
        isEnabled: false,
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[TIKA API] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
