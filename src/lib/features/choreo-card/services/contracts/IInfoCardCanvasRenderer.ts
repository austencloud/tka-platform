export interface InfoCardCanvasOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}

export interface IInfoCardCanvasRenderer {
  renderFront(options: InfoCardCanvasOptions): Promise<HTMLCanvasElement>;
  renderBack(options: InfoCardCanvasOptions): Promise<HTMLCanvasElement>;
}
