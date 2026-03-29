// @tka/render-composition — shared choreo card composition
export * from "./types.js";
export * from "./difficulty-config.js";
export { drawSvgPath, drawPathCommands, parsePathData, type PathCommand } from "./svg-path-painter.js";
export { renderLoopIconStrip, LOOP_ICON_COLORS } from "./loop-icons.js";
export { getLayout, calculateImageDimensions, BASE_BEAT_SIZE } from "./layout-tables.js";
export { calculateHeaderHeight, calculateFooterHeight } from "./dimensions.js";
export { renderStepNumber } from "./step-number-renderer.js";
export { renderSmartBorders } from "./border-renderer.js";
export { renderHeader, type HeaderOptions } from "./header-renderer.js";
export { renderFooter, type FooterOptions } from "./footer-renderer.js";
