/**
 * Grid Position Deriver
 *
 * Maps between grid position names (alpha1, beta5, gamma11) and hand location pairs.
 * A position represents the combination of (left_hand_location, right_hand_location).
 *
 * Ported from the app's GridPositionDeriver using string literals instead of enums.
 */

export class GridPositionDeriver {
  private readonly positionsMap = new Map<string, string>([
    // Alpha positions - hands in opposite/inverted directions
    ["s,n", "alpha1"],
    ["sw,ne", "alpha2"],
    ["w,e", "alpha3"],
    ["nw,se", "alpha4"],
    ["n,s", "alpha5"],
    ["ne,sw", "alpha6"],
    ["e,w", "alpha7"],
    ["se,nw", "alpha8"],

    // Beta positions - both hands same direction
    ["n,n", "beta1"],
    ["ne,ne", "beta2"],
    ["e,e", "beta3"],
    ["se,se", "beta4"],
    ["s,s", "beta5"],
    ["sw,sw", "beta6"],
    ["w,w", "beta7"],
    ["nw,nw", "beta8"],

    // Gamma positions - mixed/varied combinations
    ["w,n", "gamma1"],
    ["nw,ne", "gamma2"],
    ["n,e", "gamma3"],
    ["ne,se", "gamma4"],
    ["e,s", "gamma5"],
    ["se,sw", "gamma6"],
    ["s,w", "gamma7"],
    ["sw,nw", "gamma8"],
    ["e,n", "gamma9"],
    ["se,ne", "gamma10"],
    ["s,e", "gamma11"],
    ["sw,se", "gamma12"],
    ["w,s", "gamma13"],
    ["nw,sw", "gamma14"],
    ["n,w", "gamma15"],
    ["ne,nw", "gamma16"],

    // Zeta positions - 135 degree obtuse angle (skewed mode)
    ["sw,n", "zeta1"],
    ["w,ne", "zeta2"],
    ["nw,e", "zeta3"],
    ["n,se", "zeta4"],
    ["ne,s", "zeta5"],
    ["e,sw", "zeta6"],
    ["se,w", "zeta7"],
    ["s,nw", "zeta8"],
    ["se,n", "zeta9"],
    ["s,ne", "zeta10"],
    ["sw,e", "zeta11"],
    ["w,se", "zeta12"],
    ["nw,s", "zeta13"],
    ["n,sw", "zeta14"],
    ["ne,w", "zeta15"],
    ["e,nw", "zeta16"],

    // Eta positions - 45 degree acute angle (skewed mode)
    ["nw,n", "eta1"],
    ["n,ne", "eta2"],
    ["ne,e", "eta3"],
    ["e,se", "eta4"],
    ["se,s", "eta5"],
    ["s,sw", "eta6"],
    ["sw,w", "eta7"],
    ["w,nw", "eta8"],
    ["ne,n", "eta9"],
    ["e,ne", "eta10"],
    ["se,e", "eta11"],
    ["s,se", "eta12"],
    ["sw,s", "eta13"],
    ["w,sw", "eta14"],
    ["nw,w", "eta15"],
    ["n,nw", "eta16"],
  ]);

  // Reverse mapping from position to hand locations
  private readonly locationPairsMap: Map<string, [string, string]>;

  constructor() {
    this.locationPairsMap = new Map();
    this.positionsMap.forEach((position, locationKey) => {
      const [leftLocation, rightLocation] = locationKey.split(",");
      this.locationPairsMap.set(position, [leftLocation!, rightLocation!]);
    });
  }

  getGridPositionFromLocations(
    leftLocation: string,
    rightLocation: string
  ): string {
    const key = `${leftLocation},${rightLocation}`;
    const position = this.positionsMap.get(key);
    if (!position) {
      throw new Error(
        `No position found for locations: ${leftLocation}, ${rightLocation}`
      );
    }
    return position;
  }

  /**
   * Get the hand location pair for a given position
   */
  getGridLocationsFromPosition(position: string): [string, string] {
    const pair = this.locationPairsMap.get(position);
    if (!pair) {
      throw new Error(`No location pair found for position: ${position}`);
    }
    return pair;
  }
}

export const gridPositionDeriver = new GridPositionDeriver();
