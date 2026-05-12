export class ProximityGrid<T> {
  private readonly cells = new Map<string, { item: T; tileX: number; tileY: number }[]>();
  private readonly cellSize: number;
  private count = 0;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  get size(): number {
    return this.count;
  }

  insert(item: T, tileX: number, tileY: number): void {
    const key = this.cellKey(tileX, tileY);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push({ item, tileX, tileY });
    this.count++;
  }

  queryRadius(centerX: number, centerY: number, radius: number): T[] {
    const r2 = radius * radius;
    const minCX = Math.floor((centerX - radius) / this.cellSize);
    const maxCX = Math.floor((centerX + radius) / this.cellSize);
    const minCY = Math.floor((centerY - radius) / this.cellSize);
    const maxCY = Math.floor((centerY + radius) / this.cellSize);

    const results: T[] = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const entry of cell) {
          const dx = entry.tileX - centerX;
          const dy = entry.tileY - centerY;
          if (dx * dx + dy * dy <= r2) {
            results.push(entry.item);
          }
        }
      }
    }
    return results;
  }

  private cellKey(tileX: number, tileY: number): string {
    return `${Math.floor(tileX / this.cellSize)},${Math.floor(tileY / this.cellSize)}`;
  }
}
