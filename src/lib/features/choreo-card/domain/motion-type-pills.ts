/**
 * Shared motion type abbreviations and colors for the color-coded pill display.
 * Each motion type maps to a short label and canonical TKA hand colors.
 * Dual types (where both hands do different things) get two distinct colors.
 */

export const MOTION_TYPE_INFO: Record<string, { abbrev: string; colors: [string, string] }> = {
  'Dual-Shift':  { abbrev: 'DS', colors: ['#36c3ff', '#6F2DA8'] },
  'Shift':       { abbrev: 'Sh', colors: ['#6F2DA8', '#6F2DA8'] },
  'Cross-Shift': { abbrev: 'CS', colors: ['#26e600', '#6F2DA8'] },
  'Dash':        { abbrev: 'D',  colors: ['#26e600', '#26e600'] },
  'Dual-Dash':   { abbrev: 'DD', colors: ['#00b3ff', '#26e600'] },
  'Static':      { abbrev: 'St', colors: ['#eb7d00', '#eb7d00'] },
};

export interface PillData {
  abbrev: string;
  full: string;
  colors: [string, string];
  isDual: boolean;
}

/** Parses "Dual-Dash+Static+Dash" into pill data for each beat's motion type. */
export function parseFamilyLabel(label: string): PillData[] {
  return label.split('+').map((seg) => {
    const name = (seg ?? '').trim();
    const info = MOTION_TYPE_INFO[name];
    const colors: [string, string] = info?.colors ?? ['#888', '#888'];
    return {
      abbrev: info?.abbrev ?? name,
      full: name,
      colors,
      isDual: colors[0] !== colors[1],
    };
  });
}
