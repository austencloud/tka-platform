/**
 * TikaQuizGenerator - Generates interactive TKA quizzes
 *
 * Creates visual-first quizzes using pictograph grids,
 * motion pattern chips, and text-based options.
 */

import {
  TYPE_DEFINITIONS,
  POSITION_DEFINITIONS,
  MOTION_TYPE_DEFINITIONS,
  LETTER_TYPES,
  LETTER_TO_TYPE,
} from "@tka/domain";
import type {
  ITikaQuizGenerator,
  QuizResult,
  InlineQuiz,
  QuizDifficulty,
  PictographOption,
  MotionPatternOption,
  TextOption,
} from "../contracts/ITikaQuizGenerator";

export class TikaQuizGenerator implements ITikaQuizGenerator {
  private quizCounter = 0;

  generateQuiz(
    topic: string,
    quizType: string = "multiple-choice",
    difficulty: QuizDifficulty = "medium"
  ): QuizResult {
    const quizId = this.generateQuizId();
    const normalizedTopic = topic.toLowerCase().trim();

    // Determine quiz type based on topic
    if (normalizedTopic.startsWith("type") || /^[1-6]$/.test(normalizedTopic)) {
      const typeNum =
        parseInt(normalizedTopic.replace("type", "")) ||
        parseInt(normalizedTopic);
      return this.generateTypeQuiz(typeNum, quizType, difficulty);
    }

    if (LETTER_TO_TYPE[topic.toUpperCase()]) {
      return this.generateLetterQuiz(topic.toUpperCase(), quizType, difficulty);
    }

    if (POSITION_DEFINITIONS[normalizedTopic as keyof typeof POSITION_DEFINITIONS]) {
      return this.generatePositionQuiz(normalizedTopic, quizType, difficulty);
    }

    if (MOTION_TYPE_DEFINITIONS[normalizedTopic]) {
      return this.generateMotionQuiz(normalizedTopic, quizType, difficulty);
    }

    return this.generateGeneralQuiz(quizType, difficulty);
  }

