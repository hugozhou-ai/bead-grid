import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { batchExport, parseBatchOptions, renderPatternSvg } from "../scripts/batch-export-patterns.mjs";

test("uses the requested batch export defaults", () => {
  const options = parseBatchOptions(["--input", "source", "--output", "patterns"], "/tmp/bead-grid-test");
  assert.equal(options.gridWidth, 64);
  assert.equal(options.gridHeight, 64);
  assert.equal(options.colorLimit, 10);
  assert.equal(options.removeBackground, false);
  assert.equal(options.pegboardSize, 52);
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
  assert.equal(manifest.settings.removeBackground, false);
  assert.equal(manifest.settings.pegboardSize, 52);
  assert.deepEqual(manifest.files[0].usedColorCounts, { F9: 64 });
  const metadata = await sharp(path.join(output, "sample-8x8.png")).metadata();
  assert.equal(metadata.width, 932);
  assert.equal(metadata.height, 1166);
  const savedManifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
  assert.equal(savedManifest.files[0].output, "sample-8x8.png");
  const readme = await readFile(path.join(output, "README.txt"), "utf8");
  assert.match(readme, /^拼豆图纸批量导出/);
  assert.match(readme, /自动移除背景：关闭/);
  assert.match(readme, /拼豆板尺寸：52 × 52/);
});

test("renders the color codes and quantities into the exported pattern", () => {
  const svg = renderPatternSvg(Array.from({ length: 64 }, () => "F9"), 8, 8, 52);
  assert.match(svg, /材料清单/);
  assert.match(svg, /F9 · 红色系/);
  assert.match(svg, /64 颗/);
});
