export interface PropSvgData {
  svg: string;
  width: number;
  height: number;
}

export interface ISVGGenerator {
  generateGridSvg(gridMode?: string | unknown): string;
  generatePropSvg(propType: string, color: string): Promise<PropSvgData>;
  generateBluePropSvg(propType?: string, darkMode?: boolean): Promise<PropSvgData>;
  generateRedPropSvg(propType?: string, darkMode?: boolean): Promise<PropSvgData>;
}
