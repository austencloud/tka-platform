/**
 * TKA-OS v1.0 — Pixel Art Icon Library
 *
 * 16x16 SVG pixel art icons using the Windows 16-color palette.
 * Every icon uses integer coordinates and simple geometric shapes
 * for authentic 1995 rendering. No emojis — they didn't exist yet.
 *
 * Palette:
 *   #000000  #800000  #008000  #808000  #000080  #800080  #008080  #C0C0C0
 *   #808080  #FF0000  #00FF00  #FFFF00  #0000FF  #FF00FF  #00FFFF  #FFFFFF
 */

const SVG_OPEN = '<svg viewBox="0 0 16 16" width="16" height="16" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">';
const SVG_CLOSE = '</svg>';

function svg(inner: string): string {
  return `${SVG_OPEN}${inner}${SVG_CLOSE}`;
}

export const RETRO_ICONS = {
  /* ------------------------------------------------------------------ */
  /* Desktop icons                                                       */
  /* ------------------------------------------------------------------ */

  /** CRT monitor with blue screen and keyboard */
  mycomputer: svg(
    '<rect x="2" y="1" width="12" height="9" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="3" width="8" height="5" fill="#000080"/>' +
    '<rect x="6" y="11" width="4" height="1" fill="#C0C0C0"/>' +
    '<rect x="4" y="12" width="8" height="1" fill="#808080"/>' +
    '<rect x="3" y="13" width="10" height="1" fill="#C0C0C0" stroke="#000" stroke-width="1"/>'
  ),

  /** Notepad with pencil — the Scribe app icon */
  scribe: svg(
    '<rect x="3" y="1" width="10" height="13" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="4" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="6" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="8" width="4" height="1" fill="#000"/>' +
    '<rect x="5" y="10" width="5" height="1" fill="#000"/>' +
    '<rect x="1" y="11" width="1" height="4" fill="#FFFF00"/>' +
    '<rect x="2" y="10" width="1" height="4" fill="#FFFF00"/>' +
    '<rect x="3" y="9" width="1" height="4" fill="#808000"/>' +
    '<rect x="1" y="15" width="1" height="1" fill="#000"/>'
  ),

  /** Yellow closed folder */
  filemgr: svg(
    '<rect x="1" y="4" width="14" height="10" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="2" width="6" height="3" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="4" width="14" height="1" fill="#808000"/>'
  ),

  /** Graduation cap */
  tutor: svg(
    '<polygon points="8,2 1,6 8,10 15,6" fill="#000080" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="6" width="2" height="5" fill="#000080"/>' +
    '<rect x="4" y="11" width="8" height="2" fill="#000080" stroke="#000" stroke-width="1"/>' +
    '<rect x="13" y="6" width="1" height="6" fill="#808000"/>' +
    '<rect x="12" y="12" width="3" height="1" fill="#FFFF00"/>'
  ),

  /** Playing card — choreo card viewer */
  cards: svg(
    '<rect x="2" y="1" width="12" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1" rx="1"/>' +
    '<rect x="4" y="3" width="2" height="2" fill="#FF0000"/>' +
    '<rect x="10" y="11" width="2" height="2" fill="#FF0000"/>' +
    '<rect x="6" y="6" width="4" height="4" fill="#000080"/>'
  ),

  /** Gear — control panel / settings */
  control: svg(
    '<rect x="6" y="1" width="4" height="2" fill="#808080"/>' +
    '<rect x="6" y="13" width="4" height="2" fill="#808080"/>' +
    '<rect x="1" y="6" width="2" height="4" fill="#808080"/>' +
    '<rect x="13" y="6" width="2" height="4" fill="#808080"/>' +
    '<rect x="3" y="3" width="2" height="2" fill="#808080"/>' +
    '<rect x="11" y="3" width="2" height="2" fill="#808080"/>' +
    '<rect x="3" y="11" width="2" height="2" fill="#808080"/>' +
    '<rect x="11" y="11" width="2" height="2" fill="#808080"/>' +
    '<rect x="4" y="4" width="8" height="8" fill="#C0C0C0" stroke="#000" stroke-width="1" rx="4"/>' +
    '<rect x="6" y="6" width="4" height="4" fill="#808080" rx="2"/>'
  ),

  /** Golden crown — upgrade / shareware nag */
  upgrade: svg(
    '<rect x="2" y="8" width="12" height="5" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<polygon points="2,8 2,3 5,6" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<polygon points="8,8 8,2 11,6" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<polygon points="14,8 14,3 11,6" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="10" width="2" height="2" fill="#FF0000"/>' +
    '<rect x="7" y="10" width="2" height="2" fill="#0000FF"/>' +
    '<rect x="10" y="10" width="2" height="2" fill="#008000"/>'
  ),

  /** White document with text lines */
  readme: svg(
    '<rect x="3" y="1" width="10" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="3" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="5" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="7" width="5" height="1" fill="#000"/>' +
    '<rect x="5" y="9" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="11" width="4" height="1" fill="#000"/>'
  ),

  /** Yellow circle with question mark */
  help: svg(
    '<rect x="3" y="2" width="10" height="12" fill="#FFFF00" rx="5" stroke="#000" stroke-width="1"/>' +
    '<rect x="6" y="5" width="4" height="1" fill="#000"/>' +
    '<rect x="9" y="6" width="1" height="2" fill="#000"/>' +
    '<rect x="7" y="8" width="2" height="1" fill="#000"/>' +
    '<rect x="7" y="10" width="2" height="2" fill="#000"/>'
  ),

  /** Floppy disk with colored blocks — defrag */
  defrag: svg(
    '<rect x="2" y="1" width="12" height="14" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="1" width="8" height="4" fill="#808080"/>' +
    '<rect x="4" y="7" width="8" height="7" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="5" y="8" width="2" height="2" fill="#000080"/>' +
    '<rect x="7" y="8" width="2" height="2" fill="#008000"/>' +
    '<rect x="9" y="8" width="2" height="2" fill="#FF0000"/>' +
    '<rect x="5" y="10" width="2" height="2" fill="#FFFF00"/>' +
    '<rect x="7" y="10" width="2" height="2" fill="#000080"/>' +
    '<rect x="9" y="10" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>'
  ),

  /** Wire mesh trash can */
  recyclebin: svg(
    '<rect x="4" y="1" width="8" height="2" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="3" width="10" height="1" fill="#808080"/>' +
    '<rect x="4" y="4" width="8" height="10" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="6" y="5" width="1" height="8" fill="#808080"/>' +
    '<rect x="8" y="5" width="1" height="8" fill="#808080"/>' +
    '<rect x="10" y="5" width="1" height="8" fill="#808080"/>' +
    '<rect x="4" y="7" width="8" height="1" fill="#808080"/>' +
    '<rect x="4" y="10" width="8" height="1" fill="#808080"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* File / folder icons                                                 */
  /* ------------------------------------------------------------------ */

  /** Closed yellow folder */
  folder: svg(
    '<rect x="1" y="4" width="14" height="10" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="2" width="6" height="3" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="4" width="14" height="1" fill="#808000"/>'
  ),

  /** Open yellow folder */
  folderOpen: svg(
    '<rect x="1" y="2" width="6" height="3" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="4" width="12" height="10" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<polygon points="1,6 4,4 15,4 12,6" fill="#808000" stroke="#000" stroke-width="1"/>'
  ),

  /** Document with musical note — sequence file */
  fileSeq: svg(
    '<rect x="3" y="1" width="10" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="4" width="6" height="1" fill="#808080"/>' +
    '<rect x="5" y="6" width="6" height="1" fill="#808080"/>' +
    '<rect x="8" y="8" width="1" height="4" fill="#000080"/>' +
    '<rect x="6" y="11" width="3" height="2" fill="#000080" rx="1"/>'
  ),

  /** Gear — system file */
  fileSys: svg(
    '<rect x="3" y="1" width="10" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="6" y="5" width="4" height="4" fill="#808080" rx="2"/>' +
    '<rect x="7" y="3" width="2" height="1" fill="#808080"/>' +
    '<rect x="7" y="10" width="2" height="1" fill="#808080"/>' +
    '<rect x="4" y="6" width="1" height="2" fill="#808080"/>' +
    '<rect x="11" y="6" width="1" height="2" fill="#808080"/>'
  ),

  /** Text document */
  fileTxt: svg(
    '<rect x="3" y="1" width="10" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="4" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="6" width="6" height="1" fill="#000"/>' +
    '<rect x="5" y="8" width="4" height="1" fill="#000"/>' +
    '<rect x="5" y="10" width="5" height="1" fill="#000"/>'
  ),

  /** 3.5" floppy disk (blue) */
  floppy: svg(
    '<rect x="2" y="1" width="12" height="14" fill="#0000FF" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="1" width="8" height="4" fill="#808080"/>' +
    '<rect x="6" y="2" width="4" height="2" fill="#C0C0C0"/>' +
    '<rect x="4" y="8" width="8" height="6" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="5" y="9" width="6" height="1" fill="#808080"/>' +
    '<rect x="5" y="11" width="4" height="1" fill="#808080"/>'
  ),

  /** CD disc (silver) */
  cdrom: svg(
    '<rect x="3" y="3" width="10" height="10" fill="#C0C0C0" rx="5" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="7" width="2" height="2" fill="#808080" rx="1"/>' +
    '<rect x="5" y="4" width="1" height="1" fill="#FFFFFF"/>' +
    '<rect x="10" y="5" width="1" height="1" fill="#FFFFFF"/>' +
    '<rect x="4" y="8" width="1" height="1" fill="#808080"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Toolbar / UI icons                                                  */
  /* ------------------------------------------------------------------ */

  /** Left arrow */
  arrowLeft: svg(
    '<polygon points="3,8 11,3 11,6 13,6 13,10 11,10 11,13" fill="#000" />'
  ),

  /** Right arrow */
  arrowRight: svg(
    '<polygon points="13,8 5,3 5,6 3,6 3,10 5,10 5,13" fill="#000" />'
  ),

  /** Up arrow */
  arrowUp: svg(
    '<polygon points="8,3 3,11 6,11 6,13 10,13 10,11 13,11" fill="#000" />'
  ),

  /** Printer */
  printer: svg(
    '<rect x="4" y="1" width="8" height="4" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="2" y="5" width="12" height="6" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="10" width="8" height="4" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="7" width="2" height="1" fill="#008000"/>' +
    '<rect x="5" y="12" width="5" height="1" fill="#808080"/>'
  ),

  /** List view — horizontal lines */
  viewList: svg(
    '<rect x="2" y="3" width="2" height="2" fill="#000080"/>' +
    '<rect x="5" y="3" width="9" height="2" fill="#000"/>' +
    '<rect x="2" y="7" width="2" height="2" fill="#000080"/>' +
    '<rect x="5" y="7" width="9" height="2" fill="#000"/>' +
    '<rect x="2" y="11" width="2" height="2" fill="#000080"/>' +
    '<rect x="5" y="11" width="9" height="2" fill="#000"/>'
  ),

  /** Detail view — grid */
  viewDetails: svg(
    '<rect x="1" y="1" width="14" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="4" width="14" height="1" fill="#000"/>' +
    '<rect x="5" y="1" width="1" height="14" fill="#808080"/>' +
    '<rect x="10" y="1" width="1" height="14" fill="#808080"/>'
  ),

  /** New document */
  newDoc: svg(
    '<rect x="3" y="1" width="8" height="14" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<polygon points="11,1 14,4 11,4" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="11" y="4" width="3" height="11" fill="#FFFFFF" stroke="#000" stroke-width="1"/>'
  ),

  /** Save — same as floppy */
  save: svg(
    '<rect x="2" y="1" width="12" height="14" fill="#0000FF" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="1" width="8" height="4" fill="#808080"/>' +
    '<rect x="6" y="2" width="4" height="2" fill="#C0C0C0"/>' +
    '<rect x="4" y="8" width="8" height="6" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="5" y="9" width="6" height="1" fill="#808080"/>' +
    '<rect x="5" y="11" width="4" height="1" fill="#808080"/>'
  ),

  /** Play triangle */
  play: svg(
    '<polygon points="4,2 4,14 13,8" fill="#008000" stroke="#000" stroke-width="1"/>'
  ),

  /** Hand pointer */
  hand: svg(
    '<rect x="7" y="1" width="2" height="5" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="5" width="8" height="2" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="6" width="2" height="4" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="7" width="8" height="6" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="13" width="3" height="2" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="10" y="13" width="3" height="2" fill="#FFFFFF" stroke="#000" stroke-width="1"/>'
  ),

  /** Up-down arrows */
  arrowBoth: svg(
    '<polygon points="8,1 4,6 6,6 6,10 4,10 8,15 12,10 10,10 10,6 12,6" fill="#000"/>'
  ),

  /** X mark — clear / close */
  clear: svg(
    '<rect x="3" y="3" width="10" height="10" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<line x1="5" y1="5" x2="11" y2="11" stroke="#000" stroke-width="2"/>' +
    '<line x1="11" y1="5" x2="5" y2="11" stroke="#000" stroke-width="2"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Start menu icons                                                    */
  /* ------------------------------------------------------------------ */

  /** Folder with small arrow — programs submenu */
  programs: svg(
    '<rect x="1" y="4" width="12" height="9" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="2" width="5" height="3" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<polygon points="11,7 11,12 15,9" fill="#000"/>'
  ),

  /** Stack of documents */
  documents: svg(
    '<rect x="5" y="1" width="9" height="11" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="3" width="9" height="11" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="1" y="5" width="9" height="11" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="8" width="5" height="1" fill="#000"/>' +
    '<rect x="3" y="10" width="5" height="1" fill="#000"/>' +
    '<rect x="3" y="12" width="3" height="1" fill="#000"/>'
  ),

  /** Magnifying glass — find */
  find: svg(
    '<rect x="3" y="2" width="8" height="8" fill="#FFFFFF" rx="4" stroke="#000" stroke-width="2"/>' +
    '<rect x="10" y="9" width="2" height="5" fill="#808000" stroke="#000" stroke-width="1" transform="rotate(-45 11 11)"/>'
  ),

  /** Red power plug — shutdown */
  shutdown: svg(
    '<rect x="6" y="1" width="4" height="4" fill="#FF0000"/>' +
    '<rect x="5" y="5" width="6" height="3" fill="#FF0000" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="8" width="8" height="5" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="6" y="10" width="1" height="2" fill="#808080"/>' +
    '<rect x="9" y="10" width="1" height="2" fill="#808080"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Control Panel icons                                                 */
  /* ------------------------------------------------------------------ */

  /** CRT monitor — display settings */
  display: svg(
    '<rect x="2" y="1" width="12" height="9" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="3" width="8" height="5" fill="#008080"/>' +
    '<rect x="6" y="11" width="4" height="1" fill="#C0C0C0"/>' +
    '<rect x="4" y="12" width="8" height="1" fill="#808080"/>' +
    '<rect x="3" y="13" width="10" height="1" fill="#C0C0C0" stroke="#000" stroke-width="1"/>'
  ),

  /** Speaker with sound waves */
  sound: svg(
    '<rect x="2" y="5" width="4" height="6" fill="#808080" stroke="#000" stroke-width="1"/>' +
    '<polygon points="6,5 10,2 10,14 6,11" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="12" y="4" width="1" height="1" fill="#000"/>' +
    '<rect x="13" y="5" width="1" height="2" fill="#000"/>' +
    '<rect x="12" y="7" width="1" height="2" fill="#000"/>' +
    '<rect x="13" y="9" width="1" height="2" fill="#000"/>' +
    '<rect x="12" y="11" width="1" height="1" fill="#000"/>'
  ),

  /** Theater masks — props */
  props: svg(
    '<rect x="1" y="3" width="7" height="8" fill="#FFFFFF" rx="3" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="5" width="2" height="2" fill="#000"/>' +
    '<rect x="2" y="8" width="4" height="1" fill="#000"/>' +
    '<rect x="8" y="3" width="7" height="8" fill="#FFFF00" rx="3" stroke="#000" stroke-width="1"/>' +
    '<rect x="10" y="5" width="2" height="2" fill="#000"/>' +
    '<rect x="10" y="9" width="3" height="1" fill="#000"/>'
  ),

  /** Keyboard */
  keyboard: svg(
    '<rect x="1" y="5" width="14" height="8" fill="#C0C0C0" stroke="#000" stroke-width="1" rx="1"/>' +
    '<rect x="2" y="6" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="5" y="6" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="8" y="6" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="11" y="6" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="3" y="9" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="6" y="9" width="4" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="11" y="9" width="2" height="2" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>'
  ),

  /** Mouse device */
  mouse: svg(
    '<rect x="5" y="2" width="6" height="12" fill="#C0C0C0" rx="3" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="3" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="8" y="3" width="3" height="4" fill="#FFFFFF" stroke="#808080" stroke-width="1"/>' +
    '<rect x="7" y="1" width="2" height="3" fill="#808080"/>'
  ),

  /** Globe with grid — network */
  network: svg(
    '<rect x="2" y="2" width="12" height="12" fill="#0000FF" rx="6" stroke="#000" stroke-width="1"/>' +
    '<rect x="2" y="7" width="12" height="1" fill="#00FFFF"/>' +
    '<rect x="7" y="2" width="1" height="12" fill="#00FFFF"/>' +
    '<rect x="5" y="3" width="1" height="10" fill="#00FFFF"/>' +
    '<rect x="10" y="3" width="1" height="10" fill="#00FFFF"/>' +
    '<rect x="3" y="4" width="10" height="1" fill="#00FFFF"/>' +
    '<rect x="3" y="10" width="10" height="1" fill="#00FFFF"/>'
  ),

  /** Calendar page — date/time */
  datetime: svg(
    '<rect x="2" y="2" width="12" height="12" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="2" y="2" width="12" height="3" fill="#FF0000"/>' +
    '<rect x="4" y="6" width="2" height="2" fill="#000"/>' +
    '<rect x="7" y="6" width="2" height="2" fill="#000"/>' +
    '<rect x="10" y="6" width="2" height="2" fill="#000"/>' +
    '<rect x="4" y="9" width="2" height="2" fill="#000"/>' +
    '<rect x="7" y="9" width="2" height="2" fill="#808080"/>'
  ),

  /** Blue circle with "i" — about / info */
  info: svg(
    '<rect x="3" y="2" width="10" height="12" fill="#0000FF" rx="5" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="4" width="2" height="2" fill="#FFFFFF"/>' +
    '<rect x="7" y="7" width="2" height="5" fill="#FFFFFF"/>'
  ),

  /** Printer (for control panel — reuse of printer) */
  printers: svg(
    '<rect x="4" y="1" width="8" height="4" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="2" y="5" width="12" height="6" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="10" width="8" height="4" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="7" width="2" height="1" fill="#008000"/>' +
    '<rect x="5" y="12" width="5" height="1" fill="#808080"/>'
  ),

  /* ------------------------------------------------------------------ */
  /* Miscellaneous                                                       */
  /* ------------------------------------------------------------------ */

  /** Yellow triangle with "!" — warning */
  warning: svg(
    '<polygon points="8,1 1,14 15,14" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="5" width="2" height="5" fill="#000"/>' +
    '<rect x="7" y="11" width="2" height="2" fill="#000"/>'
  ),

  /** Hourglass — loading */
  hourglass: svg(
    '<rect x="3" y="1" width="10" height="2" fill="#808080" stroke="#000" stroke-width="1"/>' +
    '<rect x="3" y="13" width="10" height="2" fill="#808080" stroke="#000" stroke-width="1"/>' +
    '<polygon points="4,3 12,3 8,8" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<polygon points="4,13 12,13 8,8" fill="#FFFF00" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="7" width="2" height="2" fill="#808000"/>'
  ),

  /** Open book — concept card */
  book: svg(
    '<rect x="1" y="3" width="6" height="10" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="9" y="3" width="6" height="10" fill="#FFFFFF" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="2" width="2" height="12" fill="#808000" stroke="#000" stroke-width="1"/>' +
    '<rect x="2" y="5" width="4" height="1" fill="#808080"/>' +
    '<rect x="2" y="7" width="4" height="1" fill="#808080"/>' +
    '<rect x="10" y="5" width="4" height="1" fill="#808080"/>' +
    '<rect x="10" y="7" width="4" height="1" fill="#808080"/>'
  ),

  /** ABC letters — letters & types */
  letters: svg(
    '<rect x="1" y="4" width="5" height="8" fill="#000080"/>' +
    '<rect x="2" y="5" width="3" height="1" fill="#FFFFFF"/>' +
    '<rect x="2" y="7" width="3" height="1" fill="#FFFFFF"/>' +
    '<rect x="2" y="9" width="1" height="2" fill="#FFFFFF"/>' +
    '<rect x="4" y="9" width="1" height="2" fill="#FFFFFF"/>' +
    '<rect x="6" y="4" width="5" height="8" fill="#008000"/>' +
    '<rect x="7" y="5" width="3" height="1" fill="#FFFFFF"/>' +
    '<rect x="7" y="8" width="3" height="1" fill="#FFFFFF"/>' +
    '<rect x="7" y="11" width="3" height="1" fill="#FFFFFF"/>' +
    '<rect x="11" y="4" width="4" height="8" fill="#800000"/>' +
    '<rect x="12" y="5" width="2" height="1" fill="#FFFFFF"/>' +
    '<rect x="12" y="8" width="2" height="1" fill="#FFFFFF"/>' +
    '<rect x="12" y="11" width="2" height="1" fill="#FFFFFF"/>'
  ),

  /** Pin / map marker — grid positions */
  mappin: svg(
    '<rect x="5" y="2" width="6" height="6" fill="#FF0000" rx="3" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="4" width="2" height="2" fill="#FFFFFF"/>' +
    '<polygon points="8,8 6,13 10,13" fill="#FF0000" stroke="#000" stroke-width="1"/>'
  ),

  /** Circular arrows — turns & rotation */
  rotate: svg(
    '<rect x="3" y="2" width="10" height="1" fill="#000"/>' +
    '<rect x="2" y="3" width="1" height="4" fill="#000"/>' +
    '<rect x="13" y="3" width="1" height="4" fill="#000"/>' +
    '<rect x="2" y="7" width="1" height="4" fill="#000"/>' +
    '<rect x="13" y="7" width="1" height="4" fill="#000"/>' +
    '<rect x="3" y="13" width="10" height="1" fill="#000"/>' +
    '<polygon points="12,1 15,4 12,4" fill="#000"/>' +
    '<polygon points="4,12 4,15 1,12" fill="#000"/>'
  ),

  /** Musical notes — building sequences */
  musicnotes: svg(
    '<rect x="4" y="2" width="1" height="8" fill="#000"/>' +
    '<rect x="10" y="2" width="1" height="8" fill="#000"/>' +
    '<rect x="4" y="2" width="7" height="2" fill="#000"/>' +
    '<rect x="2" y="9" width="4" height="3" fill="#000" rx="1"/>' +
    '<rect x="8" y="9" width="4" height="3" fill="#000" rx="1"/>'
  ),

  /** Floating prop icons for screensaver — staff/baton */
  staff: svg(
    '<rect x="7" y="1" width="2" height="14" fill="#808000" stroke="#000" stroke-width="1"/>' +
    '<rect x="5" y="1" width="6" height="2" fill="#FF0000"/>' +
    '<rect x="5" y="13" width="6" height="2" fill="#0000FF"/>'
  ),

  /** Fire — for screensaver */
  fire: svg(
    '<polygon points="8,1 5,6 3,9 4,13 8,15 12,13 13,9 11,6" fill="#FF0000" stroke="#000" stroke-width="1"/>' +
    '<polygon points="8,4 6,8 5,11 8,13 11,11 10,8" fill="#FFFF00"/>' +
    '<rect x="7" y="8" width="2" height="4" fill="#FFFFFF"/>'
  ),

  /** Sun */
  sun: svg(
    '<rect x="5" y="5" width="6" height="6" fill="#FFFF00" rx="3" stroke="#000" stroke-width="1"/>' +
    '<rect x="7" y="1" width="2" height="3" fill="#FFFF00"/>' +
    '<rect x="7" y="12" width="2" height="3" fill="#FFFF00"/>' +
    '<rect x="1" y="7" width="3" height="2" fill="#FFFF00"/>' +
    '<rect x="12" y="7" width="3" height="2" fill="#FFFF00"/>' +
    '<rect x="3" y="3" width="2" height="2" fill="#FFFF00"/>' +
    '<rect x="11" y="3" width="2" height="2" fill="#FFFF00"/>' +
    '<rect x="3" y="11" width="2" height="2" fill="#FFFF00"/>' +
    '<rect x="11" y="11" width="2" height="2" fill="#FFFF00"/>'
  ),

  /** Swirl / spiral */
  swirl: svg(
    '<rect x="5" y="2" width="6" height="1" fill="#800080"/>' +
    '<rect x="3" y="3" width="2" height="1" fill="#800080"/>' +
    '<rect x="11" y="3" width="2" height="1" fill="#800080"/>' +
    '<rect x="2" y="4" width="1" height="3" fill="#800080"/>' +
    '<rect x="13" y="4" width="1" height="3" fill="#800080"/>' +
    '<rect x="3" y="7" width="1" height="2" fill="#800080"/>' +
    '<rect x="12" y="7" width="1" height="2" fill="#800080"/>' +
    '<rect x="4" y="9" width="1" height="2" fill="#800080"/>' +
    '<rect x="11" y="9" width="1" height="2" fill="#800080"/>' +
    '<rect x="5" y="11" width="6" height="1" fill="#800080"/>' +
    '<rect x="7" y="5" width="2" height="5" fill="#FF00FF"/>'
  ),

  /** Sparkles / star */
  sparkle: svg(
    '<polygon points="8,1 9,6 14,6 10,9 12,14 8,11 4,14 6,9 2,6 7,6" fill="#FFFF00" stroke="#000" stroke-width="1"/>'
  ),

  /** Computer / desktop — for save dialog tree */
  computer: svg(
    '<rect x="2" y="1" width="12" height="9" fill="#C0C0C0" stroke="#000" stroke-width="1"/>' +
    '<rect x="4" y="3" width="8" height="5" fill="#008080"/>' +
    '<rect x="6" y="11" width="4" height="1" fill="#C0C0C0"/>' +
    '<rect x="4" y="12" width="8" height="2" fill="#808080"/>'
  ),
} as const;

export type RetroIconName = keyof typeof RETRO_ICONS;
