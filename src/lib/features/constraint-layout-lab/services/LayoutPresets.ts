/**
 * Layout Presets
 *
 * Pre-defined constraint configurations that create common layouts.
 * Each preset is a factory that generates cells with constraints
 * for a given container size.
 */

import type {
  ConstraintCell,
  ContainerBounds,
  LayoutPreset,
  Constraint,
  SizeConstraint,
  CellMediaType,
} from "../domain/types";
import { GRID_SIZE } from "./ConstraintSolver";

/** Snap a value to the nearest half-grid line (25px intervals) */
function snapToGrid(value: number): number {
  const HALF_GRID = GRID_SIZE / 2;
  return Math.round(value / HALF_GRID) * HALF_GRID;
}

let cellIdCounter = 0;

function createCellId(): string {
  return `cell-${++cellIdCounter}`;
}

function createConstraint(
  cellId: string,
  anchor: Constraint["anchor"],
  targetType: "parent" | "cell",
  targetAnchor: Constraint["target"]["anchor"],
  offset: number = 0,
  targetCellId?: string
): Constraint {
  return {
    id: `constraint-${cellId}-${anchor}`,
    cellId,
    anchor,
    target: {
      type: targetType,
      cellId: targetCellId,
      anchor: targetAnchor,
    },
    offset,
    priority: "required",
    relation: "equal",
  };
}

function createSizeConstraint(
  cellId: string,
  dimension: "width" | "height",
  value: number | { type: "ratio"; value: number }
): SizeConstraint {
  return {
    id: `size-${cellId}-${dimension}`,
    cellId,
    dimension,
    value,
    priority: "required",
    relation: "equal",
  };
}

const COLORS = [
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length]!;
}

/** Media type colors for visual distinction */
const MEDIA_COLORS: Record<CellMediaType, string> = {
  video: "#ef4444",       // Red
  animation: "#8b5cf6",   // Purple
  image: "#10b981",       // Emerald
  "choreo-card": "#3b82f6", // Blue
  empty: "#6b7280",       // Gray
};

/**
 * Single centered cell
 */
