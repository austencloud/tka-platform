/**
 * GapDetector
 *
 * Analyzes wrong quiz answers against the TKA knowledge graph
 * to identify misconception patterns. When a user confuses Type 1
 * with Type 3, the knowledge graph knows these are "commonly-confused-with"
 * and provides a targeted explanation.
 *
 * Works synchronously for per-question analysis (no Firestore reads),
 * and asynchronously for recurring pattern detection across sessions.
 */

import type { QuizAnswerEvent } from "../../quiz/domain/models/quiz-models";
import { QuizType } from "../../quiz/domain/enums/quiz-enums";
import type { DetectedGap, MisconceptionPattern } from "../contracts/types";
import { getTypeNodeId } from "../letter-to-concept-mapper";
import {
  tkaKnowledgeGraph,
} from "$lib/features/tika/knowledge/semantic-graph";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { getHistory } from "../quiz-history-recorder";

export class GapDetector {
  constructor() {}

  detectSingleError(event: QuizAnswerEvent): DetectedGap | null {
    if (event.isCorrect) return null;

    const correctLetter = this.extractLetter(event.correctContent, event.quizType);
    const chosenLetter = this.extractLetter(event.selectedContent, event.quizType);

    if (!correctLetter || !chosenLetter) return null;

    const correctNodeId = getTypeNodeId(correctLetter);
    const chosenNodeId = getTypeNodeId(chosenLetter);

    if (!correctNodeId || !chosenNodeId) return null;

    // Same type = not a type confusion (might be a specific letter confusion)
    if (correctNodeId === chosenNodeId) return null;

    // Check if this is a known confusion pair in the knowledge graph
    const confusedWith = tkaKnowledgeGraph.getConfusedWith(correctNodeId);
    const isKnownConfusion = confusedWith.some((n) => n.id === chosenNodeId);

    let confusionExplanation: string | undefined;
    if (isKnownConfusion) {
      // Find the relationship description
      const relationships = tkaKnowledgeGraph.relationships.filter(
        (r) =>
          r.type === "commonly-confused-with" &&
          ((r.from === correctNodeId && r.to === chosenNodeId) ||
            (r.from === chosenNodeId && r.to === correctNodeId))
      );
      confusionExplanation = relationships[0]?.description?.en;
    }

    return {
      correctNodeId,
      chosenNodeId,
      isKnownConfusion,
      confusionExplanation,
      correctLabel: correctLetter,
      chosenLabel: chosenLetter,
    };
  }

  analyzeErrors(wrongAnswers: QuizAnswerEvent[]): DetectedGap[] {
    const gaps: DetectedGap[] = [];
    for (const event of wrongAnswers) {
      const gap = this.detectSingleError(event);
      if (gap) {
        gaps.push(gap);
      }
    }
    return gaps;
  }

  async getRecurringMisconceptions(
    userId: string
  ): Promise<MisconceptionPattern[]> {
    const history = await getHistory(userId, undefined, 50);

    // Count confusion pairs from wrong answers across attempts
    const pairCounts = new Map<
      string,
      { count: number; lastAt: Date; explanation?: string }
    >();

    for (const attempt of history) {
      if (!attempt.wrongAnswers) continue;

      for (const wrong of attempt.wrongAnswers) {
        const correctLetter = this.extractLetterFromContent(
          wrong.correctContent,
          wrong.quizType
        );
        const chosenLetter = this.extractLetterFromContent(
          wrong.selectedContent,
          wrong.quizType
        );

        if (!correctLetter || !chosenLetter) continue;

        const correctNode = getTypeNodeId(correctLetter);
        const chosenNode = getTypeNodeId(chosenLetter);

        if (!correctNode || !chosenNode || correctNode === chosenNode) continue;

        // Normalize pair key (alphabetical order)
        const pairKey =
          correctNode < chosenNode
            ? `${correctNode}|${chosenNode}`
            : `${chosenNode}|${correctNode}`;

        const existing = pairCounts.get(pairKey);
        const timestamp = wrong.answeredAt
          ? new Date(wrong.answeredAt)
          : attempt.timestamp;

        if (existing) {
          existing.count++;
          if (timestamp > existing.lastAt) {
            existing.lastAt = timestamp;
          }
        } else {
          // Look up explanation from knowledge graph
          const confusedWith = tkaKnowledgeGraph.getConfusedWith(correctNode);
          const isKnown = confusedWith.some((n) => n.id === chosenNode);
          let explanation: string | undefined;

          if (isKnown) {
            const rel = tkaKnowledgeGraph.relationships.find(
              (r) =>
                r.type === "commonly-confused-with" &&
                ((r.from === correctNode && r.to === chosenNode) ||
                  (r.from === chosenNode && r.to === correctNode))
            );
            explanation = rel?.description?.en;
          }

          pairCounts.set(pairKey, {
            count: 1,
            lastAt: timestamp,
            explanation,
          });
        }
      }
    }

    // Filter to patterns that occurred 2+ times (real misconceptions)
    const patterns: MisconceptionPattern[] = [];
    for (const [key, data] of pairCounts) {
      if (data.count < 2) continue;

      const [nodeA, nodeB] = key.split("|");
      patterns.push({
        nodeA: nodeA!,
        nodeB: nodeB!,
        occurrenceCount: data.count,
        lastOccurredAt: data.lastAt,
        explanation: data.explanation,
      });
    }

    // Sort by occurrence count descending
    patterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
    return patterns;
  }

  /**
   * Extract a letter string from quiz answer content.
   * Handles both string content (letter quizzes) and PictographData
   * (pictograph quizzes where the letter is embedded in the data).
   */
  private extractLetter(
    content: unknown,
    quizType: QuizType
  ): string | null {
    if (typeof content === "string") return content;

    if (content && typeof content === "object" && "letter" in content) {
      const letter = (content as PictographData).letter;
      return letter ?? null;
    }

    return null;
  }

  /**
   * Extract letter from persisted wrong answer content.
   * Content may be a string or a serialized PictographData object.
   */
  private extractLetterFromContent(
    content: unknown,
    quizType: string
  ): string | null {
    if (typeof content === "string") return content;

    if (content && typeof content === "object" && "letter" in content) {
      return (content as { letter: string | null }).letter;
    }

    return null;
  }
}
