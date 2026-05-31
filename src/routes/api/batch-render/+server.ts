/**
 * Batch Render API Endpoint
 *
 * Accepts sequence data and rendering options, returns rendered image blob.
 * Used by batch-rerender-gallery.js script for server-side rendering.
 */

import { getSequenceRenderer } from "$lib/shared/render/get-sequence-renderer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";

/** Hard ceilings to prevent resource exhaustion */
const MAX_BATCH_STEPS = 50;
const MAX_STEP_SIZE = 512;
const MIN_STEP_SIZE = 32;

/**
 * Check if a sequence requires non-radial points to be shown
 * Returns true if:
 * - Sequence is level 3 or higher, OR
 * - Any motion has clock or counter orientation
 */
function requiresNonRadialPoints(sequence: SequenceData): boolean {
  // Check difficulty level
  if (sequence.level && sequence.level >= 3) {
    return true;
  }

  // Check start position for clock/counter orientations
  if (sequence.startPosition?.motions) {
    const { blue, red } = sequence.startPosition.motions;
    if (
      blue?.startOrientation === Orientation.CLOCK ||
      blue?.startOrientation === Orientation.COUNTER ||
      blue?.endOrientation === Orientation.CLOCK ||
      blue?.endOrientation === Orientation.COUNTER ||
      red?.startOrientation === Orientation.CLOCK ||
      red?.startOrientation === Orientation.COUNTER ||
      red?.endOrientation === Orientation.CLOCK ||
      red?.endOrientation === Orientation.COUNTER
    ) {
      return true;
    }
  }

  // Check all steps for clock/counter orientations
  for (const step of sequence.steps || []) {
    const { blue, red } = step.motions;
    if (
      blue?.startOrientation === Orientation.CLOCK ||
      blue?.startOrientation === Orientation.COUNTER ||
      blue?.endOrientation === Orientation.CLOCK ||
      blue?.endOrientation === Orientation.COUNTER ||
      red?.startOrientation === Orientation.CLOCK ||
      red?.startOrientation === Orientation.COUNTER ||
      red?.endOrientation === Orientation.CLOCK ||
      red?.endOrientation === Orientation.COUNTER
    ) {
      return true;
    }
  }

  return false;
}

export const GET: RequestHandler = async () => {
  return json({
    endpoint: "/api/batch-render",
    method: "POST",
    description:
      "Renders sequence images for word cards with standardized visibility",
    settings: {
      export: {
        includeStartPosition: true,
        addStepNumbers: true,
        addWord: true,
        addDifficultyLevel: true,
        addReversalSymbols: true,
        addUserInfo: false,
      },
      visibility: {
        showTKA: "always",
        showTnD: "hidden",
        showElemental: "hidden",
        showPositions: "hidden",
        showReversals: "always",
        showNonRadialPoints:
          "conditional (level 3+ or clock/counter orientations)",
        showTurnNumbers: "always",
      },
    },
    usage: {
      body: {
        sequence: "SequenceData object (required)",
        propType:
          "PropType enum value (optional) - e.g., 'staff', 'fan', 'hoop'",
        stepSize: "number (optional, default: 120)",
        format: "PNG | JPEG | WebP (optional, default: WebP)",
        quality: "number 0-1 (optional, default: 0.9)",
      },
      example: {
        sequence: {
          id: "alpha_ver1",
          word: "alpha",
          steps: "[ ... ]",
          startPosition: "{ ... }",
        },
        propType: "staff",
        stepSize: 120,
        format: "WebP",
        quality: 0.9,
      },
    },
    script: "node scripts/batch-rerender-gallery.js --prop-types=staff",
  });
};

export const POST: RequestHandler = async (event) => {
  // Require authenticated user - rendering is CPU-intensive
  const caller = await requireFirebaseUser(event);

  // Rate limit to prevent resource exhaustion (rendering is CPU-intensive)
  const blocked = withRateLimit(event, RATE_LIMITS.AI_RENDER, "user", caller.uid);
  if (blocked) return blocked;

  const { request } = event;

  try {
    const body = (await request.json()) as {
      sequence: SequenceData;
      propType?: PropType;
      stepSize?: number;
      format?: "PNG" | "JPEG" | "WebP";
      quality?: number;
    };

    const {
      sequence,
      propType,
      stepSize: rawStepSize = 120,
      format = "WebP",
      quality: rawQuality = 0.9,
    } = body;

    // Clamp user-supplied rendering parameters
    const stepSize = Math.max(MIN_STEP_SIZE, Math.min(rawStepSize, MAX_STEP_SIZE));
    const quality = Math.max(0, Math.min(rawQuality, 1));

    if (!sequence?.steps || sequence.steps.length === 0) {
      return json({ error: "Invalid sequence data" }, { status: 400 });
    }

    // Reject sequences with too many steps to prevent CPU exhaustion
    if (sequence.steps.length > MAX_BATCH_STEPS) {
      return json(
        { error: `Sequence exceeds maximum of ${MAX_BATCH_STEPS} steps` },
        { status: 400 }
      );
    }

    // Resolve rendering service
    const renderService = getSequenceRenderer();

    // Determine if this sequence needs non-radial points shown
    const showNonRadial = requiresNonRadialPoints(sequence);

    // Prepare rendering options with choreo card visibility settings
    const options: Partial<SequenceExportOptions> = {
      stepSize,
      format,
      quality,
      includeStartPosition: true,
      addStepNumbers: true, // Show beat numbers
      addWord: true, // Show word header
      addDifficultyLevel: true, // Show difficulty badge
      addUserInfo: false, // No footer
      addReversalSymbols: true, // Show reversal symbols
      combinedGrids: false,
      stepScale: 1.0,
      margin: 0,
      redVisible: true,
      blueVisible: true,
      userName: "",
      exportDate: "",
      notes: "",
      scale: 1.0,
      propTypeOverride: propType, // Apply prop type override if provided

      // Choreo card visibility overrides
      visibilityOverrides: {
        showTKA: true, // Always show TKA glyph
        showTnD: false, // Hide TnD glyph
        showElemental: false, // Hide elemental glyph
        showPositions: false, // Hide positions
        showReversals: true, // Show reversal indicators
        showNonRadialPoints: showNonRadial, // Conditional: level 3+ or clock/counter
        showTurnNumbers: true, // Always show turn numbers
      },
    };

    // Render sequence to blob
    const blob = await renderService.renderSequenceToBlob(sequence, options);

    // Convert blob to buffer for response
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return image with appropriate content type
    const contentType =
      format === "PNG"
        ? "image/png"
        : format === "JPEG"
          ? "image/jpeg"
          : "image/webp";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Batch render failed:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};
