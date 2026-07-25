import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { PALETTE, PALETTE_NAME } from "../app/bead-palette.ts";
import { getExportLayout } from "../app/image-processing.ts";
import { createProjectFile, serializeProjectFile } from "../app/project-format.ts";

const RGB_TO_CODE = new Map(PALETTE.map((color) => [color.hex.slice(1).toLowerCase(), color.code]));
const PATTERN_BACKGROUND = "fffdf8";

async function collectManifestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectManifestFiles(target);
    return entry.isFile() && entry.name === "manifest.json" ? [target] : [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function sortedCounts(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function countCells(cells) {
  const counts = {};
  for (const code of cells) if (code) counts[code] = (counts[code] ?? 0) + 1;
  return counts;
}

function validateExistingProject(projectBuffer, manifest, file, projectPath) {
  const project = JSON.parse(projectBuffer);
  const cells = project.cells;
  const validCodes = new Set(PALETTE.map((color) => color.code));
  const hasValidCells = Array.isArray(cells)
    && cells.length === manifest.settings.gridWidth * manifest.settings.gridHeight
    && cells.every((code) => code === null || validCodes.has(code));
  const actualCounts = hasValidCells ? sortedCounts(countCells(cells)) : {};
  const expectedCounts = sortedCounts(file.usedColorCounts ?? {});
  const valid = project.version === 3
    && project.width === manifest.settings.gridWidth
    && project.height === manifest.settings.gridHeight
    && project.palette === PALETTE_NAME
    && project.autoRemoveBackground === (manifest.settings.removeBackground === true)
    && hasValidCells
    && JSON.stringify(actualCounts) === JSON.stringify(expectedCounts);
  if (!valid) throw new Error(`已有 JSON 与图纸不一致，请使用 --force 重建：${projectPath}`);
}

function rgbKey(data, index) {
  return [data[index], data[index + 1], data[index + 2]]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function recoverProjectCells(patternPath, width, height) {
  const { cell, labelGutter } = getExportLayout(width, height);
  const { data, info } = await sharp(patternPath, { failOn: "error" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cells = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sampleX = Math.round(labelGutter + x * cell + cell / 2);
      const sampleY = Math.round(labelGutter + y * cell + cell / 2 - cell * .25);
      const key = rgbKey(data, (sampleY * info.width + sampleX) * info.channels);
      const code = RGB_TO_CODE.get(key);
      if (!code && key !== PATTERN_BACKGROUND) {
        throw new Error(`图纸包含无法识别的格子颜色：${patternPath} (${x + 1}, ${y + 1}) #${key}`);
      }
      cells.push(code ?? null);
    }
  }
  return cells;
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function backfillProjectJson(root, { force = false } = {}) {
  const manifestPaths = await collectManifestFiles(path.resolve(root));
  const summary = { manifests: 0, patterns: 0, created: 0, overwritten: 0, skipped: 0 };
  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!manifest.settings?.gridWidth || !manifest.settings?.gridHeight || !Array.isArray(manifest.files)) continue;
    summary.manifests += 1;
    let manifestChanged = manifest.version !== 2 || manifest.projectCount !== manifest.files.length;
    for (const file of manifest.files) {
      summary.patterns += 1;
      const patternPath = path.join(path.dirname(manifestPath), file.output);
      const relativeProject = file.project || file.output.replace(/\.png$/i, ".json");
      const projectPath = path.join(path.dirname(manifestPath), relativeProject);
      const existed = await fileExists(projectPath);
      let projectBuffer;
      if (!existed || force) {
        const cells = await recoverProjectCells(patternPath, manifest.settings.gridWidth, manifest.settings.gridHeight);
        const actualCounts = sortedCounts(countCells(cells));
        const expectedCounts = sortedCounts(file.usedColorCounts ?? {});
        if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
          throw new Error(`恢复的颜色用量与 manifest 不一致：${patternPath}`);
        }
        const colorLimit = Math.max(
          Number(manifest.settings.colorLimit) || 10,
          Array.isArray(file.allowedCodes) ? file.allowedCodes.length : 0,
          Object.keys(actualCounts).length,
        );
        const project = createProjectFile({
          name: path.parse(file.source || file.output).name,
          width: manifest.settings.gridWidth,
          height: manifest.settings.gridHeight,
          colorLimit,
          autoRemoveBackground: manifest.settings.removeBackground === true,
          palette: PALETTE_NAME,
          cells,
          savedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : new Date().toISOString(),
        });
        projectBuffer = Buffer.from(serializeProjectFile(project));
        await mkdir(path.dirname(projectPath), { recursive: true });
        await writeFile(projectPath, projectBuffer);
        if (existed) summary.overwritten += 1;
        else summary.created += 1;
      } else {
        projectBuffer = await readFile(projectPath);
        validateExistingProject(projectBuffer, manifest, file, projectPath);
        summary.skipped += 1;
      }
      const projectSha256 = createHash("sha256").update(projectBuffer).digest("hex");
      if (file.project !== relativeProject || file.projectSha256 !== projectSha256) manifestChanged = true;
      file.project = relativeProject;
      file.projectSha256 = projectSha256;
    }
    manifest.version = 2;
    manifest.projectCount = manifest.files.length;
    if (manifestChanged) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return summary;
}

function parseOptions(args) {
  const options = { root: "", force: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--root") {
      options.root = args[index + 1] ?? "";
      index += 1;
    } else if (args[index] === "--force") {
      options.force = true;
    } else {
      throw new Error(`未知参数：${args[index]}`);
    }
  }
  if (!options.root) throw new Error("缺少 --root 输出目录");
  return options;
}

async function main() {
  try {
    const options = parseOptions(process.argv.slice(2));
    const summary = await backfillProjectJson(options.root, { force: options.force });
    process.stdout.write(`${JSON.stringify({ event: "complete", root: path.resolve(options.root), ...summary })}\n`);
  } catch (error) {
    console.error("[BEAD_PROJECT_BACKFILL]", JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
