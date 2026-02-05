import type {
  SkillCategory,
  SkillProgression,
} from "../../../domain/models/challenge-models";
import {
  ALL_SKILLS,
  getSkillsByCategory as getSkillsByCategoryFromDefinitions,
  getSkillById as getSkillByIdFromDefinitions,
} from "../../../domain/constants/skill-definitions";

export function getActiveSkills(): SkillProgression[] {
  return ALL_SKILLS.filter((skill) => skill.isActive);
}

export function getActiveSkillsByCategory(
  category: SkillCategory
): SkillProgression[] {
  return getSkillsByCategoryFromDefinitions(category).filter(
    (skill) => skill.isActive
  );
}

export function getActiveSkillById(skillId: string): SkillProgression | null {
  const skill = getSkillByIdFromDefinitions(skillId);
  return skill?.isActive ? skill : null;
}
