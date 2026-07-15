export function getRectangleSelection(
  startIndex: number,
  endIndex: number,
  width: number,
  grid: Array<string | null>,
  baseSelection: Set<number>,
  additive: boolean,
) {
  const startX = startIndex % width;
  const startY = Math.floor(startIndex / width);
  const endX = endIndex % width;
  const endY = Math.floor(endIndex / width);
  const next = additive ? new Set(baseSelection) : new Set<number>();
  for (let y = Math.min(startY, endY); y <= Math.max(startY, endY); y += 1) {
    for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x += 1) {
      const index = y * width + x;
      if (grid[index]) next.add(index);
    }
  }
  return next;
}

export function addSelectionLine(
  fromIndex: number,
  toIndex: number,
  width: number,
  grid: Array<string | null>,
  selection: Set<number>,
) {
  let x0 = fromIndex % width;
  let y0 = Math.floor(fromIndex / width);
  const x1 = toIndex % width;
  const y1 = Math.floor(toIndex / width);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  const next = new Set(selection);
  while (true) {
    const index = y0 * width + x0;
    if (grid[index]) next.add(index);
    if (x0 === x1 && y0 === y1) break;
    const doubledError = error * 2;
    if (doubledError >= dy) {
      error += dy;
      x0 += stepX;
    }
    if (doubledError <= dx) {
      error += dx;
      y0 += stepY;
    }
  }
  return next;
}