  generateTypeQuiz(
    typeNum: number,
    _quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult {
    const quizId = this.generateQuizId();
    const typeDef = TYPE_DEFINITIONS[typeNum];

    if (!typeDef) {
      return this.generateGeneralQuiz("pick-letter", difficulty);
    }

    // Get one correct letter from the target type
    const correctLetters = this.getLettersFromType(typeNum, 1);
    const correctLetter = correctLetters[0];
    if (!correctLetter) {
      return this.generateGeneralQuiz("pick-letter", difficulty);
    }

    // Get 3 distractor letters from OTHER types
    const distractorLetters = this.getLettersNotFromType(typeNum, 3);

    // Build pictograph options
    const options: PictographOption[] = this.shuffleArray([
      {
        id: "opt-correct",
        type: "pictograph",
        letter: correctLetter,
        correct: true,
      },
      {
        id: "opt-1",
        type: "pictograph",
        letter: distractorLetters[0] || "W",
        correct: false,
      },
      {
        id: "opt-2",
        type: "pictograph",
        letter: distractorLetters[1] || "Φ",
        correct: false,
      },
      {
        id: "opt-3",
        type: "pictograph",
        letter: distractorLetters[2] || "α",
        correct: false,
      },
    ]);

    return {
      explanation: `Tap the Type ${typeNum} (${typeDef.name}) letter:`,
      inlineQuiz: {
        type: "inline-quiz",
        id: quizId,
        quizType: "pick-letter",
        displayMode: "pictograph-grid",
        question: `Which letter is Type ${typeNum} (${typeDef.name})?`,
        options,
        correctFeedback: `Yes! ${correctLetter} is a Type ${typeNum} letter. ${typeDef.description}.`,
        incorrectFeedback: `Not quite. The correct answer was ${correctLetter}.`,
        explanation: typeDef.description,
        difficulty,
        topic: `type${typeNum}`,
      },
    };
  }

  generateLetterQuiz(
    letter: string,
    _quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult {
    const quizId = this.generateQuizId();
    const typeInfo = LETTER_TO_TYPE[letter];
    const typeNum = parseInt(typeInfo?.type || "1");

    // Get 3 distractor letters (mix of same and different types)
    const sameTypeDistractors = this.getLettersFromType(typeNum, 2).filter(
      (l) => l !== letter
    );
    const otherTypeDistractors = this.getLettersNotFromType(typeNum, 2);
    const distractors = this.shuffleArray([
      ...sameTypeDistractors,
      ...otherTypeDistractors,
    ]).slice(0, 3);

    const options: PictographOption[] = this.shuffleArray([
      { id: "opt-correct", type: "pictograph", letter: letter, correct: true },
      {
        id: "opt-1",
        type: "pictograph",
        letter: distractors[0] || "B",
        correct: false,
      },
      {
        id: "opt-2",
        type: "pictograph",
        letter: distractors[1] || "C",
        correct: false,
      },
      {
        id: "opt-3",
        type: "pictograph",
        letter: distractors[2] || "W",
        correct: false,
      },
    ]);

    return {
      explanation: `Can you find letter ${letter}?`,
      inlineQuiz: {
        type: "inline-quiz",
        id: quizId,
        quizType: "pick-letter",
        displayMode: "pictograph-grid",
        question: `Tap the letter ${letter}:`,
        options,
        correctFeedback: `Correct! That's the letter ${letter}.`,
        incorrectFeedback: `Not quite. The correct answer was ${letter}.`,
        explanation: `${letter} is a Type ${typeNum} letter.`,
        difficulty,
        topic: letter,
      },
    };
  }

  generateGeneralQuiz(
    _quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult {
    // Random visual quiz type
    const quizTypes = ["pick-letter", "odd-one-out", "match-motion"];
    const selectedType =
      quizTypes[Math.floor(Math.random() * quizTypes.length)];
    const randomType = Math.floor(Math.random() * 6) + 1;

    if (selectedType === "odd-one-out") {
      return this.generateOddOneOutQuiz(randomType, difficulty);
    }

    if (selectedType === "match-motion") {
      return this.generateMotionMatchQuiz(randomType, difficulty);
    }

    return this.generateTypeQuiz(randomType, "pick-letter", difficulty);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Quiz Generators
  // ─────────────────────────────────────────────────────────────────────────

  private generateOddOneOutQuiz(
    typeNum: number,
    difficulty: QuizDifficulty
  ): QuizResult {
    const quizId = this.generateQuizId();
    const typeDef = TYPE_DEFINITIONS[typeNum];

    if (!typeDef) {
      return this.generateTypeQuiz(1, "pick-letter", difficulty);
    }

    // Get 3 letters from the same type
    const sameTypeLetters = this.getLettersFromType(typeNum, 3);
    if (sameTypeLetters.length < 3) {
      return this.generateTypeQuiz(typeNum, "pick-letter", difficulty);
    }

    // Get 1 letter from a DIFFERENT type (the odd one)
    const oddLetters = this.getLettersNotFromType(typeNum, 1);
    const oddLetter = oddLetters[0];
    if (!oddLetter) {
      return this.generateTypeQuiz(typeNum, "pick-letter", difficulty);
    }

    const oddTypeInfo = LETTER_TO_TYPE[oddLetter];
    const oddTypeName =
      TYPE_DEFINITIONS[parseInt(oddTypeInfo?.type || "1")]?.name || "unknown";

    const options: PictographOption[] = this.shuffleArray([
      { id: "opt-odd", type: "pictograph", letter: oddLetter, correct: true },
      {
        id: "opt-1",
        type: "pictograph",
        letter: sameTypeLetters[0] || "A",
        correct: false,
      },
      {
        id: "opt-2",
        type: "pictograph",
        letter: sameTypeLetters[1] || "B",
        correct: false,
      },
      {
        id: "opt-3",
        type: "pictograph",
        letter: sameTypeLetters[2] || "C",
        correct: false,
      },
    ]);

    return {
      explanation: `Three of these are Type ${typeNum}. Find the odd one out:`,
      inlineQuiz: {
        type: "inline-quiz",
        id: quizId,
        quizType: "odd-one-out",
        displayMode: "pictograph-grid",
        question: `Which letter is NOT Type ${typeNum} (${typeDef.name})?`,
        options,
        correctFeedback: `Correct! ${oddLetter} is Type ${oddTypeInfo?.type} (${oddTypeName}), not Type ${typeNum}.`,
        incorrectFeedback: `Not quite. ${oddLetter} was the odd one out - it's Type ${oddTypeInfo?.type} (${oddTypeName}).`,
        explanation: `The other three letters are all Type ${typeNum} (${typeDef.name}).`,
        difficulty,
        topic: `type${typeNum}`,
      },
    };
  }

  private generateMotionMatchQuiz(
    typeNum: number,
    difficulty: QuizDifficulty
  ): QuizResult {
    const quizId = this.generateQuizId();
    const typeDef = TYPE_DEFINITIONS[typeNum];

    if (!typeDef) {
      return this.generateTypeQuiz(1, "pick-letter", difficulty);
    }

    const allPatterns: MotionPatternOption[] = [];

    // Add the correct pattern
    allPatterns.push({
      id: "opt-correct",
      type: "motion-pattern",
      blueMotion: typeDef.motionPattern.blue,
      redMotion: typeDef.motionPattern.red,
      correct: true,
    });

    // Add distractor patterns from other types
    for (let t = 1; t <= 6; t++) {
      if (t === typeNum) continue;
      const otherDef = TYPE_DEFINITIONS[t];
      if (!otherDef) continue;

      // Skip if same pattern as correct
      if (
        otherDef.motionPattern.blue === typeDef.motionPattern.blue &&
        otherDef.motionPattern.red === typeDef.motionPattern.red
      )
        continue;

      allPatterns.push({
        id: `opt-${t}`,
        type: "motion-pattern",
        blueMotion: otherDef.motionPattern.blue,
        redMotion: otherDef.motionPattern.red,
        correct: false,
      });

      if (allPatterns.length >= 4) break;
    }

    // Ensure we have 4 options
    while (allPatterns.length < 4) {
      allPatterns.push({
        id: `opt-extra-${allPatterns.length}`,
        type: "motion-pattern",
        blueMotion: "static",
        redMotion: "dash",
        correct: false,
      });
    }

    const options = this.shuffleArray(allPatterns.slice(0, 4));

    return {
      explanation: `Which motion combination defines Type ${typeNum}?`,
      inlineQuiz: {
        type: "inline-quiz",
        id: quizId,
        quizType: "match-motion",
        displayMode: "motion-chips",
        question: `What motion pattern do Type ${typeNum} (${typeDef.name}) letters have?`,
        options,
        correctFeedback: `Correct! Type ${typeNum} has ${typeDef.motionPattern.blue} blue + ${typeDef.motionPattern.red} red.`,
        incorrectFeedback: `Not quite. Type ${typeNum} has ${typeDef.motionPattern.blue} blue + ${typeDef.motionPattern.red} red.`,
        explanation: typeDef.description,
        difficulty,
        topic: `type${typeNum}`,
      },
    };
  }

  private generatePositionQuiz(
    _position: string,
    _quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult {
    return this.generateGeneralQuiz("pick-letter", difficulty);
  }

  private generateMotionQuiz(
    _motionType: string,
    _quizType: string,
    difficulty: QuizDifficulty
  ): QuizResult {
    const randomType = Math.floor(Math.random() * 6) + 1;
    return this.generateMotionMatchQuiz(randomType, difficulty);
  }

  private generateTrueFalseQuiz(
    typeNum: number,
    difficulty: QuizDifficulty
  ): QuizResult {
    const quizId = this.generateQuizId();
    const typeDef = TYPE_DEFINITIONS[typeNum];

    if (!typeDef) {
      const isTrue = Math.random() > 0.5;
      return {
        explanation: `True or false?`,
        inlineQuiz: {
          type: "inline-quiz",
          id: quizId,
          quizType: "true-false",
          displayMode: "text",
          question: isTrue
            ? `Type 1 letters have both hands shifting.`
            : `Type 1 letters have both hands stationary.`,
          options: [
            { id: "opt-true", type: "text", text: "True", correct: isTrue },
            { id: "opt-false", type: "text", text: "False", correct: !isTrue },
          ],
          correctFeedback: `Correct!`,
          incorrectFeedback: `Not quite.`,
          explanation: `Type 1 (Dual-Shift) letters have both hands shifting.`,
          difficulty,
          topic: "general",
        },
      };
    }

    const isTrue = Math.random() > 0.5;
    let statement: string;
    let explanation: string;

    if (isTrue) {
      statement = `Type ${typeNum} (${typeDef.name}) letters have ${typeDef.motionPattern.blue} blue motion and ${typeDef.motionPattern.red} red motion.`;
      explanation = `This is correct. ${typeDef.description}.`;
    } else {
      const wrongBlue =
        typeDef.motionPattern.blue === "shift" ? "dash" : "shift";
      statement = `Type ${typeNum} (${typeDef.name}) letters have ${wrongBlue} blue motion and ${typeDef.motionPattern.red} red motion.`;
      explanation = `Type ${typeNum} actually has ${typeDef.motionPattern.blue} blue motion and ${typeDef.motionPattern.red} red motion.`;
    }

    return {
      explanation: `True or false?`,
      inlineQuiz: {
        type: "inline-quiz",
        id: quizId,
        quizType: "true-false",
        displayMode: "text",
        question: statement,
        options: [
          { id: "opt-true", type: "text", text: "True", correct: isTrue },
          { id: "opt-false", type: "text", text: "False", correct: !isTrue },
        ],
        correctFeedback: isTrue ? `Correct!` : `Right! That statement was false.`,
        incorrectFeedback: isTrue
          ? `Actually, that statement is true.`
          : `Actually, that statement is false.`,
        explanation,
        difficulty,
        topic: `type${typeNum}`,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────

  private generateQuizId(): string {
    this.quizCounter++;
    return `quiz-${Date.now()}-${this.quizCounter}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j] as T;
      shuffled[j] = temp as T;
    }
    return shuffled;
  }

  private getLettersFromType(typeNum: number, count: number): string[] {
    const typeInfo = LETTER_TYPES[typeNum.toString()];
    if (!typeInfo) return [];
    return this.shuffleArray(typeInfo.letters).slice(0, count);
  }

  private getLettersNotFromType(excludeType: number, count: number): string[] {
    const otherTypes = Object.keys(LETTER_TYPES)
      .filter((t) => t !== excludeType.toString())
      .map((t) => parseInt(t));

    const letters: string[] = [];
    for (const typeNum of this.shuffleArray(otherTypes)) {
      const typeLetters = this.getLettersFromType(typeNum, 2);
      letters.push(...typeLetters);
      if (letters.length >= count) break;
    }
    return this.shuffleArray(letters).slice(0, count);
  }
}
