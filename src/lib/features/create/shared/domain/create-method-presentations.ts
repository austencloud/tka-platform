import type { Section } from "$lib/shared/navigation/domain/types";

export type CreateMethodDiagramKind =
  | "construct"
  | "generate"
  | "fuse"
  | "tunnel"
  | "assemble";

export interface CreateMethodPresentation {
  intent: string;
  diagram: CreateMethodDiagramKind;
}

// This is the only front-door-specific copy. Names, icons, descriptions, and
// colors stay owned by CREATE_TABS so navigation and the chooser cannot drift.
export const CREATE_METHOD_PRESENTATIONS: Record<
  string,
  CreateMethodPresentation
> = {
  construct: {
    intent: "I want full control",
    diagram: "construct",
  },
  generate: {
    intent: "I want a starting point",
    diagram: "generate",
  },
  fuse: {
    intent: "I have two sequences",
    diagram: "fuse",
  },
  tunnel: {
    intent: "I'm creating for a group",
    diagram: "tunnel",
  },
  assemble: {
    intent: "I want to work from the grid",
    diagram: "assemble",
  },
};

const FRONT_DOOR_ORDER = [
  "construct",
  "generate",
  "fuse",
  "tunnel",
  "assemble",
];

export function orderCreateMethods(methods: Section[]): Section[] {
  return [...methods].sort(
    (left, right) =>
      FRONT_DOOR_ORDER.indexOf(left.id) - FRONT_DOOR_ORDER.indexOf(right.id)
  );
}

export function getCreateMethodPresentation(
  methodId: string
): CreateMethodPresentation | undefined {
  return CREATE_METHOD_PRESENTATIONS[methodId];
}
