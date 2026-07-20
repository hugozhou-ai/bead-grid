import assert from "node:assert/strict";
import test from "node:test";
import { createPatternFromPixels, getDominantColorCode, getExportCellSize, getExportLayout, quantizeGridByMode } from "../app/image-processing.ts";

const palette = [
  { code: "RED", rgb: [240, 40, 40] },
  { code: "BLUE", rgb: [40, 40, 240] },
];

function pixels(colors) {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));
}

test("quantizes each bead from the modal sampled palette color", () => {
  const samples = [
    ...Array.from({ length: 10 }, () => [240, 40, 40]),
    ...Array.from({ length: 6 }, () => [40, 40, 240]),
  ];
  assert.deepEqual(quantizeGridByMode(pixels(samples), 1, 1, 4, palette), ["RED"]);
});

test("keeps a cell transparent when transparency is the sampled mode", () => {
  const samples = [
    ...Array.from({ length: 9 }, () => [0, 0, 0, 0]),
    ...Array.from({ length: 7 }, () => [240, 40, 40, 255]),
  ];
  assert.deepEqual(quantizeGridByMode(pixels(samples), 1, 1, 4, palette), [null]);
});

test("scales PNG cell resolution with the grid while keeping large exports bounded", () => {
  assert.equal(getExportCellSize(16, 16), 96);
  assert.equal(getExportCellSize(80, 80), 52);
  assert.equal(getExportCellSize(200, 160), 32);
});

test("calculates the complete export canvas layout", () => {
  assert.deepEqual(getExportLayout(64, 64), {
    cell: 64,
    labelGutter: 55,
    gridPixelWidth: 4096,
    gridPixelHeight: 4096,
    legendTop: 4206,
    legendPadding: 32,
    legendHeaderHeight: 45,
    legendItemHeight: 47,
    legendColumns: 0,
    legendRows: 0,
    legendHeight: 0,
    outputWidth: 4206,
    outputHeight: 4206,
  });
});

test("reserves rows below the pattern for every material legend item", () => {
  const layout = getExportLayout(8, 8, 5);
  assert.equal(layout.legendColumns, 2);
  assert.equal(layout.legendRows, 3);
  assert.equal(layout.legendTop, 932);
  assert.equal(layout.outputHeight, 1306);
});

test("detects the most frequent non-transparent color as the background", () => {
  assert.equal(getDominantColorCode([null, "A02", "A01", "A02", null, "A02", "A01"]), "A02");
  assert.equal(getDominantColorCode([null, null]), null);
});

test("limits colors without removing the background when the switch is off", () => {
  const samples = [
    ...Array.from({ length: 8 }, () => [240, 40, 40]),
    ...Array.from({ length: 8 }, () => [40, 40, 240]),
  ];
  const result = createPatternFromPixels(pixels(samples), 1, 1, 4, palette, 1, false);
  assert.equal(result.backgroundCode, null);
  assert.deepEqual(result.allowedCodes, ["RED"]);
  assert.deepEqual(result.cells, ["RED"]);
});
