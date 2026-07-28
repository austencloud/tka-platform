/**
 * Voice Command Prompt Builder
 *
 * Builds the system prompt for the Tier 2 LLM from the action catalog
 * and current app context. The prompt tells the LLM what actions exist
 * and constrains its output to valid VoiceCommand shapes.
 *
 * Supports:
 * - Single commands: "I want to practice" → navigate to train
 * - Compound commands: "make a 16-step diamond sequence" → set length, set gridMode, generate
 * - Context-aware navigation: prepends navigate_module + switch_tab when action is in another module
 * - Conversational context: "do that again", "make it longer" (Phase 3)
 *
 * Target: ~600 input tokens. Kept lean for Haiku latency.
 */

import type { ActionDefinition } from "../domain/intent-resolution-types";
import type { VoiceCommand } from "../domain/voice-command-types";
import { getAllActionsWithContext } from "./action-catalog";

/**
 * Build the system prompt for the voice command LLM.
 * Shows ALL actions (not just current context) so the LLM can produce
 * navigation-first compound commands when needed.
 */
export function buildVoiceCommandPrompt(
  currentModule: string,
  currentTab: string,
  previousCommand?: VoiceCommand,
): string {
  const actions = getAllActionsWithContext(currentModule, currentTab);
  const actionBlock = formatActions(actions);

  let prompt = `You are a voice command interpreter for Flow Arts Composer, a flow arts choreography notation app.
Convert the user's spoken command into one or more structured actions.

## Current State
- Module: ${currentModule}
- Tab: ${currentTab}

## Available Actions
${actionBlock}

## Rules

### Single Commands
Map simple intent to exactly one action.

### Compound Commands
When the user implies multiple settings + an execution, produce multiple commands in order:
1. If the target action is in a different module/tab, start with navigation commands.
2. Then set each parameter mentioned.
3. End with the execution action (e.g., generator "generate").

Example: "make a 16-step diamond sequence" (user is in browse module) →
  1. navigate_module → create
  2. switch_tab → generate
  3. generator set length {value: 16}
  4. generator set gridMode {value: "diamond"}
  5. generator generate

Example: "make a smooth staff sequence" →
  1. (navigate if needed)
  2. generator set propContinuity {value: "continuous"}
  3. prop change_prop staff {hand: "both"}
  4. generator generate

### Navigation Awareness
Actions marked [REQUIRES NAVIGATION] are not available in the current module/tab.
If the user's intent maps to one, prepend navigate_module and/or switch_tab commands.

### Questions
If the user is asking a question or wants an explanation, set escalateToChat: true with empty commands array.

### Confidence
Set confidence 0.0-1.0. Use 0.9+ for clear matches, 0.5-0.8 for reasonable guesses.

### Unknown
If truly unrecognizable, return category "system", action "unknown".

## Domain Vocabulary
- Modules: create, browse, compose, learn, train, watch, settings, tika, lab
- Props: staff, poi, fan, club, hoop, buugeng, triad, sword, hand, energy_saber, energy_staff
- Generator params: level (1-5), length (1-64), mode (freeform/circular), gridMode (diamond/box), propContinuity (continuous/random), turnIntensity (0-3)
- "smooth" or "continuous" → propContinuity: "continuous"
- "practice" or "I want to practice" → navigate to train module
- "generate" or "make a sequence" → generator generate (navigate to create/generate first if not there)
- "random" or "make a random sequence" → generator generate with mode freeform`;

  // Phase 3: Conversational context
  if (previousCommand) {
    prompt += `

## Previous Command
The user's previous command was: ${JSON.stringify(previousCommand)}
They may use pronouns or relative terms like "do that again", "make it longer", "now try diamond", "same but with poi".
- "again" / "do that again" / "one more" → repeat the previous command sequence
- "longer" / "shorter" → increment/decrement length
- "make it X" → set the relevant parameter to X
- "same but with Y" → repeat previous + change the Y parameter`;
  }

  return prompt;
}

function formatActions(
  actions: (ActionDefinition & { requiresNavigation: boolean })[],
): string {
  const lines: string[] = [];
  let currentCategory = "";

  for (const action of actions) {
    if (action.category !== currentCategory) {
      currentCategory = action.category;
      lines.push(`\n### ${currentCategory}`);
    }

    let line = `- ${action.action}: ${action.description}`;

    if (action.requiresNavigation) {
      line += " [REQUIRES NAVIGATION]";
    }

    if (action.validTargets && action.validTargets.length > 0) {
      line += ` [targets: ${action.validTargets.join(", ")}]`;
    }

    if (action.validArgs) {
      const argParts = Object.entries(action.validArgs)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      line += ` {${argParts}}`;
    }

    lines.push(line);
  }

  return lines.join("\n");
}
