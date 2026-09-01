/**
 * TKA-OS v1.0 - Pixel Art Icon Library
 *
 * 32x32 SVG pixel art icons using the Windows 95 16-color palette.
 * Every icon uses the authentic Win95 3D bevel convention:
 *   - White (#FFFFFF) highlight on top and left edges
 *   - Light gray (#C0C0C0) main surface
 *   - Dark gray (#808080) inner shadow on bottom and right
 *   - Black (#000000) outer shadow on bottom and right
 *   - Consistent upper-left light source across ALL icons
 *
 * TKA color coding:
 *   Blue (#0000FF / #000080) = left hand / blue staff tip
 *   Red  (#FF0000 / #800000) = right hand / red staff tip
 *
 * Palette (Win95 16-color):
 *   #000000  #800000  #008000  #808000  #000080  #800080  #008080  #C0C0C0
 *   #808080  #FF0000  #00FF00  #FFFF00  #0000FF  #FF00FF  #00FFFF  #FFFFFF
 */

const SVG_OPEN =
  '<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">';
const SVG_CLOSE = "</svg>";

function svg(inner: string): string {
  return `${SVG_OPEN}${inner}${SVG_CLOSE}`;
}

// ── Shared bevel helpers ─────────────────────────────────────────────────────
// Win95 raised button bevel on a rect: bright top-left, shadow bottom-right
function bevel(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
): string {
  const x2 = x + w - 1;
  const y2 = y + h - 1;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>` +
    // top highlight
    `<rect x="${x}" y="${y}" width="${w}" height="1" fill="#FFFFFF"/>` +
    // left highlight
    `<rect x="${x}" y="${y}" width="1" height="${h}" fill="#FFFFFF"/>` +
    // bottom outer shadow
    `<rect x="${x}" y="${y2}" width="${w}" height="1" fill="#000000"/>` +
    // right outer shadow
    `<rect x="${x2}" y="${y}" width="1" height="${h}" fill="#000000"/>` +
    // bottom inner shadow
    `<rect x="${x + 1}" y="${y2 - 1}" width="${w - 2}" height="1" fill="#808080"/>` +
    // right inner shadow
    `<rect x="${x2 - 1}" y="${y + 1}" width="1" height="${h - 2}" fill="#808080"/>`
  );
}

// Sunken / inset bevel (for screen areas, recessed panels)
function inset(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
): string {
  const x2 = x + w - 1;
  const y2 = y + h - 1;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>` +
    // top outer shadow (sunken: shadows on top-left)
    `<rect x="${x}" y="${y}" width="${w}" height="1" fill="#808080"/>` +
    `<rect x="${x}" y="${y}" width="1" height="${h}" fill="#808080"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="1" fill="#000000"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="1" height="${h - 2}" fill="#000000"/>` +
    // bottom-right highlight
    `<rect x="${x}" y="${y2}" width="${w}" height="1" fill="#FFFFFF"/>` +
    `<rect x="${x2}" y="${y}" width="1" height="${h}" fill="#FFFFFF"/>`
  );
}

