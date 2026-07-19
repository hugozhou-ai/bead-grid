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

export function getExportLayout(width: number, height: number) {
  const cell = getExportCellSize(width, height);
  const labelGutter = Math.max(24, Math.ceil(cell * .85));
  const gridPixelWidth = width * cell;
  const gridPixelHeight = height * cell;
  return {
    cell,
    labelGutter,
    gridPixelWidth,
    gridPixelHeight,
    outputWidth: gridPixelWidth + labelGutter * 2,
    outputHeight: gridPixelHeight + labelGutter * 2,
  };
}

export function getDominantColorCode(cells: Array<string | null>) {
  const frequency = new Map<string, number>();
  for (const code of cells) if (code) frequency.set(code, (frequency.get(code) ?? 0) + 1);
  let dominantCode: string | null = null;
  let dominantCount = 0;
  for (const [code, count] of frequency) {
    if (count > dominantCount) {
      dominantCode = code;
      dominantCount = count;
    }
  }
  return dominantCode;
}

export function createPatternFromPixels(
  pixels: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  samplesPerCell: number,
  palette: QuantizationColor[],
  colorLimit: number,
  removeBackground: boolean,
) {
  const firstPass = quantizeGridByMode(
    pixels,
    targetWidth,
    targetHeight,
    samplesPerCell,
    palette,
  );
  const backgroundCode = removeBackground ? getDominantColorCode(firstPass) : null;
  const frequency = new Map<string, number>();
  for (const code of firstPass) {
    if (code && code !== backgroundCode) frequency.set(code, (frequency.get(code) ?? 0) + 1);
  }
  const allowedCodes = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, colorLimit)
    .map(([code]) => code);
  const allowed = palette.filter((color) => allowedCodes.includes(color.code));
  const quantized = allowedCodes.length >= frequency.size
    ? firstPass
    : quantizeGridByMode(pixels, targetWidth, targetHeight, samplesPerCell, allowed);
  const cells = quantized.map((code, index) => firstPass[index] === backgroundCode ? null : code);
  return { cells, backgroundCode, allowedCodes };
}
