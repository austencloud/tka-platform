import type {
  FanBuild,
  FanCover,
  FanFrameColor,
  PropFinish,
} from "@austencloud/scene-3d";

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export interface PropBuildPreviewOption<T extends string> {
  id: T;
  label: string;
  image: string;
  imageScale?: number;
}

const ROOT = "/images/props/build-previews";

const PROP_IMAGES: Partial<Record<PropType, string>> = {
  [PropType.STAFF]: "staff.webp",
  [PropType.CAPSULE_BATON]: "capsule-baton.webp",
  [PropType.FIRE_DOUBLE_STAFF]: "fire-double-staff.webp",
  [PropType.CHICKEN]: "chicken.webp",
  [PropType.BIGCHICKEN]: "big-chicken.webp",
  [PropType.CLUB]: "club.webp",
  [PropType.TORCH]: "torch.webp",
  [PropType.GUITAR]: "guitar.webp",
  [PropType.UKULELE]: "ukulele.webp",
  [PropType.TRIQUETRA]: "triquetra.webp",
  [PropType.TRIQUETRA2]: "triquetra-2.webp",
  [PropType.TRIAD]: "triad-fire.webp",
  [PropType.TRIGENG]: "trigeng.webp",
  [PropType.SWORD]: "sword.webp",
  [PropType.SICKLES]: "sickles.webp",
};

function image(file: string): string {
  return `${ROOT}/${file}`;
}

export function propBuildPreviewImage(prop: PropType): string {
  return image(PROP_IMAGES[prop] ?? "triad-fire.webp");
}

export function finishPreviewOptions(
  prop: PropType
): readonly PropBuildPreviewOption<PropFinish>[] {
  const stem = prop === PropType.QUIAD ? "quiad" : "triad";
  return [
    { id: "fire", label: "Fire", image: image(`${stem}-fire.webp`) },
    { id: "day", label: "Day", image: image(`${stem}-day.webp`) },
  ];
}

function fanImage(
  build: FanBuild,
  frame: FanFrameColor,
  cover: FanCover
): string {
  if (build === "pictograph") return image("fan-pictograph-front.webp");
  if (build === "fire") return image(`fan-fire-${cover}-complete.webp`);
  return image(`fan-day-${frame}-${cover}-complete.webp`);
}

export function fanBuildPreviewOptions(
  frame: FanFrameColor,
  cover: FanCover
): readonly PropBuildPreviewOption<FanBuild>[] {
  return [
    {
      id: "pictograph",
      label: "Pictograph",
      image: fanImage("pictograph", frame, cover),
    },
    {
      id: "fire",
      label: "Fire",
      image: fanImage("fire", frame, cover),
    },
    { id: "day", label: "Day", image: fanImage("day", frame, cover) },
  ];
}

export function fanFramePreviewOptions(
  cover: FanCover
): readonly PropBuildPreviewOption<FanFrameColor>[] {
  return [
    {
      id: "black",
      label: "Black",
      image: fanImage("day", "black", cover),
    },
    {
      id: "white",
      label: "White",
      image: fanImage("day", "white", cover),
    },
  ];
}

export function fanCoverPreviewOptions(
  build: Exclude<FanBuild, "pictograph">,
  frame: FanFrameColor
): readonly PropBuildPreviewOption<FanCover>[] {
  return [
    {
      id: "bare",
      label: "Bare",
      image: fanImage(build, frame, "bare"),
    },
    {
      id: "covered",
      label: "Covered",
      image: fanImage(build, frame, "covered"),
    },
  ];
}
