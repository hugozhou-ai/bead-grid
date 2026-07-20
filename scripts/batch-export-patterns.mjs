import { availableParallelism } from "node:os";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { beadLabelColor, PALETTE, PALETTE_NAME, RGB_PALETTE } from "../app/bead-palette.ts";
import { createPatternFromPixels, getExportLayout } from "../app/image-processing.ts";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULTS = Object.freeze({
  gridWidth: 64,
  gridHeight: 64,
  colorLimit: 10,
  removeBackground: false,
  pegboardSize: 52,
  samplesPerCell: 4,
  concurrency: Math.max(1, Math.min(2, availableParallelism())),
});

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} 必须是正整数`);
  return parsed;
}

function parseBoolean(value, label) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${label} 只能是 true 或 false`);
}

function parseGrid(value) {
  const match = /^(\d+)[x×](\d+)$/i.exec(value);
  if (!match) throw new Error("--grid 必须使用 64x64 格式");
  return {
    gridWidth: parsePositiveInteger(match[1], "网格宽度"),
    gridHeight: parsePositiveInteger(match[2], "网格高度"),
  };
}

export function parseBatchOptions(args, cwd = process.cwd()) {
  const options = { ...DEFAULTS, input: "", output: "" };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--input") options.input = value ?? "";
    else if (argument === "--output") options.output = value ?? "";
    else if (argument === "--grid") Object.assign(options, parseGrid(value ?? ""));
    else if (argument === "--colors") options.colorLimit = parsePositiveInteger(value, "颜色数量");
    else if (argument === "--pegboard") options.pegboardSize = parsePositiveInteger(value, "拼豆板尺寸");
    else if (argument === "--remove-background") options.removeBackground = parseBoolean(value, "移除背景");
    else if (argument === "--concurrency") options.concurrency = parsePositiveInteger(value, "并发数");
    else throw new Error(`未知参数：${argument}`);
    index += 1;
  }
  if (!options.input) throw new Error("缺少 --input 输入目录");
  if (!options.output) throw new Error("缺少 --output 输出目录");
  if (options.gridWidth < 8 || options.gridHeight < 8 || options.gridWidth > 160 || options.gridHeight > 160) {
    throw new Error("网格尺寸必须在 8–160 之间");
  }
  if (options.colorLimit < 3 || options.colorLimit > PALETTE.length) {
    throw new Error(`颜色数量必须在 3–${PALETTE.length} 之间`);
  }
  return {
    ...options,
    input: path.resolve(cwd, options.input),
    output: path.resolve(cwd, options.output),
  };
}

