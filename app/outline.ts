export type OutlineResult = {
  cells: Array<string | null>;
  width: number;
  height: number;
  addedCount: number;
  offsetX: number;
  offsetY: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const ORTHOGONAL_OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

function getOccupiedBounds(cells: Array<string | null>, width: number): Bounds | null {
  let minX = width;
  let minY = Math.ceil(cells.length / width);
  let maxX = -1;
  let maxY = -1;
  cells.forEach((code, index) => {
    if (code === null) return;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function getExteriorEmptyCells(cells: Array<string | null>, width: number, height: number) {
  const exterior = new Uint8Array(cells.length);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (cells[index] !== null || exterior[index]) return;
    exterior[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
  return exterior;
}

export function createOuterOutline(
  cells: Array<string | null>,
  width: number,
  height: number,
  outlineCode: string,
  maxGridSize: number,
): OutlineResult {
  const bounds = getOccupiedBounds(cells, width);
  if (!bounds) return { cells: [...cells], width, height, addedCount: 0, offsetX: 0, offsetY: 0 };

  const subjectWidth = bounds.maxX - bounds.minX + 1;
  const subjectHeight = bounds.maxY - bounds.minY + 1;
  if (subjectWidth + 2 > maxGridSize || subjectHeight + 2 > maxGridSize) {
    throw new Error(`主体尺寸过大，无法在 ${maxGridSize} × ${maxGridSize} 网格内完整添加描边`);
  }

  const nextWidth = Math.max(width, subjectWidth + 2);
  const nextHeight = Math.max(height, subjectHeight + 2);
  const targetMinX = Math.max(1, Math.min(bounds.minX, nextWidth - subjectWidth - 1));
  const targetMinY = Math.max(1, Math.min(bounds.minY, nextHeight - subjectHeight - 1));
  const offsetX = targetMinX - bounds.minX;
  const offsetY = targetMinY - bounds.minY;
  const next = Array<string | null>(nextWidth * nextHeight).fill(null);
  const occupiedIndices: number[] = [];

  cells.forEach((code, index) => {
    if (code === null) return;
    const x = index % width;
    const y = Math.floor(index / width);
    const nextIndex = (y + offsetY) * nextWidth + x + offsetX;
    next[nextIndex] = code;
    occupiedIndices.push(nextIndex);
  });

  const exterior = getExteriorEmptyCells(next, nextWidth, nextHeight);
  let addedCount = 0;
  occupiedIndices.forEach((index) => {
    const x = index % nextWidth;
    const y = Math.floor(index / nextWidth);
    ORTHOGONAL_OUTLINE_OFFSETS.forEach(([deltaX, deltaY]) => {
      const outlineX = x + deltaX;
      const outlineY = y + deltaY;
      if (outlineX < 0 || outlineY < 0 || outlineX >= nextWidth || outlineY >= nextHeight) return;
      const outlineIndex = outlineY * nextWidth + outlineX;
      if (!exterior[outlineIndex] || next[outlineIndex] !== null) return;
      next[outlineIndex] = outlineCode;
      addedCount += 1;
    });
  });

  return { cells: next, width: nextWidth, height: nextHeight, addedCount, offsetX, offsetY };
}
