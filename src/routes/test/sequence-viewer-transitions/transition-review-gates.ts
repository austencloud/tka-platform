export type TransitionReviewStatus =
  | "not-reviewed"
  | "approved"
  | "needs-changes";

export interface TransitionReviewDecision {
  status: TransitionReviewStatus;
  note: string;
  reviewedAt: string | null;
}

export interface TransitionReviewGate {
  id: string;
  title: string;
  summary: string;
  fromGrade: string;
  availability: "ready" | "pending";
}

export const TRANSITION_REVIEW_GATES = [
  {
    id: "split-focus",
    title: "Side by Side ⇄ 2D / Card",
    summary:
      "Both production panes stay alive while one expands into the space released by the other.",
    fromGrade: "D",
    availability: "ready",
  },
  {
    id: "2d-3d",
    title: "2D ⇄ 3D",
    summary:
      "Repeat switches and the first 3D activation share one clean handoff.",
    fromGrade: "B+ / C",
    availability: "ready",
  },
  {
    id: "stage-tunnel",
    title: "2D / 3D ⇄ Tunnel",
    summary:
      "One Animator canvas gains Tunnel layers while one inspector swaps its controls.",
    fromGrade: "B",
    availability: "ready",
  },
  {
    id: "card-stage",
    title: "Card ⇄ motion modes",
    summary: "The card crosses the workspace as one continuous surface.",
    fromGrade: "D",
    availability: "ready",
  },
  {
    id: "performances",
    title: "2D / 3D ⇄ Performances",
    summary:
      "One stage changes its moving source while one inspector changes its information.",
    fromGrade: "D",
    availability: "ready",
  },
  {
    id: "post-studio",
    title: "2D / 3D ⇄ Post Studio",
    summary: "The studio enters as an intentional workspace change.",
    fromGrade: "D",
    availability: "ready",
  },
  {
    id: "export-inspector",
    title: "Export inspector",
    summary: "Opening, closing, and resizing the inspector moves on one clock.",
    fromGrade: "C-",
    availability: "ready",
  },
  {
    id: "practice",
    title: "Practice",
    summary:
      "Practice recomposes the viewer without disturbing playback continuity.",
    fromGrade: "C+",
    availability: "ready",
  },
  {
    id: "switchers",
    title: "Mode switchers",
    summary:
      "Rail and bottom-bar selection feedback agree with the workspace motion.",
    fromGrade: "C",
    availability: "ready",
  },
] as const satisfies readonly TransitionReviewGate[];

export type TransitionReviewGateId =
  (typeof TRANSITION_REVIEW_GATES)[number]["id"];

export type TransitionReviewDecisions = Record<
  TransitionReviewGateId,
  TransitionReviewDecision
>;

export const TRANSITION_REVIEW_STORAGE_KEY =
  "tka_sequence_viewer_transition_review_v1";

const REVIEW_GATE_IDS: Set<string> = new Set(
  TRANSITION_REVIEW_GATES.map((gate) => gate.id)
);

export function createEmptyTransitionReviewDecisions(): TransitionReviewDecisions {
  return Object.fromEntries(
    TRANSITION_REVIEW_GATES.map((gate) => [
      gate.id,
      { status: "not-reviewed", note: "", reviewedAt: null },
    ])
  ) as TransitionReviewDecisions;
}

function isReviewStatus(value: unknown): value is TransitionReviewStatus {
  return (
    value === "not-reviewed" ||
    value === "approved" ||
    value === "needs-changes"
  );
}

export function parseTransitionReviewDecisions(
  serialized: string | null
): TransitionReviewDecisions {
  const decisions = createEmptyTransitionReviewDecisions();
  if (!serialized) return decisions;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return decisions;
    }

    for (const [id, value] of Object.entries(parsed)) {
      if (!REVIEW_GATE_IDS.has(id) || !value || typeof value !== "object") {
        continue;
      }

      const candidate = value as Record<string, unknown>;
      if (!isReviewStatus(candidate.status)) continue;

      decisions[id as TransitionReviewGateId] = {
        status: candidate.status,
        note: typeof candidate.note === "string" ? candidate.note : "",
        reviewedAt:
          typeof candidate.reviewedAt === "string"
            ? candidate.reviewedAt
            : null,
      };
    }
  } catch {
    return decisions;
  }

  return decisions;
}