export const RETRO_ICONS = {
  /* ------------------------------------------------------------------ */
  /* Desktop icons - 32×32, TKA-themed                                  */
  /* ------------------------------------------------------------------ */

  /**
   * My Computer - CRT monitor with TKA diamond grid on screen.
   * The screen shows the 4-cardinal-point diamond that defines TKA positions.
   */
  mycomputer: svg(
    // Monitor body (raised bevel)
    bevel(3, 1, 26, 20, "#C0C0C0") +
      // Screen bezel (inset)
      inset(6, 3, 20, 14, "#000080") +
      // TKA diamond grid on screen (white lines)
      '<rect x="15" y="4" width="2" height="12" fill="#00FFFF"/>' + // vertical
      '<rect x="9" y="9" width="14" height="2" fill="#00FFFF"/>' + // horizontal
      // Diamond shape (intercardinal dots at the 4 compass points)
      '<rect x="15" y="4" width="2" height="2" fill="#FFFFFF"/>' + // north
      '<rect x="15" y="14" width="2" height="2" fill="#FFFFFF"/>' + // south
      '<rect x="9" y="9" width="2" height="2" fill="#0000FF"/>' + // west (left hand)
      '<rect x="21" y="9" width="2" height="2" fill="#FF0000"/>' + // east (right hand)
      // Monitor neck
      '<rect x="13" y="21" width="6" height="3" fill="#C0C0C0"/>' +
      '<rect x="13" y="21" width="6" height="1" fill="#808080"/>' +
      // Monitor base (bevel)
      bevel(7, 24, 18, 4, "#C0C0C0") +
      // Power LED
      '<rect x="5" y="17" width="2" height="2" fill="#00FF00"/>'
  ),

  /**
   * Scribe - Notepad with a visible staff sketch.
   * The page shows crossed staves with blue and red tips - the primary TKA prop.
   */
  scribe: svg(
    // Document body
    bevel(4, 1, 24, 28, "#FFFFFF") +
      // Folded corner
      '<rect x="24" y="1" width="4" height="4" fill="#C0C0C0"/>' +
      '<polygon points="24,1 28,5 24,5" fill="#808080"/>' +
      // Binding strip at top
      '<rect x="4" y="1" width="24" height="3" fill="#C0C0C0"/>' +
      '<rect x="7" y="1" width="2" height="3" fill="#808080"/>' +
      '<rect x="12" y="1" width="2" height="3" fill="#808080"/>' +
      '<rect x="17" y="1" width="2" height="3" fill="#808080"/>' +
      '<rect x="22" y="1" width="2" height="3" fill="#808080"/>' +
      // Staff sketch: diagonal staff going NW to SE
      '<rect x="7" y="7" width="2" height="2" fill="#808000"/>' +
      '<rect x="9" y="9" width="2" height="2" fill="#808000"/>' +
      '<rect x="11" y="11" width="2" height="2" fill="#808000"/>' +
      '<rect x="13" y="13" width="2" height="2" fill="#808000"/>' +
      '<rect x="15" y="15" width="2" height="2" fill="#808000"/>' +
      '<rect x="17" y="17" width="2" height="2" fill="#808000"/>' +
      '<rect x="19" y="19" width="2" height="2" fill="#808000"/>' +
      // Blue tip (top-left)
      '<rect x="6" y="6" width="3" height="3" fill="#0000FF"/>' +
      // Red tip (bottom-right)
      '<rect x="20" y="20" width="3" height="3" fill="#FF0000"/>' +
      // Text lines below sketch
      '<rect x="6" y="24" width="16" height="1" fill="#808080"/>' +
      '<rect x="6" y="26" width="12" height="1" fill="#808080"/>'
  ),

  /**
   * File Manager - Classic Win95 yellow folder with rich 3D depth.
   */
  filemgr: svg(
    // Folder tab
    '<rect x="2" y="6" width="10" height="4" fill="#FFFF00"/>' +
      '<rect x="2" y="6" width="10" height="1" fill="#808000"/>' +
      '<rect x="2" y="6" width="1" height="4" fill="#FFFFFF"/>' +
      '<rect x="11" y="6" width="1" height="4" fill="#808080"/>' +
      // Main folder body
      bevel(2, 9, 28, 18, "#FFFF00") +
      // Override bevel fill with proper folder gold shading
      '<rect x="3" y="10" width="26" height="1" fill="#FFFFFF"/>' + // top inner highlight
      '<rect x="3" y="25" width="26" height="1" fill="#808000"/>' + // bottom shadow
      '<rect x="28" y="10" width="1" height="16" fill="#808000"/>' + // right shadow
      // Folder contents suggestion (doc stack)
      '<rect x="8" y="14" width="14" height="10" fill="#FFFFFF"/>' +
      '<rect x="8" y="14" width="14" height="1" fill="#C0C0C0"/>' +
      '<rect x="10" y="16" width="10" height="1" fill="#808080"/>' +
      '<rect x="10" y="18" width="10" height="1" fill="#808080"/>' +
      '<rect x="10" y="20" width="7" height="1" fill="#808080"/>'
  ),

  /**
   * Tutor - Graduation cap with a staff prop beneath it, TKA-themed.
   */
  tutor: svg(
    // Graduation cap board (raised)
    '<polygon points="16,3 2,10 16,17 30,10" fill="#000080"/>' +
      '<polygon points="16,3 2,10 16,10" fill="#000080"/>' +
      // Top highlight on board
      '<polygon points="16,3 2,10 4,10" fill="#0000FF"/>' +
      '<polygon points="16,3 28,10 30,10" fill="#0000FF"/>' +
      // Cap top surface highlight
      '<rect x="15" y="3" width="2" height="1" fill="#00FFFF"/>' +
      // Stem below board
      '<rect x="15" y="17" width="2" height="5" fill="#000080"/>' +
      // Tassel cord
      '<rect x="28" y="10" width="1" height="8" fill="#808000"/>' +
      '<rect x="26" y="17" width="5" height="1" fill="#808000"/>' +
      // Tassel end
      '<rect x="26" y="18" width="5" height="3" fill="#FFFF00"/>' +
      // Cap base
      '<rect x="7" y="22" width="18" height="4" fill="#000080"/>' +
      '<rect x="7" y="22" width="18" height="1" fill="#0000FF"/>' +
      '<rect x="7" y="22" width="1" height="4" fill="#0000FF"/>' +
      '<rect x="24" y="23" width="1" height="3" fill="#000000"/>' +
      '<rect x="8" y="25" width="16" height="1" fill="#000000"/>' +
      // Mini staff icon (TKA prop) on the front face of cap base
      '<rect x="15" y="23" width="1" height="2" fill="#808000"/>' +
      '<rect x="14" y="23" width="3" height="1" fill="#0000FF"/>' +
      '<rect x="14" y="24" width="3" height="1" fill="#FF0000"/>'
  ),

  /**
   * Cards - Playing card with a TKA pictograph diamond grid on its face.
   */
  cards: svg(
    // Card body (white with black border)
    bevel(3, 1, 26, 30, "#FFFFFF") +
      '<rect x="4" y="2" width="24" height="28" fill="#FFFFFF"/>' +
      '<rect x="4" y="2" width="24" height="28" fill="none" stroke="#000000" stroke-width="1"/>' +
      // TKA diamond grid in center
      // Outer diamond outline
      '<rect x="15" y="6" width="2" height="2" fill="#000080"/>' + // north dot
      '<rect x="15" y="22" width="2" height="2" fill="#000080"/>' + // south dot
      '<rect x="7" y="14" width="2" height="2" fill="#0000FF"/>' + // west dot (blue)
      '<rect x="23" y="14" width="2" height="2" fill="#FF0000"/>' + // east dot (red)
      // Diamond grid lines
      '<rect x="16" y="7" width="1" height="16" fill="#000080"/>' + // vertical
      '<rect x="8" y="15" width="16" height="1" fill="#000080"/>' + // horizontal
      // Diagonal lines of diamond
      '<rect x="9" y="9" width="1" height="1" fill="#808080"/>' +
      '<rect x="10" y="10" width="1" height="1" fill="#808080"/>' +
      '<rect x="11" y="11" width="1" height="1" fill="#808080"/>' +
      '<rect x="12" y="12" width="1" height="1" fill="#808080"/>' +
      '<rect x="13" y="13" width="1" height="1" fill="#808080"/>' +
      '<rect x="21" y="9" width="1" height="1" fill="#808080"/>' +
      '<rect x="20" y="10" width="1" height="1" fill="#808080"/>' +
      '<rect x="19" y="11" width="1" height="1" fill="#808080"/>' +
      '<rect x="18" y="12" width="1" height="1" fill="#808080"/>' +
      '<rect x="17" y="13" width="1" height="1" fill="#808080"/>' +
      '<rect x="9" y="21" width="1" height="1" fill="#808080"/>' +
      '<rect x="10" y="20" width="1" height="1" fill="#808080"/>' +
      '<rect x="11" y="19" width="1" height="1" fill="#808080"/>' +
      '<rect x="12" y="18" width="1" height="1" fill="#808080"/>' +
      '<rect x="13" y="17" width="1" height="1" fill="#808080"/>' +
      '<rect x="21" y="21" width="1" height="1" fill="#808080"/>' +
      '<rect x="20" y="20" width="1" height="1" fill="#808080"/>' +
      '<rect x="19" y="19" width="1" height="1" fill="#808080"/>' +
      '<rect x="18" y="18" width="1" height="1" fill="#808080"/>' +
      '<rect x="17" y="17" width="1" height="1" fill="#808080"/>' +
      // Corner suit marks (small diamonds = TKA)
      '<rect x="5" y="3" width="3" height="3" fill="#FF0000"/>' +
      '<rect x="24" y="26" width="3" height="3" fill="#FF0000"/>'
  ),

  /**
   * Control Panel - Gear/wrench with Win95 3D look.
   */
  control: svg(
    // Gear teeth (8 teeth around perimeter)
    '<rect x="12" y="1" width="8" height="4" fill="#C0C0C0"/>' + // top tooth
      '<rect x="12" y="27" width="8" height="4" fill="#C0C0C0"/>' + // bottom tooth
      '<rect x="1" y="12" width="4" height="8" fill="#C0C0C0"/>' + // left tooth
      '<rect x="27" y="12" width="4" height="8" fill="#C0C0C0"/>' + // right tooth
      '<rect x="3" y="3" width="5" height="5" fill="#C0C0C0"/>' + // TL tooth
      '<rect x="24" y="3" width="5" height="5" fill="#C0C0C0"/>' + // TR tooth
      '<rect x="3" y="24" width="5" height="5" fill="#C0C0C0"/>' + // BL tooth
      '<rect x="24" y="24" width="5" height="5" fill="#C0C0C0"/>' + // BR tooth
      // Gear body (raised circular bevel via layered rects)
      '<rect x="5" y="5" width="22" height="22" fill="#C0C0C0" rx="11"/>' +
      // Highlight arc top-left
      '<rect x="6" y="5" width="14" height="1" fill="#FFFFFF"/>' +
      '<rect x="5" y="6" width="1" height="14" fill="#FFFFFF"/>' +
      // Shadow arc bottom-right
      '<rect x="6" y="26" width="20" height="1" fill="#808080"/>' +
      '<rect x="26" y="6" width="1" height="20" fill="#808080"/>' +
      // Center hole (inset)
      inset(11, 11, 10, 10, "#808080") +
      // Wrench shape cutout suggestion
      '<rect x="14" y="13" width="4" height="6" fill="#808080"/>'
  ),

  /**
   * Upgrade - Golden crown with jewels, shareware nag screen.
   */
  upgrade: svg(
    // Crown base
    bevel(3, 18, 26, 10, "#808000") +
      '<rect x="4" y="19" width="24" height="8" fill="#FFFF00"/>' +
      // Crown points (three spikes)
      '<polygon points="5,18 5,6 10,12" fill="#FFFF00"/>' +
      '<polygon points="5,6 5,6 10,12 10,12" fill="#FFFF00"/>' +
      '<rect x="5" y="6" width="5" height="12" fill="#FFFF00"/>' +
      '<polygon points="16,18 13,4 19,4" fill="#FFFF00"/>' +
      '<polygon points="27,18 27,6 22,12" fill="#FFFF00"/>' +
      '<rect x="22" y="6" width="5" height="12" fill="#FFFF00"/>' +
      // Crown outline shading
      '<rect x="5" y="6" width="1" height="12" fill="#808000"/>' + // left point shadow
      '<rect x="27" y="6" width="1" height="12" fill="#808000"/>' + // right point shadow
      '<rect x="3" y="27" width="26" height="1" fill="#808000"/>' + // base bottom
      // Jewels in crown base
      '<rect x="7" y="20" width="4" height="5" fill="#FF0000"/>' + // ruby
      '<rect x="7" y="20" width="4" height="1" fill="#FF00FF"/>' + // jewel highlight
      '<rect x="14" y="20" width="4" height="5" fill="#0000FF"/>' + // sapphire
      '<rect x="14" y="20" width="4" height="1" fill="#00FFFF"/>' + // jewel highlight
      '<rect x="21" y="20" width="4" height="5" fill="#008000"/>' + // emerald
      '<rect x="21" y="20" width="4" height="1" fill="#00FF00"/>' + // jewel highlight
      // Orb atop center point
      '<rect x="14" y="2" width="4" height="4" fill="#FFFF00" rx="2"/>' +
      '<rect x="14" y="2" width="2" height="1" fill="#FFFFFF"/>'
  ),

  /**
   * README - Document with "i" info marker and TKA-flavored header.
   */
  readme: svg(
    // Document body
    bevel(3, 1, 26, 30, "#FFFFFF") +
      '<rect x="4" y="2" width="22" height="28" fill="#FFFFFF"/>' +
      // Folded corner
      '<polygon points="26,2 30,6 26,6" fill="#C0C0C0"/>' +
      '<polygon points="26,2 30,6 30,2" fill="#808080"/>' +
      // Header bar (TKA-blue)
      '<rect x="4" y="2" width="22" height="5" fill="#000080"/>' +
      '<rect x="5" y="3" width="8" height="1" fill="#FFFFFF"/>' + // "TKA" text suggestion
      '<rect x="5" y="4" width="5" height="1" fill="#C0C0C0"/>' +
      // Big "i" in blue circle
      '<rect x="12" y="9" width="8" height="8" fill="#0000FF" rx="4"/>' +
      '<rect x="15" y="10" width="2" height="2" fill="#FFFFFF"/>' + // dot
      '<rect x="15" y="13" width="2" height="3" fill="#FFFFFF"/>' + // stem
      // Text lines
      '<rect x="5" y="19" width="20" height="1" fill="#000000"/>' +
      '<rect x="5" y="21" width="20" height="1" fill="#000000"/>' +
      '<rect x="5" y="23" width="15" height="1" fill="#000000"/>' +
      '<rect x="5" y="25" width="18" height="1" fill="#808080"/>' +
      '<rect x="5" y="27" width="12" height="1" fill="#808080"/>'
  ),

  /**
   * Help - Yellow circle with classic Win95 "?" mark.
   */
  help: svg(
    // Yellow circle body
    '<rect x="4" y="2" width="24" height="28" fill="#FFFF00" rx="12"/>' +
      // Highlight arc top-left
      '<rect x="5" y="2" width="16" height="1" fill="#FFFFFF"/>' +
      '<rect x="4" y="3" width="1" height="16" fill="#FFFFFF"/>' +
      // Shadow arc bottom-right
      '<rect x="5" y="29" width="20" height="1" fill="#808000"/>' +
      '<rect x="27" y="5" width="1" height="20" fill="#808000"/>' +
      // Black outline
      '<rect x="4" y="2" width="24" height="28" fill="none" stroke="#000000" stroke-width="1" rx="12"/>' +
      // Question mark - thick pixel art
      '<rect x="11" y="6" width="10" height="2" fill="#000000"/>' + // top bar
      '<rect x="19" y="8" width="2" height="4" fill="#000000"/>' + // right stem
      '<rect x="13" y="12" width="6" height="2" fill="#000000"/>' + // curve base
      '<rect x="13" y="14" width="2" height="4" fill="#000000"/>' + // descender
      '<rect x="13" y="20" width="2" height="4" fill="#000000"/>' + // dot gap
      '<rect x="13" y="24" width="2" height="2" fill="#000000"/>' + // dot
      '<rect x="11" y="6" width="2" height="6" fill="#000000"/>' // left stem top
  ),

  /**
   * Defrag - Floppy disk with colored block map showing fragmentation.
   */
  defrag: svg(
    // Floppy body
    bevel(3, 1, 26, 30, "#C0C0C0") +
      // Metal shutter at top
      '<rect x="5" y="2" width="22" height="7" fill="#808080"/>' +
      '<rect x="5" y="2" width="22" height="1" fill="#C0C0C0"/>' +
      '<rect x="5" y="2" width="1" height="7" fill="#C0C0C0"/>' +
      // Shutter slot
      '<rect x="10" y="3" width="9" height="5" fill="#C0C0C0"/>' +
      '<rect x="10" y="3" width="9" height="1" fill="#808080"/>' +
      '<rect x="10" y="3" width="1" height="5" fill="#808080"/>' +
      // Label area (white, inset)
      inset(5, 10, 22, 20, "#FFFFFF") +
      // Block map - colored squares showing fragmentation
      '<rect x="7" y="12" width="3" height="3" fill="#000080"/>' +
      '<rect x="11" y="12" width="3" height="3" fill="#000080"/>' +
      '<rect x="15" y="12" width="3" height="3" fill="#FF0000"/>' +
      '<rect x="19" y="12" width="3" height="3" fill="#000080"/>' +
      '<rect x="7" y="16" width="3" height="3" fill="#008000"/>' +
      '<rect x="11" y="16" width="3" height="3" fill="#FF0000"/>' +
      '<rect x="15" y="16" width="3" height="3" fill="#000080"/>' +
      '<rect x="19" y="16" width="3" height="3" fill="#008000"/>' +
      '<rect x="7" y="20" width="3" height="3" fill="#FF0000"/>' +
      '<rect x="11" y="20" width="3" height="3" fill="#000080"/>' +
      '<rect x="15" y="20" width="3" height="3" fill="#FFFF00"/>' +
      '<rect x="19" y="20" width="3" height="3" fill="#FF0000"/>' +
      '<rect x="7" y="24" width="3" height="3" fill="#000080"/>' +
      '<rect x="11" y="24" width="3" height="3" fill="#008000"/>' +
      '<rect x="15" y="24" width="3" height="3" fill="#000080"/>' +
      '<rect x="19" y="24" width="7" height="3" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>'
  ),

  /**
   * Recycle Bin - Classic Win95 wire mesh trash can.
   * Widely considered one of the most iconic Win95 icons.
   */
  recyclebin: svg(
    // Lid (raised)
    bevel(6, 1, 20, 3, "#C0C0C0") +
      // Lid handle
      bevel(13, 0, 6, 3, "#C0C0C0") +
      // Body outline
      '<polygon points="5,5 7,31 25,31 27,5" fill="#C0C0C0"/>' +
      '<polygon points="5,5 7,31 25,31 27,5" fill="none" stroke="#000000" stroke-width="1"/>' +
      // Body highlight left
      '<rect x="6" y="5" width="1" height="24" fill="#FFFFFF"/>' +
      // Body shadow right
      '<rect x="25" y="5" width="1" height="24" fill="#808080"/>' +
      // Wire mesh vertical lines
      '<rect x="10" y="7" width="1" height="22" fill="#808080"/>' +
      '<rect x="14" y="7" width="1" height="22" fill="#808080"/>' +
      '<rect x="18" y="7" width="1" height="22" fill="#808080"/>' +
      '<rect x="22" y="7" width="1" height="22" fill="#808080"/>' +
      // Wire mesh horizontal lines
      '<rect x="6" y="11" width="20" height="1" fill="#808080"/>' +
      '<rect x="6" y="16" width="20" height="1" fill="#808080"/>' +
      '<rect x="6" y="21" width="20" height="1" fill="#808080"/>' +
      '<rect x="6" y="26" width="19" height="1" fill="#808080"/>' +
      // Bottom edge
      '<rect x="7" y="30" width="18" height="1" fill="#808080"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* File / folder icons                                                 */
  /* ------------------------------------------------------------------ */

  /** Closed yellow folder */
  folder: svg(
    // Tab
    '<rect x="2" y="8" width="12" height="5" fill="#FFFF00"/>' +
      '<rect x="2" y="8" width="1" height="5" fill="#FFFFFF"/>' +
      '<rect x="2" y="8" width="12" height="1" fill="#FFFFFF"/>' +
      '<rect x="13" y="9" width="1" height="4" fill="#808000"/>' +
      // Main body
      bevel(2, 12, 28, 18, "#FFFF00") +
      '<rect x="3" y="13" width="26" height="1" fill="#FFFFFF"/>' + // top inner shine
      '<rect x="3" y="29" width="26" height="1" fill="#808000"/>' + // bottom shadow
      '<rect x="29" y="13" width="1" height="16" fill="#808000"/>' // right shadow
  ),

  /** Open yellow folder */
  folderOpen: svg(
    // Back panel
    '<rect x="2" y="8" width="12" height="5" fill="#FFFF00" stroke="#000000" stroke-width="1"/>' +
      '<rect x="2" y="12" width="26" height="16" fill="#FFFF00" stroke="#000000" stroke-width="1"/>' +
      // Open flap
      '<polygon points="2,14 6,10 30,10 26,14" fill="#808000" stroke="#000000" stroke-width="1"/>' +
      '<polygon points="2,14 6,10 30,10 26,14" fill="#FFFF00"/>' +
      '<rect x="3" y="14" width="22" height="1" fill="#FFFFFF"/>' +
      // Inside shadow
      '<rect x="3" y="15" width="25" height="1" fill="#808080"/>'
  ),

  /** Document with staff motif - sequence file */
  fileSeq: svg(
    bevel(4, 1, 22, 30, "#FFFFFF") +
      '<rect x="5" y="2" width="18" height="28" fill="#FFFFFF"/>' +
      '<polygon points="22,2 26,6 22,6" fill="#C0C0C0"/>' +
      '<polygon points="22,2 26,6 26,2" fill="#808080"/>' +
      // Staff diagonal
      '<rect x="8" y="6" width="1" height="1" fill="#808000"/>' +
      '<rect x="9" y="7" width="1" height="1" fill="#808000"/>' +
      '<rect x="10" y="8" width="1" height="1" fill="#808000"/>' +
      '<rect x="11" y="9" width="1" height="1" fill="#808000"/>' +
      '<rect x="12" y="10" width="1" height="1" fill="#808000"/>' +
      '<rect x="13" y="11" width="1" height="1" fill="#808000"/>' +
      '<rect x="7" y="6" width="2" height="2" fill="#0000FF"/>' + // blue tip
      '<rect x="13" y="11" width="2" height="2" fill="#FF0000"/>' + // red tip
      // Text lines
      '<rect x="7" y="15" width="14" height="1" fill="#808080"/>' +
      '<rect x="7" y="17" width="14" height="1" fill="#808080"/>' +
      '<rect x="7" y="19" width="10" height="1" fill="#808080"/>' +
      '<rect x="7" y="21" width="12" height="1" fill="#808080"/>' +
      '<rect x="7" y="23" width="8" height="1" fill="#808080"/>'
  ),

  /** System file - gear on document */
  fileSys: svg(
    bevel(4, 1, 22, 30, "#FFFFFF") +
      '<rect x="5" y="2" width="18" height="28" fill="#FFFFFF"/>' +
      '<polygon points="22,2 26,6 22,6" fill="#C0C0C0"/>' +
      '<polygon points="22,2 26,6 26,2" fill="#808080"/>' +
      // Gear icon center
      '<rect x="10" y="8" width="8" height="8" fill="#C0C0C0" rx="4"/>' +
      '<rect x="10" y="8" width="8" height="1" fill="#FFFFFF"/>' +
      '<rect x="10" y="8" width="1" height="8" fill="#FFFFFF"/>' +
      '<rect x="17" y="9" width="1" height="7" fill="#808080"/>' +
      '<rect x="11" y="15" width="6" height="1" fill="#808080"/>' +
      '<rect x="13" y="10" width="2" height="4" fill="#808080"/>' +
      // Teeth
      '<rect x="13" y="7" width="2" height="2" fill="#C0C0C0"/>' +
      '<rect x="13" y="15" width="2" height="2" fill="#C0C0C0"/>' +
      '<rect x="9" y="11" width="2" height="2" fill="#C0C0C0"/>' +
      '<rect x="17" y="11" width="2" height="2" fill="#C0C0C0"/>' +
      // Text lines below
      '<rect x="7" y="20" width="14" height="1" fill="#808080"/>' +
      '<rect x="7" y="22" width="14" height="1" fill="#808080"/>' +
      '<rect x="7" y="24" width="10" height="1" fill="#808080"/>'
  ),

  /** Text document */
  fileTxt: svg(
    bevel(4, 1, 22, 30, "#FFFFFF") +
      '<rect x="5" y="2" width="18" height="28" fill="#FFFFFF"/>' +
      '<polygon points="22,2 26,6 22,6" fill="#C0C0C0"/>' +
      '<polygon points="22,2 26,6 26,2" fill="#808080"/>' +
      '<rect x="7" y="7" width="14" height="1" fill="#000000"/>' +
      '<rect x="7" y="10" width="14" height="1" fill="#000000"/>' +
      '<rect x="7" y="13" width="12" height="1" fill="#000000"/>' +
      '<rect x="7" y="16" width="14" height="1" fill="#000000"/>' +
      '<rect x="7" y="19" width="10" height="1" fill="#808080"/>' +
      '<rect x="7" y="22" width="13" height="1" fill="#808080"/>' +
      '<rect x="7" y="25" width="9" height="1" fill="#808080"/>'
  ),

  /** 3.5" floppy disk */
  floppy: svg(
    bevel(3, 1, 26, 30, "#0000FF") +
      // Metal shutter
      '<rect x="5" y="2" width="21" height="8" fill="#808080"/>' +
      '<rect x="5" y="2" width="21" height="1" fill="#C0C0C0"/>' +
      '<rect x="5" y="2" width="1" height="8" fill="#C0C0C0"/>' +
      // Shutter opening
      '<rect x="10" y="3" width="9" height="6" fill="#C0C0C0"/>' +
      '<rect x="10" y="3" width="1" height="6" fill="#808080"/>' +
      '<rect x="10" y="9" width="9" height="1" fill="#808080"/>' +
      // Label area
      inset(5, 11, 22, 18, "#FFFFFF") +
      '<rect x="7" y="13" width="16" height="1" fill="#808080"/>' +
      '<rect x="7" y="16" width="14" height="1" fill="#808080"/>' +
      '<rect x="7" y="19" width="12" height="1" fill="#808080"/>'
  ),

  /** CD-ROM disc */
  cdrom: svg(
    // Disc body
    '<rect x="3" y="3" width="26" height="26" fill="#C0C0C0" rx="13"/>' +
      '<rect x="3" y="3" width="26" height="26" fill="none" stroke="#000000" stroke-width="1" rx="13"/>' +
      // Rainbow sheen effect (dithered colors)
      '<rect x="5" y="5" width="4" height="2" fill="#FF0000"/>' +
      '<rect x="9" y="4" width="4" height="2" fill="#FFFF00"/>' +
      '<rect x="13" y="3" width="4" height="2" fill="#00FF00"/>' +
      '<rect x="17" y="4" width="4" height="2" fill="#00FFFF"/>' +
      '<rect x="21" y="5" width="4" height="2" fill="#0000FF"/>' +
      // Highlight
      '<rect x="5" y="5" width="10" height="1" fill="#FFFFFF"/>' +
      '<rect x="5" y="5" width="1" height="10" fill="#FFFFFF"/>' +
      // Center hole (dark inset)
      '<rect x="13" y="13" width="6" height="6" fill="#808080" rx="3"/>' +
      '<rect x="14" y="14" width="4" height="4" fill="#000000" rx="2"/>' +
      '<rect x="14" y="14" width="2" height="1" fill="#808080"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Toolbar / UI icons - clear and readable at small sizes              */
  /* ------------------------------------------------------------------ */

  /** Left arrow */
  arrowLeft: svg(
    '<polygon points="6,16 18,6 18,11 26,11 26,21 18,21 18,26" fill="#000000"/>' +
      '<polygon points="6,16 18,6 18,11 26,11 26,21 18,21 18,26" fill="none" stroke="#808080" stroke-width="1"/>' +
      // Highlight on leading edge
      '<polygon points="6,16 18,6 18,9" fill="#C0C0C0"/>'
  ),

  /** Right arrow */
  arrowRight: svg(
    '<polygon points="26,16 14,6 14,11 6,11 6,21 14,21 14,26" fill="#000000"/>' +
      '<polygon points="26,16 14,6 14,11 6,11 6,21 14,21 14,26" fill="none" stroke="#808080" stroke-width="1"/>' +
      '<polygon points="26,16 14,6 14,9" fill="#C0C0C0"/>'
  ),

  /** Up arrow */
  arrowUp: svg(
    '<polygon points="16,4 6,22 11,22 11,28 21,28 21,22 26,22" fill="#000000"/>' +
      '<polygon points="16,4 6,22 11,22 11,28 21,28 21,22 26,22" fill="none" stroke="#808080" stroke-width="1"/>' +
      '<polygon points="16,4 6,22 10,22" fill="#C0C0C0"/>'
  ),

  /** Printer */
  printer: svg(
    // Paper feed area (top)
    bevel(7, 1, 18, 8, "#FFFFFF") +
      '<rect x="9" y="3" width="12" height="5" fill="#FFFFFF"/>' +
      // Printer body
      bevel(3, 8, 26, 14, "#C0C0C0") +
      // Paper output slot
      bevel(7, 20, 18, 9, "#FFFFFF") +
      '<rect x="9" y="22" width="12" height="6" fill="#FFFFFF"/>' +
      '<rect x="9" y="24" width="8" height="1" fill="#808080"/>' +
      // Status LED
      '<rect x="5" y="12" width="3" height="3" fill="#00FF00"/>' +
      '<rect x="5" y="12" width="3" height="1" fill="#008000"/>' +
      // Feed roller hint
      '<rect x="7" y="17" width="18" height="2" fill="#808080"/>' +
      '<rect x="7" y="17" width="18" height="1" fill="#C0C0C0"/>'
  ),

  /** List view */
  viewList: svg(
    '<rect x="3" y="5" width="4" height="4" fill="#000080"/>' +
      '<rect x="3" y="5" width="4" height="1" fill="#0000FF"/>' +
      '<rect x="3" y="5" width="1" height="4" fill="#0000FF"/>' +
      '<rect x="9" y="6" width="20" height="2" fill="#000000"/>' +
      '<rect x="3" y="14" width="4" height="4" fill="#000080"/>' +
      '<rect x="3" y="14" width="4" height="1" fill="#0000FF"/>' +
      '<rect x="3" y="14" width="1" height="4" fill="#0000FF"/>' +
      '<rect x="9" y="15" width="20" height="2" fill="#000000"/>' +
      '<rect x="3" y="23" width="4" height="4" fill="#000080"/>' +
      '<rect x="3" y="23" width="4" height="1" fill="#0000FF"/>' +
      '<rect x="3" y="23" width="1" height="4" fill="#0000FF"/>' +
      '<rect x="9" y="24" width="20" height="2" fill="#000000"/>'
  ),

  /** Detail view - spreadsheet grid */
  viewDetails: svg(
    inset(1, 1, 30, 30, "#FFFFFF") +
      // Header row
      '<rect x="2" y="2" width="28" height="5" fill="#C0C0C0"/>' +
      '<rect x="2" y="2" width="28" height="1" fill="#FFFFFF"/>' +
      '<rect x="2" y="2" width="1" height="5" fill="#FFFFFF"/>' +
      '<rect x="29" y="2" width="1" height="5" fill="#808080"/>' +
      '<rect x="2" y="6" width="28" height="1" fill="#808080"/>' +
      // Column dividers
      '<rect x="10" y="2" width="1" height="28" fill="#808080"/>' +
      '<rect x="20" y="2" width="1" height="28" fill="#808080"/>' +
      // Row dividers
      '<rect x="2" y="13" width="28" height="1" fill="#C0C0C0"/>' +
      '<rect x="2" y="20" width="28" height="1" fill="#C0C0C0"/>' +
      '<rect x="2" y="27" width="28" height="1" fill="#C0C0C0"/>'
  ),

  /** New document */
  newDoc: svg(
    bevel(4, 1, 20, 30, "#FFFFFF") +
      '<rect x="5" y="2" width="16" height="26" fill="#FFFFFF"/>' +
      '<polygon points="20,2 28,10 20,10" fill="#C0C0C0"/>' +
      '<polygon points="20,2 28,10 28,2" fill="#808080"/>' +
      bevel(20, 10, 8, 22, "#FFFFFF") +
      '<rect x="21" y="11" width="6" height="20" fill="#FFFFFF"/>' +
      // Plus symbol
      '<rect x="8" y="13" width="12" height="3" fill="#000080"/>' +
      '<rect x="13" y="9" width="3" height="11" fill="#000080"/>'
  ),

  /** Save - floppy disk shortcut */
  save: svg(
    bevel(3, 1, 26, 30, "#0000FF") +
      '<rect x="5" y="2" width="21" height="8" fill="#808080"/>' +
      '<rect x="5" y="2" width="21" height="1" fill="#C0C0C0"/>' +
      '<rect x="5" y="2" width="1" height="8" fill="#C0C0C0"/>' +
      '<rect x="10" y="3" width="9" height="6" fill="#C0C0C0"/>' +
      '<rect x="10" y="3" width="1" height="6" fill="#808080"/>' +
      '<rect x="10" y="9" width="9" height="1" fill="#808080"/>' +
      inset(5, 11, 22, 18, "#FFFFFF") +
      '<rect x="7" y="13" width="16" height="1" fill="#808080"/>' +
      '<rect x="7" y="16" width="14" height="1" fill="#808080"/>' +
      '<rect x="7" y="19" width="12" height="1" fill="#808080"/>'
  ),

  /** Play triangle */
  play: svg(
    '<polygon points="5,2 5,30 27,16" fill="#008000"/>' +
      '<polygon points="5,2 5,30 27,16" fill="none" stroke="#000000" stroke-width="1"/>' +
      // Highlight on leading edge
      '<polygon points="5,2 5,10 13,6" fill="#00FF00"/>'
  ),

  /** Hand pointer cursor */
  hand: svg(
    // Index finger
    '<rect x="14" y="1" width="4" height="12" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Middle finger
      '<rect x="19" y="5" width="4" height="8" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Ring finger
      '<rect x="24" y="7" width="4" height="6" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Thumb
      '<rect x="9" y="9" width="4" height="4" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Palm body
      '<rect x="9" y="12" width="19" height="12" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Cuff
      '<rect x="9" y="24" width="10" height="4" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      '<rect x="20" y="24" width="8" height="4" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Knuckle shadows
      '<rect x="15" y="12" width="1" height="3" fill="#C0C0C0"/>' +
      '<rect x="20" y="12" width="1" height="3" fill="#C0C0C0"/>'
  ),

  /** Up-down double arrow */
  arrowBoth: svg(
    '<polygon points="16,1 7,12 11,12 11,20 7,20 16,31 25,20 21,20 21,12 25,12" fill="#000000"/>' +
      '<polygon points="16,1 7,12 11,12 11,20 7,20 16,31 25,20 21,20 21,12 25,12" fill="none" stroke="#808080" stroke-width="1"/>' +
      '<polygon points="16,1 7,12 10,12" fill="#C0C0C0"/>'
  ),

  /** X mark - clear / close */
  clear: svg(
    bevel(4, 4, 24, 24, "#C0C0C0") +
      '<line x1="9" y1="9" x2="23" y2="23" stroke="#800000" stroke-width="3"/>' +
      '<line x1="23" y1="9" x2="9" y2="23" stroke="#800000" stroke-width="3"/>' +
      '<line x1="9" y1="9" x2="22" y2="22" stroke="#FF0000" stroke-width="2"/>' +
      '<line x1="22" y1="9" x2="9" y2="22" stroke="#FF0000" stroke-width="2"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Start menu icons                                                    */
  /* ------------------------------------------------------------------ */

  /** Folder with arrow - Programs submenu */
  programs: svg(
    // Folder tab
    '<rect x="2" y="8" width="10" height="4" fill="#FFFF00"/>' +
      '<rect x="2" y="8" width="1" height="4" fill="#FFFFFF"/>' +
      '<rect x="2" y="8" width="10" height="1" fill="#FFFFFF"/>' +
      // Folder body
      bevel(2, 11, 22, 16, "#FFFF00") +
      '<rect x="3" y="12" width="20" height="1" fill="#FFFFFF"/>' +
      '<rect x="3" y="26" width="20" height="1" fill="#808000"/>' +
      // Arrow (submenu indicator)
      '<polygon points="22,16 26,12 26,20" fill="#000000"/>' +
      '<polygon points="22,16 26,12 24,12" fill="#C0C0C0"/>'
  ),

  /** Stack of documents */
  documents: svg(
    // Back document
    '<rect x="9" y="1" width="18" height="22" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Middle document
      '<rect x="5" y="5" width="18" height="22" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>' +
      // Front document
      bevel(1, 9, 18, 22, "#FFFFFF") +
      '<rect x="2" y="10" width="16" height="20" fill="#FFFFFF"/>' +
      '<rect x="4" y="14" width="10" height="1" fill="#000000"/>' +
      '<rect x="4" y="17" width="10" height="1" fill="#000000"/>' +
      '<rect x="4" y="20" width="7" height="1" fill="#000000"/>' +
      '<rect x="4" y="23" width="10" height="1" fill="#808080"/>' +
      '<rect x="4" y="26" width="8" height="1" fill="#808080"/>'
  ),

  /** Magnifying glass - Find */
  find: svg(
    // Glass rim (inset circle)
    '<rect x="3" y="3" width="18" height="18" fill="#FFFFFF" rx="9"/>' +
      '<rect x="3" y="3" width="18" height="18" fill="none" stroke="#000000" stroke-width="3" rx="9"/>' +
      // Glass highlight
      '<rect x="5" y="5" width="8" height="2" fill="#C0C0C0"/>' +
      '<rect x="5" y="5" width="2" height="6" fill="#C0C0C0"/>' +
      // Handle
      '<rect x="18" y="19" width="11" height="5" fill="#808000" transform="rotate(-45 22 22)"/>' +
      '<rect x="18" y="19" width="11" height="2" fill="#FFFF00" transform="rotate(-45 22 22)"/>' +
      '<rect x="18" y="19" width="2" height="5" fill="#FFFF00" transform="rotate(-45 22 22)"/>'
  ),

  /** Power button - Shutdown */
  shutdown: svg(
    // Power symbol circle
    '<rect x="4" y="4" width="24" height="24" fill="#C0C0C0" rx="12"/>' +
      '<rect x="4" y="4" width="24" height="24" fill="none" stroke="#000000" stroke-width="2" rx="12"/>' +
      // Highlight
      '<rect x="5" y="4" width="14" height="1" fill="#FFFFFF"/>' +
      '<rect x="4" y="5" width="1" height="14" fill="#FFFFFF"/>' +
      // Power icon (circle with gap + vertical line)
      '<rect x="15" y="8" width="2" height="8" fill="#FF0000"/>' +
      '<rect x="15" y="8" width="2" height="2" fill="#800000"/>' +
      // Arc (power symbol)
      '<rect x="10" y="11" width="2" height="2" fill="#FF0000"/>' +
      '<rect x="9" y="13" width="2" height="4" fill="#FF0000"/>' +
      '<rect x="9" y="17" width="2" height="2" fill="#FF0000"/>' +
      '<rect x="10" y="19" width="2" height="2" fill="#FF0000"/>' +
      '<rect x="12" y="21" width="2" height="1" fill="#FF0000"/>' +
      '<rect x="20" y="11" width="2" height="2" fill="#FF0000"/>' +
      '<rect x="21" y="13" width="2" height="4" fill="#FF0000"/>' +
      '<rect x="21" y="17" width="2" height="2" fill="#FF0000"/>' +
      '<rect x="20" y="19" width="2" height="2" fill="#FF0000"/>' +
      '<rect x="18" y="21" width="2" height="1" fill="#FF0000"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Control Panel icons                                                 */
  /* ------------------------------------------------------------------ */

  /** CRT monitor - Display settings */
  display: svg(
    bevel(3, 1, 26, 20, "#C0C0C0") +
      inset(6, 3, 20, 14, "#008080") +
      // Screen content (color bars)
      '<rect x="7" y="4" width="4" height="12" fill="#FF0000"/>' +
      '<rect x="11" y="4" width="4" height="12" fill="#00FF00"/>' +
      '<rect x="15" y="4" width="4" height="12" fill="#0000FF"/>' +
      '<rect x="19" y="4" width="5" height="12" fill="#FFFF00"/>' +
      // Neck and base
      '<rect x="13" y="21" width="6" height="3" fill="#C0C0C0"/>' +
      '<rect x="13" y="21" width="6" height="1" fill="#808080"/>' +
      bevel(7, 24, 18, 4, "#C0C0C0") +
      // Control knobs
      '<rect x="25" y="8" width="3" height="3" fill="#808080"/>' +
      '<rect x="25" y="8" width="3" height="1" fill="#C0C0C0"/>' +
      '<rect x="25" y="13" width="3" height="3" fill="#808080"/>' +
      '<rect x="25" y="13" width="3" height="1" fill="#C0C0C0"/>'
  ),

  /** Speaker with sound waves */
  sound: svg(
    // Speaker cabinet
    bevel(2, 8, 9, 16, "#808080") +
      // Speaker cone
      '<polygon points="11,8 18,2 18,30 11,24" fill="#C0C0C0"/>' +
      '<polygon points="11,8 18,2 18,6" fill="#FFFFFF"/>' +
      '<polygon points="11,8 11,24 13,22 13,10" fill="#808080"/>' +
      // Sound waves
      '<rect x="21" y="8" width="1" height="2" fill="#000000"/>' +
      '<rect x="22" y="7" width="1" height="4" fill="#000000"/>' +
      '<rect x="23" y="9" width="1" height="2" fill="#000000"/>' +
      '<rect x="25" y="6" width="1" height="2" fill="#000000"/>' +
      '<rect x="26" y="5" width="1" height="6" fill="#000000"/>' +
      '<rect x="27" y="4" width="1" height="8" fill="#000000"/>' +
      '<rect x="25" y="21" width="1" height="2" fill="#000000"/>' +
      '<rect x="26" y="20" width="1" height="6" fill="#000000"/>' +
      '<rect x="27" y="19" width="1" height="8" fill="#000000"/>' +
      '<rect x="25" y="13" width="1" height="4" fill="#000000"/>' +
      '<rect x="26" y="13" width="1" height="5" fill="#000000"/>'
  ),

  /** Theater masks - Props settings */
  props: svg(
    // Happy mask (right/yellow)
    '<rect x="16" y="4" width="13" height="16" fill="#FFFF00" rx="4"/>' +
      '<rect x="16" y="4" width="13" height="16" fill="none" stroke="#000000" stroke-width="1" rx="4"/>' +
      '<rect x="16" y="4" width="7" height="1" fill="#FFFFFF"/>' +
      '<rect x="16" y="4" width="1" height="8" fill="#FFFFFF"/>' +
      '<rect x="19" y="8" width="3" height="3" fill="#000000"/>' +
      '<rect x="25" y="8" width="3" height="3" fill="#000000"/>' +
      '<rect x="18" y="16" width="2" height="1" fill="#000000"/>' +
      '<rect x="20" y="17" width="4" height="1" fill="#000000"/>' +
      '<rect x="24" y="16" width="2" height="1" fill="#000000"/>' +
      // Sad mask (left/white)
      '<rect x="3" y="8" width="13" height="16" fill="#FFFFFF" rx="4"/>' +
      '<rect x="3" y="8" width="13" height="16" fill="none" stroke="#000000" stroke-width="1" rx="4"/>' +
      '<rect x="3" y="8" width="7" height="1" fill="#FFFFFF"/>' +
      '<rect x="3" y="8" width="1" height="8" fill="#FFFFFF"/>' +
      '<rect x="6" y="12" width="3" height="3" fill="#000000"/>' +
      '<rect x="11" y="12" width="3" height="3" fill="#000000"/>' +
      '<rect x="5" y="21" width="2" height="1" fill="#000000"/>' +
      '<rect x="7" y="20" width="4" height="1" fill="#000000"/>' +
      '<rect x="11" y="21" width="2" height="1" fill="#000000"/>'
  ),

  /** Keyboard */
  keyboard: svg(
    bevel(1, 8, 30, 18, "#C0C0C0") +
      // Key rows - top row
      '<rect x="3" y="10" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="3" y="10" width="3" height="1" fill="#FFFFFF"/>' +
      '<rect x="7" y="10" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="11" y="10" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="15" y="10" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="19" y="10" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="23" y="10" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="27" y="10" width="2" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      // Bottom row
      '<rect x="3" y="15" width="4" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="8" y="15" width="15" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
      '<rect x="24" y="15" width="5" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>'
  ),

  /** Mouse */
  mouse: svg(
    // Mouse body
    '<rect x="9" y="3" width="14" height="22" fill="#C0C0C0" rx="7"/>' +
      '<rect x="9" y="3" width="14" height="22" fill="none" stroke="#000000" stroke-width="1" rx="7"/>' +
      // Highlight
      '<rect x="10" y="3" width="8" height="1" fill="#FFFFFF"/>' +
      '<rect x="9" y="4" width="1" height="10" fill="#FFFFFF"/>' +
      // Button divider
      '<rect x="15" y="3" width="1" height="10" fill="#808080"/>' +
      // Scroll wheel
      '<rect x="14" y="10" width="4" height="5" fill="#808080" rx="2"/>' +
      '<rect x="14" y="10" width="4" height="1" fill="#C0C0C0"/>' +
      // Cord
      '<rect x="15" y="25" width="2" height="6" fill="#808080"/>' +
      '<rect x="17" y="28" width="4" height="2" fill="#808080"/>' +
      '<rect x="21" y="26" width="2" height="5" fill="#808080"/>'
  ),

  /** Globe with grid - Network */
  network: svg(
    // Globe body
    '<rect x="2" y="2" width="24" height="24" fill="#000080" rx="12"/>' +
      '<rect x="2" y="2" width="24" height="24" fill="none" stroke="#000000" stroke-width="1" rx="12"/>' +
      // Globe grid lines
      '<rect x="2" y="13" width="24" height="1" fill="#0000FF"/>' +
      '<rect x="13" y="2" width="1" height="24" fill="#0000FF"/>' +
      '<rect x="7" y="3" width="1" height="22" fill="#0000FF"/>' +
      '<rect x="19" y="3" width="1" height="22" fill="#0000FF"/>' +
      '<rect x="3" y="7" width="22" height="1" fill="#0000FF"/>' +
      '<rect x="3" y="19" width="22" height="1" fill="#0000FF"/>' +
      // Highlight
      '<rect x="4" y="2" width="12" height="1" fill="#00FFFF"/>' +
      '<rect x="2" y="3" width="1" height="12" fill="#00FFFF"/>' +
      // Network cable below
      '<rect x="12" y="26" width="4" height="4" fill="#C0C0C0"/>' +
      '<rect x="8" y="29" width="16" height="2" fill="#C0C0C0"/>' +
      '<rect x="8" y="29" width="16" height="1" fill="#FFFFFF"/>'
  ),

  /** Calendar - Date/Time */
  datetime: svg(
    bevel(2, 2, 28, 28, "#FFFFFF") +
      // Header (red, like a real desk calendar)
      '<rect x="3" y="3" width="26" height="6" fill="#FF0000"/>' +
      '<rect x="3" y="3" width="26" height="1" fill="#FF00FF"/>' + // highlight
      '<rect x="3" y="3" width="1" height="6" fill="#FF00FF"/>' +
      // Rings
      '<rect x="10" y="1" width="3" height="4" fill="#808080"/>' +
      '<rect x="19" y="1" width="3" height="4" fill="#808080"/>' +
      '<rect x="10" y="1" width="3" height="2" fill="#C0C0C0"/>' +
      '<rect x="19" y="1" width="3" height="2" fill="#C0C0C0"/>' +
      // Day number "15" on header
      '<rect x="8" y="4" width="2" height="4" fill="#FFFFFF"/>' +
      '<rect x="10" y="4" width="2" height="1" fill="#FFFFFF"/>' +
      '<rect x="10" y="7" width="2" height="1" fill="#FFFFFF"/>' +
      '<rect x="14" y="4" width="2" height="4" fill="#FFFFFF"/>' +
      '<rect x="16" y="4" width="2" height="2" fill="#FFFFFF"/>' +
      '<rect x="14" y="6" width="2" height="1" fill="#FFFFFF"/>' +
      '<rect x="14" y="7" width="4" height="1" fill="#FFFFFF"/>' +
      // Grid of date numbers (black squares)
      '<rect x="4" y="12" width="3" height="3" fill="#808080"/>' +
      '<rect x="8" y="12" width="3" height="3" fill="#808080"/>' +
      '<rect x="12" y="12" width="3" height="3" fill="#808080"/>' +
      '<rect x="16" y="12" width="3" height="3" fill="#808080"/>' +
      '<rect x="20" y="12" width="3" height="3" fill="#808080"/>' +
      '<rect x="24" y="12" width="3" height="3" fill="#808080"/>' +
      '<rect x="4" y="17" width="3" height="3" fill="#000000"/>' +
      '<rect x="8" y="17" width="3" height="3" fill="#000000"/>' +
      '<rect x="12" y="17" width="3" height="3" fill="#000000"/>' +
      '<rect x="16" y="17" width="3" height="3" fill="#FF0000"/>' + // today highlighted
      '<rect x="20" y="17" width="3" height="3" fill="#000000"/>' +
      '<rect x="24" y="17" width="3" height="3" fill="#000000"/>' +
      '<rect x="4" y="22" width="3" height="3" fill="#000000"/>' +
      '<rect x="8" y="22" width="3" height="3" fill="#000000"/>' +
      '<rect x="12" y="22" width="3" height="3" fill="#000000"/>'
  ),

  /** Blue circle with "i" - About / Info */
  info: svg(
    '<rect x="4" y="2" width="24" height="28" fill="#0000FF" rx="12"/>' +
      '<rect x="4" y="2" width="24" height="28" fill="none" stroke="#000000" stroke-width="1" rx="12"/>' +
      // Highlight
      '<rect x="5" y="2" width="14" height="1" fill="#00FFFF"/>' +
      '<rect x="4" y="3" width="1" height="14" fill="#00FFFF"/>' +
      // "i" dot
      '<rect x="13" y="6" width="6" height="5" fill="#FFFFFF"/>' +
      '<rect x="13" y="6" width="6" height="1" fill="#C0C0C0"/>' +
      // "i" stem
      '<rect x="13" y="13" width="6" height="12" fill="#FFFFFF"/>' +
      '<rect x="13" y="13" width="6" height="1" fill="#C0C0C0"/>' +
      // Serif base
      '<rect x="11" y="24" width="10" height="2" fill="#FFFFFF"/>'
  ),

  /** Printer (Control Panel) */
  printers: svg(
    bevel(7, 1, 18, 8, "#FFFFFF") +
      '<rect x="9" y="3" width="12" height="5" fill="#FFFFFF"/>' +
      bevel(3, 8, 26, 14, "#C0C0C0") +
      bevel(7, 20, 18, 9, "#FFFFFF") +
      '<rect x="9" y="22" width="12" height="6" fill="#FFFFFF"/>' +
      '<rect x="9" y="24" width="8" height="1" fill="#808080"/>' +
      '<rect x="5" y="12" width="3" height="3" fill="#00FF00"/>' +
      '<rect x="5" y="12" width="3" height="1" fill="#008000"/>' +
      '<rect x="7" y="17" width="18" height="2" fill="#808080"/>' +
      '<rect x="7" y="17" width="18" height="1" fill="#C0C0C0"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Miscellaneous                                                       */
  /* ------------------------------------------------------------------ */

  /** Warning triangle */
  warning: svg(
    '<polygon points="16,2 1,29 31,29" fill="#FFFF00"/>' +
      '<polygon points="16,2 1,29 31,29" fill="none" stroke="#000000" stroke-width="1"/>' +
      // Highlight on upper-left edge
      '<polygon points="16,2 1,29 4,29" fill="#FFFFFF"/>' +
      // Shadow on right edge
      '<polygon points="16,2 31,29 28,29" fill="#808000"/>' +
      // Exclamation mark
      '<rect x="14" y="9" width="4" height="12" fill="#000000"/>' +
      '<rect x="14" y="9" width="4" height="1" fill="#808000"/>' +
      '<rect x="14" y="24" width="4" height="4" fill="#000000"/>'
  ),

  /** Hourglass - loading */
  hourglass: svg(
    // Top cap
    bevel(5, 1, 22, 3, "#808080") +
      // Bottom cap
      bevel(5, 28, 22, 3, "#808080") +
      // Top glass (upper half)
      '<polygon points="6,4 26,4 19,16 13,16" fill="#FFFF00"/>' +
      '<polygon points="6,4 8,4 13,16 13,16" fill="#FFFFFF"/>' +
      '<polygon points="26,4 24,4 19,16" fill="#808080"/>' +
      // Bottom glass (lower half)
      '<polygon points="6,28 26,28 19,16 13,16" fill="#FFFF00"/>' +
      '<polygon points="6,28 8,28 13,16" fill="#FFFFFF"/>' +
      '<polygon points="26,28 24,28 19,16" fill="#808080"/>' +
      // Sand grain in middle
      '<rect x="14" y="15" width="4" height="2" fill="#808000"/>'
  ),

  /** Open book */
  book: svg(
    // Spine
    '<rect x="14" y="2" width="4" height="28" fill="#808000"/>' +
      '<rect x="14" y="2" width="4" height="1" fill="#FFFF00"/>' +
      '<rect x="14" y="2" width="1" height="28" fill="#FFFF00"/>' +
      // Left page
      bevel(2, 3, 12, 26, "#FFFFFF") +
      '<rect x="3" y="4" width="10" height="24" fill="#FFFFFF"/>' +
      '<rect x="4" y="7" width="8" height="1" fill="#808080"/>' +
      '<rect x="4" y="10" width="8" height="1" fill="#808080"/>' +
      '<rect x="4" y="13" width="6" height="1" fill="#808080"/>' +
      '<rect x="4" y="16" width="8" height="1" fill="#808080"/>' +
      '<rect x="4" y="19" width="5" height="1" fill="#808080"/>' +
      '<rect x="4" y="22" width="7" height="1" fill="#808080"/>' +
      '<rect x="4" y="25" width="4" height="1" fill="#808080"/>' +
      // Right page
      bevel(18, 3, 12, 26, "#FFFFFF") +
      '<rect x="19" y="4" width="10" height="24" fill="#FFFFFF"/>' +
      '<rect x="20" y="7" width="8" height="1" fill="#808080"/>' +
      '<rect x="20" y="10" width="8" height="1" fill="#808080"/>' +
      '<rect x="20" y="13" width="5" height="1" fill="#808080"/>' +
      '<rect x="20" y="16" width="8" height="1" fill="#808080"/>' +
      '<rect x="20" y="19" width="6" height="1" fill="#808080"/>' +
      '<rect x="20" y="22" width="7" height="1" fill="#808080"/>'
  ),

  /** ABC letters block */
  letters: svg(
    // A block (blue)
    bevel(1, 4, 10, 16, "#000080") +
      '<rect x="2" y="5" width="8" height="14" fill="#000080"/>' +
      '<polygon points="6,7 2,18 10,18" fill="#000080"/>' +
      '<rect x="3" y="7" width="6" height="1" fill="#FFFFFF"/>' +
      '<polygon points="6,7 3,7 2,9" fill="#00FFFF"/>' +
      '<rect x="3" y="13" width="6" height="1" fill="#FFFFFF"/>' +
      '<rect x="2" y="14" width="3" height="4" fill="#FFFFFF"/>' +
      '<rect x="7" y="14" width="3" height="4" fill="#FFFFFF"/>' +
      // B block (green)
      bevel(11, 8, 10, 16, "#008000") +
      '<rect x="12" y="9" width="8" height="14" fill="#008000"/>' +
      '<rect x="13" y="10" width="3" height="12" fill="#FFFFFF"/>' +
      '<rect x="13" y="10" width="5" height="1" fill="#FFFFFF"/>' +
      '<rect x="13" y="16" width="5" height="1" fill="#FFFFFF"/>' +
      '<rect x="13" y="22" width="5" height="1" fill="#FFFFFF"/>' +
      '<rect x="17" y="11" width="2" height="4" fill="#FFFFFF"/>' +
      '<rect x="17" y="17" width="2" height="4" fill="#FFFFFF"/>' +
      // C block (dark red)
      bevel(21, 12, 10, 16, "#800000") +
      '<rect x="22" y="13" width="8" height="14" fill="#800000"/>' +
      '<rect x="23" y="14" width="6" height="1" fill="#FFFFFF"/>' +
      '<rect x="22" y="15" width="2" height="10" fill="#FFFFFF"/>' +
      '<rect x="23" y="25" width="6" height="1" fill="#FFFFFF"/>'
  ),

  /** Pin / map marker - Grid positions */
  mappin: svg(
    // Pin head (circle)
    '<rect x="10" y="2" width="12" height="12" fill="#FF0000" rx="6"/>' +
      '<rect x="10" y="2" width="12" height="12" fill="none" stroke="#000000" stroke-width="1" rx="6"/>' +
      '<rect x="11" y="2" width="7" height="1" fill="#FF00FF"/>' +
      '<rect x="10" y="3" width="1" height="7" fill="#FF00FF"/>' +
      // Inner dot (white)
      '<rect x="13" y="5" width="6" height="6" fill="#FFFFFF" rx="3"/>' +
      '<rect x="13" y="5" width="4" height="1" fill="#FFFFFF"/>' +
      // Pin point (triangle)
      '<polygon points="16,14 11,24 21,24" fill="#FF0000"/>' +
      '<polygon points="16,14 11,24 13,24" fill="#800000"/>' +
      '<polygon points="16,28 13,24 19,24" fill="#FF0000"/>' +
      '<polygon points="16,28 13,24 15,24" fill="#800000"/>'
  ),

  /** Circular arrows - Turns and rotation */
  rotate: svg(
    // Circle track
    '<rect x="6" y="2" width="20" height="20" fill="none" stroke="#000000" stroke-width="3" rx="10"/>' +
      // Colored track highlight (upper half lighter)
      '<rect x="7" y="2" width="14" height="2" fill="#C0C0C0"/>' +
      '<rect x="6" y="4" width="2" height="8" fill="#C0C0C0"/>' +
      // Arrow head at top-right (clockwise)
      '<polygon points="24,4 28,4 24,8" fill="#000000"/>' +
      '<polygon points="24,4 28,4 26,4" fill="#C0C0C0"/>' +
      // Arrow head at bottom-left (counter)
      '<polygon points="8,20 4,20 8,16" fill="#000000"/>' +
      // Track shadow bottom-right
      '<rect x="20" y="18" width="6" height="2" fill="#808080"/>' +
      '<rect x="24" y="10" width="2" height="8" fill="#808080"/>'
  ),

  /** Musical notes - Building sequences */
  musicnotes: svg(
    // Note 1 stem
    '<rect x="7" y="2" width="2" height="18" fill="#000000"/>' +
      // Note 1 flag
      '<rect x="9" y="2" width="6" height="2" fill="#000000"/>' +
      '<rect x="15" y="2" width="2" height="6" fill="#000000"/>' +
      // Note 1 head (oval)
      '<rect x="4" y="18" width="6" height="4" fill="#000000" rx="2"/>' +
      '<rect x="5" y="18" width="3" height="1" fill="#808080"/>' +
      // Note 2 stem
      '<rect x="19" y="4" width="2" height="18" fill="#000000"/>' +
      // Note 2 head
      '<rect x="16" y="20" width="6" height="4" fill="#000000" rx="2"/>' +
      '<rect x="17" y="20" width="3" height="1" fill="#808080"/>' +
      // Beam connecting the two
      '<rect x="9" y="2" width="10" height="3" fill="#000000"/>'
  ),

  /**
   * Staff - Two crossed staves with blue and red tips.
   * The primary TKA prop and the hallmark of the entire notation system.
   */
  staff: svg(
    // Staff 1: NW to SE diagonal (thicker)
    '<rect x="3" y="3" width="3" height="3" fill="#808000"/>' +
      '<rect x="6" y="6" width="3" height="3" fill="#808000"/>' +
      '<rect x="9" y="9" width="3" height="3" fill="#808000"/>' +
      '<rect x="12" y="12" width="3" height="3" fill="#808000"/>' +
      '<rect x="15" y="15" width="3" height="3" fill="#808000"/>' +
      '<rect x="18" y="18" width="3" height="3" fill="#808000"/>' +
      '<rect x="21" y="21" width="3" height="3" fill="#808000"/>' +
      '<rect x="24" y="24" width="3" height="3" fill="#808000"/>' +
      // Staff 1 shading (right/bottom edge of each segment)
      '<rect x="8" y="6" width="1" height="3" fill="#000000"/>' +
      '<rect x="11" y="9" width="1" height="3" fill="#000000"/>' +
      '<rect x="14" y="12" width="1" height="3" fill="#000000"/>' +
      '<rect x="17" y="15" width="1" height="3" fill="#000000"/>' +
      '<rect x="20" y="18" width="1" height="3" fill="#000000"/>' +
      '<rect x="23" y="21" width="1" height="3" fill="#000000"/>' +
      // Staff 1 blue tip (NW)
      '<rect x="2" y="2" width="5" height="5" fill="#0000FF"/>' +
      '<rect x="2" y="2" width="5" height="1" fill="#00FFFF"/>' +
      '<rect x="2" y="2" width="1" height="5" fill="#00FFFF"/>' +
      // Staff 1 red tip (SE)
      '<rect x="25" y="25" width="5" height="5" fill="#FF0000"/>' +
      '<rect x="25" y="25" width="5" height="1" fill="#FF00FF"/>' +
      '<rect x="25" y="25" width="1" height="5" fill="#FF00FF"/>' +
      // Staff 2: NE to SW diagonal
      '<rect x="3" y="24" width="3" height="3" fill="#808000"/>' +
      '<rect x="6" y="21" width="3" height="3" fill="#808000"/>' +
      '<rect x="9" y="18" width="3" height="3" fill="#808000"/>' +
      '<rect x="12" y="15" width="3" height="3" fill="#808000"/>' +
      '<rect x="15" y="12" width="3" height="3" fill="#808000"/>' +
      '<rect x="18" y="9" width="3" height="3" fill="#808000"/>' +
      '<rect x="21" y="6" width="3" height="3" fill="#808000"/>' +
      '<rect x="24" y="3" width="3" height="3" fill="#808000"/>' +
      // Staff 2 red tip (NE)
      '<rect x="25" y="2" width="5" height="5" fill="#FF0000"/>' +
      '<rect x="25" y="2" width="5" height="1" fill="#FF00FF"/>' +
      '<rect x="25" y="2" width="1" height="5" fill="#FF00FF"/>' +
      // Staff 2 blue tip (SW)
      '<rect x="2" y="25" width="5" height="5" fill="#0000FF"/>' +
      '<rect x="2" y="25" width="5" height="1" fill="#00FFFF"/>' +
      '<rect x="2" y="25" width="1" height="5" fill="#00FFFF"/>'
  ),

  /**
   * Fire - Stylized flame with inner glow layers.
   * Flow arts is fire performance - this earns more detail than a generic flame.
   */
  fire: svg(
    // Outer flame (deep red)
    '<polygon points="16,1 10,8 7,14 7,20 10,26 16,30 22,26 25,20 25,14 22,8" fill="#800000"/>' +
      // Middle flame (red)
      '<polygon points="16,4 11,10 9,16 9,21 12,26 16,29 20,26 23,21 23,16 21,10" fill="#FF0000"/>' +
      // Inner flame (orange/dark yellow)
      '<polygon points="16,7 12,13 11,18 12,22 16,26 20,22 21,18 20,13" fill="#808000"/>' +
      // Core (bright yellow)
      '<polygon points="16,10 13,16 13,20 16,24 19,20 19,16" fill="#FFFF00"/>' +
      // White-hot center tip
      '<polygon points="16,12 14,17 14,19 16,22 18,19 18,17" fill="#FFFFFF"/>' +
      // Flame edge highlights (left edge)
      '<polygon points="16,4 11,10 12,10" fill="#FF00FF"/>' +
      '<polygon points="9,16 10,16 11,18" fill="#FF0000"/>' +
      // Dark base (ember)
      '<rect x="11" y="27" width="10" height="3" fill="#800000"/>' +
      '<rect x="11" y="27" width="10" height="1" fill="#FF0000"/>'
  ),

  /** Sun */
  sun: svg(
    // Central disc
    '<rect x="9" y="9" width="14" height="14" fill="#FFFF00" rx="7"/>' +
      '<rect x="9" y="9" width="14" height="14" fill="none" stroke="#808000" stroke-width="1" rx="7"/>' +
      '<rect x="10" y="9" width="8" height="1" fill="#FFFFFF"/>' +
      '<rect x="9" y="10" width="1" height="8" fill="#FFFFFF"/>' +
      // Rays (cardinal)
      '<rect x="14" y="1" width="4" height="6" fill="#FFFF00"/>' +
      '<rect x="14" y="1" width="4" height="1" fill="#FFFFFF"/>' +
      '<rect x="14" y="25" width="4" height="6" fill="#FFFF00"/>' +
      '<rect x="14" y="30" width="4" height="1" fill="#808000"/>' +
      '<rect x="1" y="14" width="6" height="4" fill="#FFFF00"/>' +
      '<rect x="1" y="14" width="1" height="4" fill="#FFFFFF"/>' +
      '<rect x="25" y="14" width="6" height="4" fill="#FFFF00"/>' +
      '<rect x="30" y="14" width="1" height="4" fill="#808000"/>' +
      // Rays (diagonal)
      '<rect x="4" y="4" width="4" height="4" fill="#FFFF00"/>' +
      '<rect x="4" y="4" width="2" height="1" fill="#FFFFFF"/>' +
      '<rect x="4" y="4" width="1" height="2" fill="#FFFFFF"/>' +
      '<rect x="24" y="4" width="4" height="4" fill="#FFFF00"/>' +
      '<rect x="24" y="4" width="3" height="1" fill="#FFFFFF"/>' +
      '<rect x="4" y="24" width="4" height="4" fill="#FFFF00"/>' +
      '<rect x="24" y="24" width="4" height="4" fill="#FFFF00"/>' +
      '<rect x="27" y="24" width="1" height="4" fill="#808000"/>'
  ),

  /** Swirl / spiral - screensaver */
  swirl: svg(
    // Spiral path built from rectangles
    '<rect x="13" y="2" width="6" height="2" fill="#800080"/>' +
      '<rect x="19" y="2" width="2" height="6" fill="#800080"/>' +
      '<rect x="21" y="4" width="4" height="2" fill="#800080"/>' +
      '<rect x="25" y="4" width="2" height="14" fill="#800080"/>' +
      '<rect x="23" y="18" width="4" height="2" fill="#800080"/>' +
      '<rect x="21" y="20" width="2" height="2" fill="#800080"/>' +
      '<rect x="5" y="20" width="18" height="2" fill="#800080"/>' +
      '<rect x="5" y="8" width="2" height="14" fill="#800080"/>' +
      '<rect x="7" y="8" width="4" height="2" fill="#800080"/>' +
      '<rect x="11" y="8" width="2" height="2" fill="#800080"/>' +
      '<rect x="9" y="10" width="2" height="6" fill="#800080"/>' +
      '<rect x="11" y="14" width="6" height="2" fill="#800080"/>' +
      '<rect x="17" y="10" width="2" height="6" fill="#800080"/>' +
      '<rect x="13" y="10" width="4" height="2" fill="#FF00FF"/>' +
      '<rect x="13" y="12" width="2" height="2" fill="#FF00FF"/>' +
      '<rect x="15" y="12" width="2" height="2" fill="#FF00FF"/>'
  ),

  /** Star / sparkle */
  sparkle: svg(
    '<polygon points="16,1 19,11 30,11 21,17 24,28 16,22 8,28 11,17 2,11 13,11" fill="#FFFF00"/>' +
      '<polygon points="16,1 19,11 30,11 21,17 24,28 16,22 8,28 11,17 2,11 13,11" fill="none" stroke="#808000" stroke-width="1"/>' +
      // Highlights
      '<polygon points="16,1 13,11 14,11" fill="#FFFFFF"/>' +
      '<polygon points="2,11 11,17 11,16" fill="#FFFFFF"/>' +
      '<rect x="15" y="2" width="2" height="3" fill="#FFFFFF"/>'
  ),

  /**
   * TKA Logo - Four-pane flag shape.
   * TKA's spin on the classic Windows logo: cardinal motion lines replace the
   * wavy divider, and the pane colors reference the TKA color system.
   * Upper-left = TKA blue (left hand), upper-right = TKA red (right hand),
   * lower-left = prop gold, lower-right = motion green.
   */
  tkaLogo: svg(
    // Upper-left pane (TKA blue - left hand)
    bevel(1, 1, 13, 13, "#000080") +
      '<rect x="2" y="2" width="11" height="11" fill="#000080"/>' +
      // Diamond grid mini icon in upper-left pane
      '<rect x="7" y="3" width="1" height="9" fill="#0000FF"/>' +
      '<rect x="3" y="7" width="9" height="1" fill="#0000FF"/>' +
      '<rect x="7" y="3" width="1" height="1" fill="#FFFFFF"/>' +
      '<rect x="7" y="11" width="1" height="1" fill="#FFFFFF"/>' +
      '<rect x="3" y="7" width="1" height="1" fill="#FFFFFF"/>' +
      '<rect x="11" y="7" width="1" height="1" fill="#FFFFFF"/>' +
      // Upper-right pane (TKA red - right hand)
      bevel(18, 1, 13, 13, "#800000") +
      '<rect x="19" y="2" width="11" height="11" fill="#800000"/>' +
      // Letter "T" in upper-right pane
      '<rect x="20" y="4" width="9" height="2" fill="#FF0000"/>' +
      '<rect x="23" y="6" width="3" height="6" fill="#FF0000"/>' +
      // Lower-left pane (prop gold)
      bevel(1, 18, 13, 13, "#808000") +
      '<rect x="2" y="19" width="11" height="11" fill="#808000"/>' +
      // Staff diagonal in lower-left pane
      '<rect x="3" y="20" width="2" height="2" fill="#FFFF00"/>' +
      '<rect x="5" y="22" width="2" height="2" fill="#FFFF00"/>' +
      '<rect x="7" y="24" width="2" height="2" fill="#FFFF00"/>' +
      '<rect x="9" y="26" width="2" height="2" fill="#FFFF00"/>' +
      '<rect x="3" y="20" width="2" height="2" fill="#0000FF"/>' + // blue tip
      '<rect x="9" y="26" width="2" height="2" fill="#FF0000"/>' + // red tip
      // Lower-right pane (motion green)
      bevel(18, 18, 13, 13, "#008000") +
      '<rect x="19" y="19" width="11" height="11" fill="#008000"/>' +
      // Letter "A" in lower-right pane
      '<rect x="20" y="28" width="2" height="2" fill="#00FF00"/>' +
      '<rect x="27" y="28" width="2" height="2" fill="#00FF00"/>' +
      '<rect x="22" y="22" width="5" height="2" fill="#00FF00"/>' +
      '<rect x="22" y="20" width="1" height="2" fill="#00FF00"/>' +
      '<rect x="26" y="20" width="1" height="2" fill="#00FF00"/>' +
      '<rect x="21" y="24" width="2" height="4" fill="#00FF00"/>' +
      '<rect x="26" y="24" width="2" height="4" fill="#00FF00"/>' +
      // Center divider cross (black gap between panes)
      '<rect x="14" y="1" width="4" height="30" fill="#000000"/>' +
      '<rect x="1" y="14" width="30" height="4" fill="#000000"/>' +
      // Center crosshair (bright highlight on dividers)
      '<rect x="14" y="1" width="1" height="13" fill="#C0C0C0"/>' +
      '<rect x="14" y="18" width="1" height="13" fill="#C0C0C0"/>' +
      '<rect x="1" y="14" width="13" height="1" fill="#C0C0C0"/>' +
      '<rect x="18" y="14" width="13" height="1" fill="#C0C0C0"/>'
  ),

  /** Computer - desktop (for save dialog tree) */
  computer: svg(
    bevel(3, 1, 26, 20, "#C0C0C0") +
      inset(6, 3, 20, 14, "#008080") +
      '<rect x="15" y="4" width="2" height="12" fill="#00FFFF"/>' +
      '<rect x="9" y="9" width="14" height="2" fill="#00FFFF"/>' +
      '<rect x="13" y="21" width="6" height="3" fill="#C0C0C0"/>' +
      '<rect x="13" y="21" width="6" height="1" fill="#808080"/>' +
      bevel(7, 24, 18, 4, "#C0C0C0")
  ),
} as const;

export type RetroIconName = keyof typeof RETRO_ICONS;
