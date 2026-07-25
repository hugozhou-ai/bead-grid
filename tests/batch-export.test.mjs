import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { createProjectFile, parseProjectFile } from "../app/project-format.ts";
import { batchExport, parseBatchOptions, renderPatternSvg } from "../scripts/batch-export-patterns.mjs";
import { backfillProjectJson, recoverProjectCells } from "../scripts/backfill-project-json.mjs";

test("uses the requested batch export defaults", () => {
  const options = parseBatchOptions(["--input", "source", "--output", "patterns"], "/tmp/bead-grid-test");
  assert.equal(options.gridWidth, 64);
  assert.equal(options.gridHeight, 64);
  assert.equal(options.colorLimit, 10);
  assert.equal(options.removeBackground, false);
  assert.equal(options.pegboardSize, 52);
});

test("imports transparent project cells and rejects unknown non-empty color codes", () => {
  const parseOptions = {
    paletteName: "MARD 标准 221 色",
    validCodes: ["F5"],
    legacyPaletteName: "旧版色板",
    legacyCodeMap: {},
  };
  const project = createProjectFile({
    name: "transparent-project",
    width: 8,
    height: 8,
    colorLimit: 3,
    autoRemoveBackground: true,
    palette: "MARD 标准 221 色",
    cells: Array.from({ length: 64 }, (_, index) => index === 0 ? "F5" : null),
    savedAt: "2026-07-26T00:00:00.000Z",
  });

  assert.deepEqual(parseProjectFile(project, parseOptions), project);
  assert.throws(
    () => parseProjectFile({ ...project, cells: ["UNKNOWN", ...project.cells.slice(1)] }, parseOptions),
    /图纸包含未知色号/,
  );
});

test("exports a source image and records the effective settings", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bead-grid-batch-"));
  const input = path.join(root, "input");
  const output = path.join(root, "output");
  await mkdir(input);
  await sharp({
    create: { width: 16, height: 16, channels: 4, background: { r: 238, g: 106, b: 91, alpha: 1 } },
  }).png().toFile(path.join(input, "sample.png"));
  const options = parseBatchOptions([
    "--input", input,
    "--output", output,
    "--grid", "8x8",
    "--colors", "3",
    "--pegboard", "52",
    "--remove-background", "false",
    "--concurrency", "1",
  ]);
  const manifest = await batchExport(options);
  assert.equal(manifest.inputCount, 1);
  assert.equal(manifest.outputCount, 1);
  assert.equal(manifest.projectCount, 1);
  assert.equal(manifest.version, 2);
  assert.equal(manifest.settings.removeBackground, false);
  assert.equal(manifest.settings.pegboardSize, 52);
  assert.deepEqual(manifest.files[0].usedColorCounts, { F9: 64 });
  const metadata = await sharp(path.join(output, "sample-8x8.png")).metadata();
  assert.equal(metadata.width, 932);
  assert.equal(metadata.height, 1088);
  const savedManifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
  assert.equal(savedManifest.files[0].output, "sample-8x8.png");
  assert.equal(savedManifest.files[0].project, "sample-8x8.json");
  const project = JSON.parse(await readFile(path.join(output, "sample-8x8.json"), "utf8"));
  assert.equal(project.version, 3);
  assert.equal(project.name, "sample");
  assert.equal(project.width, 8);
  assert.equal(project.height, 8);
  assert.equal(project.colorLimit, 3);
  assert.equal(project.autoRemoveBackground, false);
  assert.equal(project.cells.length, 64);
  assert.deepEqual(project.cells, Array.from({ length: 64 }, () => "F9"));
  assert.deepEqual(await recoverProjectCells(path.join(output, "sample-8x8.png"), 8, 8), project.cells);
  const readme = await readFile(path.join(output, "README.txt"), "utf8");
  assert.match(readme, /^拼豆图纸批量导出/);
  assert.match(readme, /自动移除背景：关闭/);
  assert.match(readme, /拼豆板尺寸：52 × 52/);
  assert.match(readme, /同名 JSON 源文件/);

  await unlink(path.join(output, "sample-8x8.json"));
  const backfilled = await backfillProjectJson(root);
  assert.equal(backfilled.patterns, 1);
  assert.equal(backfilled.created, 1);
  const restoredProject = JSON.parse(await readFile(path.join(output, "sample-8x8.json"), "utf8"));
  assert.deepEqual(restoredProject.cells, project.cells);

  restoredProject.cells[0] = null;
  await writeFile(path.join(output, "sample-8x8.json"), JSON.stringify(restoredProject), "utf8");
  await assert.rejects(backfillProjectJson(root), /已有 JSON 与图纸不一致/);
  const forced = await backfillProjectJson(root, { force: true });
  assert.equal(forced.overwritten, 1);
  const forcedProject = JSON.parse(await readFile(path.join(output, "sample-8x8.json"), "utf8"));
  assert.deepEqual(forcedProject.cells, project.cells);
});

test("renders the color codes and quantities into the exported pattern", () => {
  const svg = renderPatternSvg(Array.from({ length: 64 }, () => "F9"), 8, 8, 52);
  assert.match(svg, /材料清单/);
  assert.match(svg, /F9 · 红色系/);
  assert.match(svg, /64 颗/);
});
