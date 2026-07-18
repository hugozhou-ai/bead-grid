import assert from "node:assert/strict";
import test from "node:test";
import { getDominantColorCode, getExportCellSize, quantizeGridByMode } from "../app/image-processing.ts";

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

test("detects the most frequent non-transparent color as the background", () => {
  assert.equal(getDominantColorCode([null, "A02", "A01", "A02", null, "A02", "A01"]), "A02");
  assert.equal(getDominantColorCode([null, null]), null);
});
