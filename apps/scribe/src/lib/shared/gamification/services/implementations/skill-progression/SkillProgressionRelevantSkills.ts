import type {
  SkillProgression,
  UserSkillProgress,
} from "../../../domain/models/challenge-models";
import type {
  SkillProgressActionType,
  SkillProgressMetadata,
} from "../../contracts/ISkillProgressionTracker";

export function findRelevantSkills(params: {
  availableSkills: SkillProgression[];
  allProgress: Map<string, UserSkillProgress>;
  actionType: SkillProgressActionType;
  metadata: SkillProgressMetadata;
}): Array<{ skill: SkillProgression; progressDelta: number }> {
  const { availableSkills, allProgress, actionType, metadata } = params;

  const results: Array<{ skill: SkillProgression; progressDelta: number }> = [];

  for (const skill of availableSkills) {
    const progress = allProgress.get(skill.skillId);
    if (progress?.isCompleted) continue;

    const currentLevelIndex = ((progress?.currentLevel || 1) - 1) as number;
    const currentLevel = skill.levels[currentLevelIndex];
    if (!currentLevel) continue;

    let matches = false;
    let delta = 1;

    switch (actionType) {
      case "sequence_with_letter":
        if (
          currentLevel.requirement.type === "sequence_with_letter" ||
          currentLevel.requirement.type === "unique_sequences_with_letter"
        ) {
          const reqLetter = currentLevel.requirement.metadata?.letter;
          if (
            reqLetter &&
            metadata.letter?.toUpperCase() === reqLetter.toUpperCase()
          ) {
            matches = true;
          }
        }
        break;

      case "sequence_created":
        if (currentLevel.requirement.type === "sequences_created_total") {
          matches = true;
        }
        break;

      case "drill_completed":
        if (currentLevel.requirement.type === "concept_drills_completed") {
          const reqConceptIds = currentLevel.requirement.metadata?.[
            "conceptIds"
          ] as string[] | undefined;
          if (
            reqConceptIds &&
            metadata.conceptId &&
            reqConceptIds.includes(metadata.conceptId)
          ) {
            matches = true;
          }
        }
        break;

      case "quiz_completed":
        if (currentLevel.requirement.type === "concept_quiz_score") {
          const reqConceptIds = currentLevel.requirement.metadata?.[
            "conceptIds"
          ] as string[] | undefined;
          const minScore = currentLevel.requirement.metadata?.minScore || 0;
          if (
            reqConceptIds &&
            metadata.conceptId &&
            reqConceptIds.includes(metadata.conceptId) &&
            metadata.quizScore &&
            metadata.quizScore >= minScore
          ) {
            matches = true;
          }
        }
        break;

      case "daily_practice":
        if (currentLevel.requirement.type === "consecutive_days") {
          matches = true;
        } else if (currentLevel.requirement.type === "total_practice_time") {
          matches = true;
          delta = metadata.practiceMinutes || 1;
        }
        break;

      case "challenge_completed":
        if (currentLevel.requirement.type === "challenges_completed") {
          matches = true;
        }
        break;

      case "exploration_complete":
        if (
          currentLevel.requirement.type === "unique_sequences_with_letter" &&
          currentLevel.requirement.metadata?.["trackUnique"]
        ) {
          matches = true;
        }
        break;
    }

    if (matches) {
      results.push({ skill, progressDelta: delta });
    }
  }

  return results;
}
