import type { SkillProgression } from "../../../domain/models/challenge-models";
import { isSkillUnlocked } from "../../../domain/models/challenge-models";
import { ALL_SKILLS } from "../../../domain/constants/skill-definitions";

export type LockedSkillReason = "prerequisite" | "level" | "not_active";

export type LockedSkill = {
  skill: SkillProgression;
  reason: LockedSkillReason;
  missingPrerequisites?: string[];
  requiredLevel?: number;
};

export function getAvailableSkills(params: {
  completedSkillIds: string[];
  userLevel: number;
}): SkillProgression[] {
  const { completedSkillIds, userLevel } = params;

  return ALL_SKILLS.filter(
    (skill) =>
      skill.isActive && isSkillUnlocked(skill, completedSkillIds, userLevel)
  );
}

export function getLockedSkills(params: {
  completedSkillIds: string[];
  userLevel: number;
}): LockedSkill[] {
  const { completedSkillIds, userLevel } = params;

  const locked: LockedSkill[] = [];

  for (const skill of ALL_SKILLS) {
    if (!skill.isActive) {
      locked.push({ skill, reason: "not_active" });
      continue;
    }

    if (skill.minimumUserLevel && userLevel < skill.minimumUserLevel) {
      locked.push({
        skill,
        reason: "level",
        requiredLevel: skill.minimumUserLevel,
      });
      continue;
    }

    if (skill.prerequisiteSkillIds && skill.prerequisiteSkillIds.length > 0) {
      const missing = skill.prerequisiteSkillIds.filter(
        (prereqId) => !completedSkillIds.includes(prereqId)
      );
      if (missing.length > 0) {
        locked.push({
          skill,
          reason: "prerequisite",
          missingPrerequisites: missing,
        });
      }
    }
  }

  return locked;
}