function createSingleLayout(container: ContainerBounds): ConstraintCell[] {
  const id = createCellId();
  const padding = GRID_SIZE; // 1 grid unit padding

  return [
    {
      id,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(id, "left", "parent", "left", padding),
        createConstraint(id, "right", "parent", "right", -padding),
        createConstraint(id, "top", "parent", "top", padding),
        createConstraint(id, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Two cells side by side - Video + Animation
 */
function createSplitHorizontal(container: ContainerBounds): ConstraintCell[] {
  const id1 = createCellId();
  const id2 = createCellId();
  const padding = GRID_SIZE;
  const gap = GRID_SIZE;

  return [
    {
      id: id1,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(id1, "left", "parent", "left", padding),
        createConstraint(id1, "right", "parent", "centerX", -gap / 2),
        createConstraint(id1, "top", "parent", "top", padding),
        createConstraint(id1, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: id2,
      label: "Animation",
      zIndex: 1,
      color: MEDIA_COLORS.animation,
      mediaType: "animation",
      constraints: [
        createConstraint(id2, "left", "parent", "centerX", gap / 2),
        createConstraint(id2, "right", "parent", "right", -padding),
        createConstraint(id2, "top", "parent", "top", padding),
        createConstraint(id2, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Two cells stacked - Video on top, Choreo Card below
 */
function createSplitVertical(container: ContainerBounds): ConstraintCell[] {
  const id1 = createCellId();
  const id2 = createCellId();
  const padding = GRID_SIZE;
  const gap = GRID_SIZE;

  return [
    {
      id: id1,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(id1, "left", "parent", "left", padding),
        createConstraint(id1, "right", "parent", "right", -padding),
        createConstraint(id1, "top", "parent", "top", padding),
        createConstraint(id1, "bottom", "parent", "centerY", -gap / 2),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: id2,
      label: "Choreo Card",
      zIndex: 1,
      color: MEDIA_COLORS["choreo-card"],
      mediaType: "choreo-card",
      constraints: [
        createConstraint(id2, "left", "parent", "left", padding),
        createConstraint(id2, "right", "parent", "right", -padding),
        createConstraint(id2, "top", "parent", "centerY", gap / 2),
        createConstraint(id2, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Video + 2 Thumbnails - Video on top, Animation + Image below (50/50)
 */
function createVideoWith2Thumbs(container: ContainerBounds): ConstraintCell[] {
  const heroId = createCellId();
  const thumb1Id = createCellId();
  const thumb2Id = createCellId();
  const padding = GRID_SIZE;
  const gap = GRID_SIZE;

  // Hero takes ~70% height, snapped to grid
  const heroHeight = snapToGrid((container.height - padding * 2 - gap) * 0.7);
  const thumbWidth = snapToGrid((container.width - padding * 2 - gap) / 2);

  return [
    {
      id: heroId,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(heroId, "left", "parent", "left", padding),
        createConstraint(heroId, "right", "parent", "right", -padding),
        createConstraint(heroId, "top", "parent", "top", padding),
      ],
      sizeConstraints: [createSizeConstraint(heroId, "height", heroHeight)],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: thumb1Id,
      label: "Animation",
      zIndex: 1,
      color: MEDIA_COLORS.animation,
      mediaType: "animation",
      constraints: [
        createConstraint(thumb1Id, "left", "parent", "left", padding),
        createConstraint(thumb1Id, "top", "cell", "bottom", gap, heroId),
        createConstraint(thumb1Id, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [createSizeConstraint(thumb1Id, "width", thumbWidth)],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: thumb2Id,
      label: "Image",
      zIndex: 1,
      color: MEDIA_COLORS.image,
      mediaType: "image",
      constraints: [
        createConstraint(thumb2Id, "left", "cell", "right", gap, thumb1Id),
        createConstraint(thumb2Id, "right", "parent", "right", -padding),
        createConstraint(thumb2Id, "top", "cell", "bottom", gap, heroId),
        createConstraint(thumb2Id, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Hero with thumbnails - Video on top, Animation + Image + Choreo Card below
 */
function createHeroThumbnails(container: ContainerBounds): ConstraintCell[] {
  const heroId = createCellId();
  const thumb1Id = createCellId();
  const thumb2Id = createCellId();
  const thumb3Id = createCellId();
  const padding = GRID_SIZE;
  const gap = GRID_SIZE;

  // Hero takes ~70% height, snapped to grid
  const heroHeight = snapToGrid((container.height - padding * 2 - gap) * 0.7);

  return [
    {
      id: heroId,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(heroId, "left", "parent", "left", padding),
        createConstraint(heroId, "right", "parent", "right", -padding),
        createConstraint(heroId, "top", "parent", "top", padding),
      ],
      sizeConstraints: [createSizeConstraint(heroId, "height", heroHeight)],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: thumb1Id,
      label: "Animation",
      zIndex: 1,
      color: MEDIA_COLORS.animation,
      mediaType: "animation",
      constraints: [
        createConstraint(thumb1Id, "left", "parent", "left", padding),
        createConstraint(thumb1Id, "top", "cell", "bottom", gap, heroId),
        createConstraint(thumb1Id, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [
        createSizeConstraint(thumb1Id, "width", snapToGrid((container.width - padding * 2 - gap * 2) / 3)),
      ],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: thumb2Id,
      label: "Image",
      zIndex: 1,
      color: MEDIA_COLORS.image,
      mediaType: "image",
      constraints: [
        createConstraint(thumb2Id, "left", "cell", "right", gap, thumb1Id),
        createConstraint(thumb2Id, "top", "cell", "bottom", gap, heroId),
        createConstraint(thumb2Id, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [
        createSizeConstraint(thumb2Id, "width", snapToGrid((container.width - padding * 2 - gap * 2) / 3)),
      ],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: thumb3Id,
      label: "Choreo Card",
      zIndex: 1,
      color: MEDIA_COLORS["choreo-card"],
      mediaType: "choreo-card",
      constraints: [
        createConstraint(thumb3Id, "left", "cell", "right", gap, thumb2Id),
        createConstraint(thumb3Id, "right", "parent", "right", -padding),
        createConstraint(thumb3Id, "top", "cell", "bottom", gap, heroId),
        createConstraint(thumb3Id, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Picture-in-picture - Video with Animation overlay
 */
function createPictureInPicture(container: ContainerBounds): ConstraintCell[] {
  const mainId = createCellId();
  const pipId = createCellId();
  const padding = GRID_SIZE;
  const pipSize = snapToGrid(Math.min(container.width, container.height) * 0.25);
  const pipPadding = GRID_SIZE;

  return [
    {
      id: mainId,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(mainId, "left", "parent", "left", padding),
        createConstraint(mainId, "right", "parent", "right", -padding),
        createConstraint(mainId, "top", "parent", "top", padding),
        createConstraint(mainId, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: pipId,
      label: "Animation",
      zIndex: 10, // On top
      color: MEDIA_COLORS.animation,
      mediaType: "animation",
      constraints: [
        createConstraint(pipId, "right", "parent", "right", -padding - pipPadding),
        createConstraint(pipId, "bottom", "parent", "bottom", -padding - pipPadding),
      ],
      sizeConstraints: [
        createSizeConstraint(pipId, "width", pipSize),
        createSizeConstraint(pipId, "height", pipSize),
      ],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Grid layout - 2x2: Video, Animation, Image, Choreo Card
 */
function createGrid2x2(container: ContainerBounds): ConstraintCell[] {
  const cells: ConstraintCell[] = [];
  const padding = GRID_SIZE;
  const gap = GRID_SIZE;

  const cellWidth = snapToGrid((container.width - padding * 2 - gap) / 2);
  const cellHeight = snapToGrid((container.height - padding * 2 - gap) / 2);

  const mediaTypes: { label: string; type: CellMediaType }[] = [
    { label: "Video", type: "video" },
    { label: "Animation", type: "animation" },
    { label: "Image", type: "image" },
    { label: "Choreo Card", type: "choreo-card" },
  ];

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const id = createCellId();
      const x = padding + col * (cellWidth + gap);
      const y = padding + row * (cellHeight + gap);
      const media = mediaTypes[row * 2 + col]!;

      cells.push({
        id,
        label: media.label,
        zIndex: 1,
        color: MEDIA_COLORS[media.type],
        mediaType: media.type,
        constraints: [
          createConstraint(id, "left", "parent", "left", x),
          createConstraint(id, "top", "parent", "top", y),
        ],
        sizeConstraints: [
          createSizeConstraint(id, "width", cellWidth),
          createSizeConstraint(id, "height", cellHeight),
        ],
        computed: { x: 0, y: 0, width: 100, height: 100 },
      });
    }
  }

  return cells;
}

/**
 * Sidebar layout - Choreo Card sidebar + Video content
 */
function createSidebar(container: ContainerBounds): ConstraintCell[] {
  const sidebarId = createCellId();
  const contentId = createCellId();
  const padding = GRID_SIZE;
  const gap = GRID_SIZE;
  const sidebarWidth = snapToGrid(Math.min(GRID_SIZE * 3, container.width * 0.25));

  return [
    {
      id: sidebarId,
      label: "Choreo Card",
      zIndex: 1,
      color: MEDIA_COLORS["choreo-card"],
      mediaType: "choreo-card",
      constraints: [
        createConstraint(sidebarId, "left", "parent", "left", padding),
        createConstraint(sidebarId, "top", "parent", "top", padding),
        createConstraint(sidebarId, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [createSizeConstraint(sidebarId, "width", sidebarWidth)],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: contentId,
      label: "Video",
      zIndex: 1,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(contentId, "left", "cell", "right", gap, sidebarId),
        createConstraint(contentId, "right", "parent", "right", -padding),
        createConstraint(contentId, "top", "parent", "top", padding),
        createConstraint(contentId, "bottom", "parent", "bottom", -padding),
      ],
      sizeConstraints: [],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * Overlapping cards - Image, Animation, Video stacked
 */
function createOverlappingCards(container: ContainerBounds): ConstraintCell[] {
  const card1Id = createCellId();
  const card2Id = createCellId();
  const card3Id = createCellId();
  const padding = GRID_SIZE;
  const cardWidth = snapToGrid(container.width * 0.5);
  const cardHeight = snapToGrid(container.height * 0.5);
  const stagger = GRID_SIZE;

  return [
    {
      id: card1Id,
      label: "Image",
      zIndex: 1,
      color: MEDIA_COLORS.image,
      mediaType: "image",
      constraints: [
        createConstraint(card1Id, "left", "parent", "left", padding),
        createConstraint(card1Id, "top", "parent", "top", padding),
      ],
      sizeConstraints: [
        createSizeConstraint(card1Id, "width", cardWidth),
        createSizeConstraint(card1Id, "height", cardHeight),
      ],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: card2Id,
      label: "Animation",
      zIndex: 2,
      color: MEDIA_COLORS.animation,
      mediaType: "animation",
      constraints: [
        createConstraint(card2Id, "left", "parent", "left", padding + stagger),
        createConstraint(card2Id, "top", "parent", "top", padding + stagger),
      ],
      sizeConstraints: [
        createSizeConstraint(card2Id, "width", cardWidth),
        createSizeConstraint(card2Id, "height", cardHeight),
      ],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: card3Id,
      label: "Video",
      zIndex: 3,
      color: MEDIA_COLORS.video,
      mediaType: "video",
      constraints: [
        createConstraint(card3Id, "left", "parent", "left", padding + stagger * 2),
        createConstraint(card3Id, "top", "parent", "top", padding + stagger * 2),
      ],
      sizeConstraints: [
        createSizeConstraint(card3Id, "width", cardWidth),
        createSizeConstraint(card3Id, "height", cardHeight),
      ],
      computed: { x: 0, y: 0, width: 100, height: 100 },
    },
  ];
}

/**
 * All available presets
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "single",
    name: "Single Video",
    description: "Full-frame video",
    icon: "square",
    createCells: createSingleLayout,
  },
  {
    id: "split-h",
    name: "Side by Side",
    description: "Video + Animation",
    icon: "columns",
    createCells: createSplitHorizontal,
  },
  {
    id: "split-v",
    name: "Stacked",
    description: "Video over Choreo Card",
    icon: "bars",
    createCells: createSplitVertical,
  },
  {
    id: "video-2-thumbs",
    name: "Video + 2",
    description: "Video + Animation, Image",
    icon: "th-large",
    createCells: createVideoWith2Thumbs,
  },
  {
    id: "grid-2x2",
    name: "Grid 2×2",
    description: "Video, Animation, Image, Choreo",
    icon: "border-all",
    createCells: createGrid2x2,
  },
  {
    id: "hero",
    name: "Hero + Row",
    description: "Video + Animation, Image, Choreo",
    icon: "image",
    createCells: createHeroThumbnails,
  },
  {
    id: "pip",
    name: "Picture in Picture",
    description: "Video with Animation overlay",
    icon: "clone",
    createCells: createPictureInPicture,
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description: "Choreo Card + Video",
    icon: "th-list",
    createCells: createSidebar,
  },
  {
    id: "overlap",
    name: "Overlapping",
    description: "Image, Animation, Video stacked",
    icon: "layer-group",
    createCells: createOverlappingCards,
  },
];

/**
 * Reset the cell ID counter (useful for testing)
 */
export function resetCellIdCounter(): void {
  cellIdCounter = 0;
}
