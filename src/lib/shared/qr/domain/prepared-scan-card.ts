export interface PreparedScanCell {
  index: number;
  label: string;
  imageUrl: string;
  duration: number;
  widthMultiplier: number;
}

export interface PreparedScanCard {
  word: string;
  isSolo: boolean;
  cells: PreparedScanCell[];
  hasMixedDurations: boolean;
}
