import { PropType } from "./enums/prop-type";

export const FAN_BUILDS = ["pictograph", "fire", "lotus", "day"] as const;
export type FanBuild = (typeof FAN_BUILDS)[number];

export const FAN_FRAME_COLORS = ["black", "white"] as const;
export type FanFrameColor = (typeof FAN_FRAME_COLORS)[number];

export const FAN_COVERS = ["bare", "covered"] as const;
export type FanCover = (typeof FAN_COVERS)[number];

export interface FanAppearance {
  build: FanBuild;
  frameColor: FanFrameColor;
  cover: FanCover;
}

export interface PropBuildPreviewOption<T extends string> {
  id: T;
  label: string;
  image: string;
  imageScale?: number;
  designCredit?: {
    originator: string;
    sourceUrl: string;
  };
}

export const DEFAULT_FAN_APPEARANCE: FanAppearance = {
  build: "pictograph",
  frameColor: "black",
  cover: "bare",
};

function includes<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function normalizeFanAppearance(
  value: Partial<FanAppearance> | null | undefined
): FanAppearance {
  return {
    build: includes(FAN_BUILDS, value?.build)
      ? value.build
      : DEFAULT_FAN_APPEARANCE.build,
    frameColor: includes(FAN_FRAME_COLORS, value?.frameColor)
      ? value.frameColor
      : DEFAULT_FAN_APPEARANCE.frameColor,
    cover: includes(FAN_COVERS, value?.cover)
      ? value.cover
      : DEFAULT_FAN_APPEARANCE.cover,
  };
}

export function fanAppearanceSignature(value: FanAppearance): string {
  return `${value.build}:${value.frameColor}:${value.cover}`;
}

export function isFanPropType(propType: string | null | undefined): boolean {
  const normalized = propType?.toLowerCase();
  return normalized === PropType.FAN || normalized === PropType.BIGFAN;
}

/**
 * Renderer-only identity. These keys never enter PropType, saved choreography,
 * or URL prop parameters; they only let the existing texture cache distinguish
 * visual builds of the same notation prop.
 */
export function resolveFanRenderKey(
  propType: string,
  appearance: FanAppearance
): string {
  const normalized = propType.toLowerCase();
  if (!isFanPropType(normalized) || appearance.build === "pictograph") {
    return normalized;
  }
  if (appearance.build === "fire") {
    return `${normalized}__fire_${appearance.cover}`;
  }
  if (appearance.build === "day") {
    return `${normalized}__day_${appearance.frameColor}_${appearance.cover}`;
  }
  return `${normalized}__lotus`;
}

export interface FanRenderKey {
  propType: "fan" | "bigfan";
  build: Exclude<FanBuild, "pictograph">;
  frameColor: FanFrameColor;
  cover: FanCover;
}

export function parseFanRenderKey(value: string): FanRenderKey | null {
  const normalized = value.toLowerCase();
  const lotus = /^(fan|bigfan)__lotus$/.exec(normalized);
  if (lotus) {
    return {
      propType: lotus[1] as FanRenderKey["propType"],
      build: "lotus",
      frameColor: DEFAULT_FAN_APPEARANCE.frameColor,
      cover: DEFAULT_FAN_APPEARANCE.cover,
    };
  }

  const fire = /^(fan|bigfan)__fire_(bare|covered)$/.exec(normalized);
  if (fire) {
    return {
      propType: fire[1] as FanRenderKey["propType"],
      build: "fire",
      frameColor: DEFAULT_FAN_APPEARANCE.frameColor,
      cover: fire[2] as FanCover,
    };
  }

  const day = /^(fan|bigfan)__day_(black|white)_(bare|covered)$/.exec(
    normalized
  );
  if (!day) return null;
  return {
    propType: day[1] as FanRenderKey["propType"],
    build: "day",
    frameColor: day[2] as FanFrameColor,
    cover: day[3] as FanCover,
  };
}

export function fanAppearanceArtwork(build: FanBuild): string | null {
  return build === "pictograph"
    ? null
    : `/images/props/appearances/fan-${build}.svg`;
}

const PREVIEW_ROOT = "/images/props/build-previews";

function previewImage(file: string): string {
  return `${PREVIEW_ROOT}/${file}`;
}

function fanPreviewImage(appearance: FanAppearance): string {
  if (appearance.build === "pictograph") {
    return previewImage("fan-pictograph-front.webp");
  }
  if (appearance.build === "fire") {
    return previewImage(`fan-fire-${appearance.cover}-complete.webp`);
  }
  if (appearance.build === "lotus") {
    return previewImage("fan-lotus-bare-complete.webp");
  }
  return previewImage(
    `fan-day-${appearance.frameColor}-${appearance.cover}-complete.webp`
  );
}

export function fanBuildPreviewOptions(
  appearance: FanAppearance
): readonly PropBuildPreviewOption<FanBuild>[] {
  return [
    {
      id: "pictograph",
      label: "Pictograph",
      image: fanPreviewImage({ ...appearance, build: "pictograph" }),
    },
    {
      id: "fire",
      label: "DoodleGrip Fire",
      image: fanPreviewImage({ ...appearance, build: "fire" }),
      designCredit: {
        originator: "Doodle",
        sourceUrl: "https://forgedfans.com/products/doodlegrip-fire-fans",
      },
    },
    {
      id: "lotus",
      label: "Lotus Fire",
      image: fanPreviewImage({ ...appearance, build: "lotus" }),
      designCredit: {
        originator: "Home of Poi",
        sourceUrl:
          "https://www.homeofpoi.com/en/shop/listItems/Medium-Lotus-Fire-Fans",
      },
    },
    {
      id: "day",
      label: "DoodleGrip Day",
      image: fanPreviewImage({ ...appearance, build: "day" }),
      designCredit: {
        originator: "Doodle",
        sourceUrl: "https://flowtoys.com/products/doodlegrip-practice-fans",
      },
    },
  ];
}

export function fanFramePreviewOptions(
  appearance: FanAppearance
): readonly PropBuildPreviewOption<FanFrameColor>[] {
  return FAN_FRAME_COLORS.map((frameColor) => ({
    id: frameColor,
    label: frameColor === "black" ? "Black" : "White",
    image: fanPreviewImage({ ...appearance, build: "day", frameColor }),
  }));
}

export function fanCoverPreviewOptions(
  appearance: FanAppearance
): readonly PropBuildPreviewOption<FanCover>[] {
  const build = appearance.build === "day" ? "day" : "fire";
  return FAN_COVERS.map((cover) => ({
    id: cover,
    label: cover === "bare" ? "Bare" : "Covered",
    image: fanPreviewImage({ ...appearance, build, cover }),
  }));
}
