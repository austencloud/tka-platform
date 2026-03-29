export function renderSmartBorders(
  ctx: CanvasRenderingContext2D,
  options: {
    columns: number;
    rows: number;
    cellSize: number;
    offsetY: number;
    occupiedCells: Set<string>; // "col,row" format
    darkMode: boolean;
  }
): void {
  const { columns, rows, cellSize, offsetY, occupiedCells, darkMode } = options;
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.15)" : "#e0e0e0";
  ctx.lineWidth = 1;

  const isOccupied = (col: number, row: number) => occupiedCells.has(`${col},${row}`);

  // Vertical lines between horizontally adjacent occupied cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns - 1; col++) {
      if (isOccupied(col, row) && isOccupied(col + 1, row)) {
        const x = (col + 1) * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, row * cellSize + offsetY);
        ctx.lineTo(x, (row + 1) * cellSize + offsetY);
        ctx.stroke();
      }
    }
  }

  // Horizontal lines between vertically adjacent occupied cells
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows - 1; row++) {
      if (isOccupied(col, row) && isOccupied(col, row + 1)) {
        const y = (row + 1) * cellSize + offsetY;
        ctx.beginPath();
        ctx.moveTo(col * cellSize, y);
        ctx.lineTo((col + 1) * cellSize, y);
        ctx.stroke();
      }
    }
  }

  // Outer borders for occupied edge cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (!isOccupied(col, row)) continue;
      const x = col * cellSize;
      const y = row * cellSize + offsetY;

      if (row === 0 || !isOccupied(col, row - 1)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellSize, y); ctx.stroke();
      }
      if (row === rows - 1 || !isOccupied(col, row + 1)) {
        ctx.beginPath(); ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke();
      }
      if (col === 0 || !isOccupied(col - 1, row)) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellSize); ctx.stroke();
      }
      if (col === columns - 1 || !isOccupied(col + 1, row)) {
        ctx.beginPath(); ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); ctx.stroke();
      }
    }
  }
}
