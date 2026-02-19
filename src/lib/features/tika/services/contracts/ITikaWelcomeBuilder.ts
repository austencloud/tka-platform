/**
 * ITikaWelcomeBuilder - Contract for building adaptive welcome screens
 *
 * Generates personalized welcome greetings and suggestions based on
 * the user's mastery data, TIKA conversation history, and topic interactions.
 */

import type { MasteryContext } from "$lib/features/learn/domain/quiz-history-types";
import type { TikaTopicInteraction } from "./ITikaInteractionTracker";

export interface WelcomeSuggestion {
  icon: string;
  text: string;
  question: string;
  reason: "review" | "next" | "continue" | "explore";
}

export interface WelcomeContext {
  greeting: string;
  suggestions: WelcomeSuggestion[];
  hasHistory: boolean;
}

export interface ITikaWelcomeBuilder {
  /**
   * Build a personalized welcome context.
   * Falls back to static defaults for anonymous/new users.
   */
  buildWelcome(
    masteryContext?: MasteryContext,
    topicHistory?: TikaTopicInteraction[],
    historySummary?: string
  ): WelcomeContext;
}
