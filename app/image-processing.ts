export type QuantizationColor = {
  code: string;
  rgb: [number, number, number];
};

export function nearestPaletteColor(r: number, g: number, b: number, palette: QuantizationColor[]) {
  if (!palette.length) return null;
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const [cr, cg, cb] = candidate.rgb;
    const distance = 0.3 * (r - cr) ** 2 + 0.59 * (g - cg) ** 2 + 0.11 * (b - cb) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.code;
}

export function quantizeGridByMode(
  pixels: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  samplesPerCell: number,
  palette: QuantizationColor[],
) {
  const sampleWidth = targetWidth * samplesPerCell;
  const expectedLength = sampleWidth * targetHeight * samplesPerCell * 4;
  if (pixels.length !== expectedLength) throw new Error("采样像素数量与目标网格不一致");

  return Array.from({ length: targetWidth * targetHeight }, (_, cellIndex) => {
    const cellX = cellIndex % targetWidth;
    const cellY = Math.floor(cellIndex / targetWidth);
    const frequency = new Map<string | null, number>();
    for (let sampleY = 0; sampleY < samplesPerCell; sampleY += 1) {
      for (let sampleX = 0; sampleX < samplesPerCell; sampleX += 1) {
        const pixelIndex = (((cellY * samplesPerCell + sampleY) * sampleWidth) + cellX * samplesPerCell + sampleX) * 4;
        const code = pixels[pixelIndex + 3] < 70
          ? null
          : nearestPaletteColor(pixels[pixelIndex], pixels[pixelIndex + 1], pixels[pixelIndex + 2], palette);
        frequency.set(code, (frequency.get(code) ?? 0) + 1);
      }
    }

    let mode: string | null = null;
    let highestFrequency = -1;
    for (const [code, count] of frequency) {
      if (count > highestFrequency) {
        mode = code;
        highestFrequency = count;
      }
    }
    return mode;
  });
}

export function getExportCellSize(width: number, height: number) {
  const longestEdge = Math.max(1, width, height);
  return Math.max(32, Math.min(96, Math.ceil(4096 / longestEdge)));
}