async function collectImageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectImageFiles(target);
    return entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [target] : [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function makeGridPath(width, height, cell) {
  const commands = [];
  for (let x = 0; x <= width; x += 1) commands.push(`M${x * cell} 0V${height * cell}`);
  for (let y = 0; y <= height; y += 1) commands.push(`M0 ${y * cell}H${width * cell}`);
  return commands.join("");
}

function makePegboardPath(width, height, cell, pegboardSize) {
  const commands = [];
  for (let x = 0; x <= width; x += pegboardSize) commands.push(`M${x * cell} 0V${height * cell}`);
  for (let y = 0; y <= height; y += pegboardSize) commands.push(`M0 ${y * cell}H${width * cell}`);
  commands.push(`M${width * cell} 0V${height * cell}`, `M0 ${height * cell}H${width * cell}`);
  return commands.join("");
}

export function renderPatternSvg(cells, width, height, pegboardSize) {
  if (cells.length !== width * height) throw new Error("图纸格子数量与尺寸不一致");
  const colorMap = new Map(PALETTE.map((color) => [color.code, color]));
  const frequency = new Map();
  for (const code of cells) if (code) frequency.set(code, (frequency.get(code) ?? 0) + 1);
  const usage = [...frequency.entries()]
    .map(([code, count]) => ({ color: colorMap.get(code), count }))
    .sort((left, right) => right.count - left.count);
  const total = usage.reduce((sum, item) => sum + item.count, 0);
  const {
    cell,
    labelGutter,
    gridPixelWidth,
    gridPixelHeight,
    legendTop,
    legendPadding,
    legendHeaderHeight,
    legendItemHeight,
    legendColumns,
    outputWidth,
    outputHeight,
  } = getExportLayout(width, height, usage.length);
  const beadFontSize = Math.max(9, cell * .29);
  const axisFontSize = Math.max(9, cell * .26);
  const beads = cells.flatMap((code, index) => {
    if (!code) return [];
    const color = colorMap.get(code);
    if (!color) throw new Error(`图纸包含未知色号：${code}`);
    const x = (index % width) * cell + cell / 2;
    const y = Math.floor(index / width) * cell + cell / 2;
    return [
      `<circle cx="${x}" cy="${y}" r="${cell * .4}" fill="${color.hex}"/>`,
      `<text x="${x}" y="${y}" fill="${beadLabelColor(color)}" font-size="${beadFontSize}" text-anchor="middle" dominant-baseline="central">${escapeXml(code)}</text>`,
    ];
  }).join("");
  const columnLabels = Array.from({ length: width }, (_, x) => {
    const centerX = labelGutter + x * cell + cell / 2;
    const label = x + 1;
    return `<text x="${centerX}" y="${labelGutter / 2}" text-anchor="middle" dominant-baseline="central">${label}</text><text x="${centerX}" y="${labelGutter + gridPixelHeight + labelGutter / 2}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }).join("");
  const rowLabels = Array.from({ length: height }, (_, y) => {
    const centerY = labelGutter + y * cell + cell / 2;
    const label = y + 1;
    return `<text x="${labelGutter / 2}" y="${centerY}" text-anchor="middle" dominant-baseline="central">${label}</text><text x="${labelGutter + gridPixelWidth + labelGutter / 2}" y="${centerY}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }).join("");
  const legendWidth = outputWidth - legendPadding * 2;
  const columnWidth = legendColumns ? legendWidth / legendColumns : 0;
  const legendItems = usage.map(({ color, count }, index) => {
    if (!color) throw new Error("材料清单包含未知色号");
    const column = index % legendColumns;
    const row = Math.floor(index / legendColumns);
    const x = legendPadding + column * columnWidth;
    const y = legendTop + legendPadding + legendHeaderHeight + row * legendItemHeight + legendItemHeight / 2;
    const swatchRadius = Math.max(12, cell * .24);
    return `<circle cx="${x + swatchRadius}" cy="${y}" r="${swatchRadius}" fill="${color.hex}" stroke="#514b42" stroke-width="${Math.max(1.5, cell * .025)}"/><text x="${x + swatchRadius * 2 + cell * .18}" y="${y}" text-anchor="start" dominant-baseline="central">${escapeXml(`${color.code} · ${color.name}`)}</text><text x="${x + columnWidth - cell * .22}" y="${y}" text-anchor="end" dominant-baseline="central">${count} 颗</text>`;
  }).join("");
  const legend = usage.length ? `<g font-family="LXGW WenKai, sans-serif" font-weight="700"><path d="M${legendPadding} ${legendTop}H${outputWidth - legendPadding}" stroke="#756c60" stroke-width="${Math.max(2, cell * .05)}"/><text x="${legendPadding}" y="${legendTop + legendPadding + legendHeaderHeight / 2}" fill="#282722" font-size="${Math.max(20, cell * .42)}" dominant-baseline="central">材料清单</text><text x="${outputWidth - legendPadding}" y="${legendTop + legendPadding + legendHeaderHeight / 2}" fill="#756c60" font-size="${Math.max(15, cell * .27)}" text-anchor="end" dominant-baseline="central">共 ${total} 颗 · ${usage.length} 种颜色</text><g fill="#282722" font-size="${Math.max(16, cell * .31)}">${legendItems}</g></g>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
  <rect width="100%" height="100%" fill="#fffdf8"/>
  <g transform="translate(${labelGutter} ${labelGutter})" font-family="LXGW WenKai, sans-serif" font-weight="700">
    ${beads}
    <path d="${makeGridPath(width, height, cell)}" fill="none" stroke="#d8d0c2" stroke-width="${Math.max(1, cell * .025)}"/>
    <path d="${makePegboardPath(width, height, cell, pegboardSize)}" fill="none" stroke="#756c60" stroke-width="${Math.max(2.5, cell * .085)}"/>
  </g>
  <g fill="#514b42" font-family="LXGW WenKai, sans-serif" font-size="${axisFontSize}" font-weight="700">${columnLabels}${rowLabels}</g>
  ${legend}
</svg>`;
}

async function processImage(sourcePath, options) {
  const sampleWidth = options.gridWidth * options.samplesPerCell;
  const sampleHeight = options.gridHeight * options.samplesPerCell;
  const sourceMetadata = await sharp(sourcePath, { failOn: "error" }).metadata();
  const { data } = await sharp(sourcePath, { failOn: "error" })
    .ensureAlpha()
    .resize(sampleWidth, sampleHeight, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { cells, backgroundCode, allowedCodes } = createPatternFromPixels(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    options.gridWidth,
    options.gridHeight,
    options.samplesPerCell,
    RGB_PALETTE,
    options.colorLimit,
    options.removeBackground,
  );
  const relativeSource = path.relative(options.input, sourcePath);
  const parsed = path.parse(relativeSource);
  const relativeOutput = path.join(parsed.dir, `${parsed.name}-${options.gridWidth}x${options.gridHeight}.png`);
  const outputPath = path.join(options.output, relativeOutput);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const svg = renderPatternSvg(cells, options.gridWidth, options.gridHeight, options.pegboardSize);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toFile(outputPath);
  const outputBuffer = await readFile(outputPath);
  const outputMetadata = await sharp(outputBuffer).metadata();
  const usedColorCounts = {};
  for (const code of cells) if (code) usedColorCounts[code] = (usedColorCounts[code] ?? 0) + 1;
  return {
    source: relativeSource,
    output: relativeOutput,
    sourceWidth: sourceMetadata.width,
    sourceHeight: sourceMetadata.height,
    outputWidth: outputMetadata.width,
    outputHeight: outputMetadata.height,
    beadCount: cells.filter(Boolean).length,
    usedColorCounts,
    allowedCodes,
    backgroundCode,
    sha256: createHash("sha256").update(outputBuffer).digest("hex"),
  };
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function consume() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
  return results;
}

export function renderBatchReadme(manifest) {
  const { settings } = manifest;
  return `拼豆图纸批量导出\n\n生成参数：\n- 网格：${settings.gridWidth} × ${settings.gridHeight}\n- 颜色上限：${settings.colorLimit} 色\n- 自动移除背景：${settings.removeBackground ? "开启" : "关闭"}\n- 拼豆板尺寸：${settings.pegboardSize} × ${settings.pegboardSize}\n- 色板：${settings.palette}\n- 图纸数量：${manifest.outputCount} 张\n- 单张图纸像素尺寸：${manifest.files[0]?.outputWidth ?? "-"} × ${manifest.files[0]?.outputHeight ?? "-"}\n\n每张 PNG 均包含逐豆色号、行列编号、细网格和拼豆板粗分界线。manifest.json 记录逐文件来源、颜色用量、图纸尺寸和 SHA-256。\n`;
}

export async function batchExport(options) {
  const inputStats = await stat(options.input);
  if (!inputStats.isDirectory()) throw new Error("--input 必须指向目录");
  await mkdir(options.output, { recursive: true });
  const imageFiles = await collectImageFiles(options.input);
  if (!imageFiles.length) throw new Error("输入目录中没有 JPG、PNG 或 WEBP 图片");
  const startedAt = new Date().toISOString();
  let completed = 0;
  const files = await mapConcurrent(imageFiles, options.concurrency, async (sourcePath) => {
    const result = await processImage(sourcePath, options);
    completed += 1;
    process.stdout.write(`${JSON.stringify({ event: "exported", current: completed, total: imageFiles.length, source: result.source, output: result.output })}\n`);
    return result;
  });
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    startedAt,
    settings: {
      gridWidth: options.gridWidth,
      gridHeight: options.gridHeight,
      colorLimit: options.colorLimit,
      removeBackground: options.removeBackground,
      pegboardSize: options.pegboardSize,
      samplesPerCell: options.samplesPerCell,
      palette: PALETTE_NAME,
    },
    inputCount: imageFiles.length,
    outputCount: files.length,
    files,
  };
  await writeFile(path.join(options.output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(options.output, "README.txt"), renderBatchReadme(manifest), "utf8");
  return manifest;
}

async function main() {
  try {
    const options = parseBatchOptions(process.argv.slice(2));
    const manifest = await batchExport(options);
    process.stdout.write(`${JSON.stringify({ event: "complete", output: options.output, count: manifest.outputCount, settings: manifest.settings })}\n`);
  } catch (error) {
    console.error("[BEAD_BATCH_EXPORT]", JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
