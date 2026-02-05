/**
 * SVGO Configuration for Letters - 2025 Best Practices
 *
 * Safer config for letters with complex CSS (disables problematic CSS minification)
 */

export default {
  multipass: true,

  plugins: [
    "removeDoctype",
    "removeComments",
    "removeMetadata",
    "removeEditorsNSData",
    "cleanupAttrs",
    "mergeStyles",
    "inlineStyles",
    // 'minifyStyles', // ❌ DISABLED - causes issues with complex letter SVG CSS

    {
      name: "cleanupIds",
      params: {
        preserve: ["centerPoint"],
      },
    },

    "removeUselessDefs",
    "cleanupNumericValues",
    "convertColors",
    "removeUnknownsAndDefaults",
    "removeNonInheritableGroupAttrs",
    "removeUselessStrokeAndFill",
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

    {
      name: "convertPathData",
      params: {
        floatPrecision: 2,
      },
    },
    {
      name: "cleanupNumericValues",
      params: {
        floatPrecision: 2,
      },
    },

    {
      name: "removeUnknownsAndDefaults",
      params: {
        keepDataAttrs: true,
        keepRoleAttr: true,
      },
    },
  ],
};
