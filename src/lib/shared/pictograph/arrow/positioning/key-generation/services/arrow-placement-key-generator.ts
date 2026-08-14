/**
 * Arrow Placement Key Generator
 *
 * Generates placement keys for arrow positioning lookups.
 */

import { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import {
  isVisibleMotion,
  type MotionData,
} from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

const DASH_LETTER_CONDITIONS = {
  TYPE3: ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"],
  TYPE5: ["Φ-", "Ψ-", "Λ-"],
};

function normalizeMotionType(motionType: unknown): MotionType {
  if (typeof motionType === "string") {
    const normalized = motionType.toLowerCase();
    switch (normalized) {
      case "pro":
        return MotionType.PRO;
      case "anti":
        return MotionType.ANTI;
      case "float":
        return MotionType.FLOAT;
      case "dash":
        return MotionType.DASH;
      case "static":
        return MotionType.STATIC;
    }
  }
  console.warn(
    `Invalid motion type: ${String(motionType)}, defaulting to 'pro'`
  );
  return MotionType.PRO;
}

function getLetterSuffix(letter: string): string {
  if (!letter) return "";

  const allDashLetters = [
    ...DASH_LETTER_CONDITIONS.TYPE3,
    ...DASH_LETTER_CONDITIONS.TYPE5,
  ];

  if (allDashLetters.includes(letter)) {
    const baseString = letter.slice(0, -1);
    return `_${baseString}_dash`;
  }

  return `_${letter}`;
}

function detectLayerInfo(pictographData: PictographData): {
  hasRadialProps: boolean;
  hasNonRadialProps: boolean;
  hasHybridOrientation: boolean;
  hasAlphaProps: boolean;
  hasBetaProps: boolean;
  hasGammaProps: boolean;
} {
  const redEndOri = isVisibleMotion(pictographData.motions.red)
    ? pictographData.motions.red.endOrientation
    : undefined;
  const blueEndOri = isVisibleMotion(pictographData.motions.blue)
    ? pictographData.motions.blue.endOrientation
    : undefined;

  const radialOrientations = ["in", "out"];
  const nonRadialOrientations = ["clock", "counter"];

  let hasRadialProps: boolean;
  let hasNonRadialProps: boolean;
  let hasHybridOrientation: boolean;

  if (!redEndOri || !blueEndOri) {
    const availableOri = blueEndOri || redEndOri;
    if (!availableOri) {
      return {
        hasRadialProps: false,
        hasNonRadialProps: false,
        hasHybridOrientation: false,
        hasAlphaProps: false,
        hasBetaProps: false,
        hasGammaProps: false,
      };
    }
    hasRadialProps = radialOrientations.includes(availableOri);
    hasNonRadialProps = nonRadialOrientations.includes(availableOri);
    hasHybridOrientation = false;

    return {
      hasRadialProps,
      hasNonRadialProps,
      hasHybridOrientation,
      hasAlphaProps: true,
      hasBetaProps: false,
      hasGammaProps: false,
    };
  }

  const redIsRadial = radialOrientations.includes(redEndOri);
  const redIsNonRadial = nonRadialOrientations.includes(redEndOri);
  const blueIsRadial = radialOrientations.includes(blueEndOri);
  const blueIsNonRadial = nonRadialOrientations.includes(blueEndOri);

  hasRadialProps = redIsRadial && blueIsRadial;
  hasNonRadialProps = redIsNonRadial && blueIsNonRadial;
  hasHybridOrientation =
    (redIsRadial && blueIsNonRadial) || (redIsNonRadial && blueIsRadial);

  const letter = pictographData.letter;
  const alphaLetters = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "W",
    "X",
    "W-",
    "X-",
    "Φ",
    "Φ-",
    "α",
  ];
  const betaLetters = [
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "Y",
    "Z",
    "Y-",
    "Z-",
    "Ψ",
    "Ψ-",
    "β",
  ];
  const gammaLetters = [
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "Σ",
    "Δ",
    "Θ",
    "Ω",
    "Σ-",
    "Δ-",
    "Θ-",
    "Ω-",
    "Λ",
    "Λ-",
    "γ",
    "ζ",
    "η",
    "τ",
    "⊕",
    "μ",
    "ν",
  ];

  const hasAlphaProps = letter ? alphaLetters.includes(letter) : false;
  const hasBetaProps = letter ? betaLetters.includes(letter) : false;
  const hasGammaProps = letter ? gammaLetters.includes(letter) : false;

  return {
    hasRadialProps,
    hasNonRadialProps,
    hasHybridOrientation,
    hasAlphaProps,
    hasBetaProps,
    hasGammaProps,
  };
}

function generateLegacyStyleKey(
  motionType: string,
  layerInfo: ReturnType<typeof detectLayerInfo>,
  letterSuffix: string,
  motionData?: MotionData
): string | null {
  let keyMiddle = "";
  if (layerInfo.hasRadialProps) {
    keyMiddle = "layer1";
  } else if (layerInfo.hasNonRadialProps) {
    keyMiddle = "layer2";
  } else if (layerInfo.hasHybridOrientation) {
    const radialOrientations = ["in", "out"];
    const endOrientation = motionData?.endOrientation || "in";
    const goesToRadial = radialOrientations.includes(endOrientation);
    keyMiddle = goesToRadial ? "radial_layer3" : "nonradial_layer3";
  }

  if (layerInfo.hasAlphaProps) {
    keyMiddle += "_alpha";
  } else if (layerInfo.hasBetaProps) {
    keyMiddle += "_beta";
  } else if (layerInfo.hasGammaProps) {
    keyMiddle += "_gamma";
  }

  if (keyMiddle) {
    return `${motionType}_to_${keyMiddle}${letterSuffix}`;
  }

  return null;
}

export function generatePlacementKey(
  motionData: MotionData,
  pictographData: PictographData,
  availableKeys: string[]
): string {
  const rawMotionType = motionData.motionType;
  const motionType = normalizeMotionType(rawMotionType);

  const candidateKeys = generateCandidateKeys(motionData, pictographData);

  for (const key of candidateKeys) {
    if (availableKeys.includes(key)) {
      return key;
    }
  }

  return motionType;
}

export function generateBasicKey(motionType: MotionType): string {
  return motionType;
}

function generateCandidateKeys(
  motionData: MotionData,
  pictographData: PictographData
): string[] {
  const rawMotionType = motionData.motionType;
  const motionType = normalizeMotionType(rawMotionType).toLowerCase();
  const letter = pictographData.letter;

  const candidates: string[] = [];
  const layerInfo = detectLayerInfo(pictographData);

  if (letter) {
    const letterSuffix = getLetterSuffix(letter);
    const keyWithLetter = generateLegacyStyleKey(
      motionType,
      layerInfo,
      letterSuffix,
      motionData
    );
    if (keyWithLetter) {
      candidates.push(keyWithLetter);
    }
  }

  const keyNoLetter = generateLegacyStyleKey(
    motionType,
    layerInfo,
    "",
    motionData
  );
  if (keyNoLetter) {
    candidates.push(keyNoLetter);
  }

  candidates.push(motionType);

  return candidates;
}
