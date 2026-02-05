/**
 * SVGO Configuration - 2025 Best Practices
 *
 * Optimizes SVG files while preserving necessary attributes for runtime manipulation.
 * IMPORTANT: We preserve viewBox and id attributes since they're used programmatically.
 */

export default {
  multipass: true, // Run optimizations multiple times for better results

  plugins: [
    // Clean up unnecessary metadata
    "removeDoctype",
    "removeComments",
    "removeMetadata",
    "removeEditorsNSData",

    // Attribute cleanup
    "cleanupAttrs",
    "mergeStyles",
    "inlineStyles",
    "minifyStyles",

    // Remove unnecessary IDs (except centerPoint which we strip programmatically)
    {
      name: "cleanupIds",
      params: {
        preserve: ["centerPoint"], // Preserve centerPoint - we remove it programmatically
      },
    },

    // Structure optimization
    "removeUselessDefs",
    "cleanupNumericValues",
    "convertColors",
    "removeUnknownsAndDefaults",
    "removeNonInheritableGroupAttrs",
    "removeUselessStrokeAndFill",

    // IMPORTANT: Do NOT remove viewBox - we extract it programmatically
    // 'removeViewBox', // ❌ DISABLED - needed for positioning/scaling

    "cleanupEnableBackground",
    "removeHiddenElems",
    "removeEmptyText",
    "convertShapeToPath",
    "convertEllipseToCircle",
    "moveElemsAttrsToGroup",
    "moveGroupAttrsToElems",
    "collapseGroups",
    "convertPathData",
    "convertTransform",
    "removeEmptyAttrs",
    "removeEmptyContainers",
    "mergePaths",
    "removeUnusedNS",
    "sortDefsChildren",
    "removeTitle",
    "removeDesc",

    // Precision optimization
    {
      name: "convertPathData",
      params: {
        floatPrecision: 2, // Reduce decimal places for smaller files
      },
    },
    {
      name: "cleanupNumericValues",
      params: {
        floatPrecision: 2,
      },
    },

    // Preserve essential attributes for programmatic access
    {
      name: "removeUnknownsAndDefaults",
      params: {
        keepDataAttrs: true, // Preserve data-* attributes
        keepRoleAttr: true, // Preserve accessibility
      },
    },
  ],
};
