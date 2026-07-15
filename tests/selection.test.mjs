import assert from "node:assert/strict";
import test from "node:test";
import { addSelectionLine, getRectangleSelection } from "../app/selection.ts";

const grid = [
  "A01", null, "A02", "A03",
  "A01", "A02", null, "A03",
  null, "A02", "A02", "A03",
  "A01", null, "A02", null,
];

test("rectangle selection includes only existing beads", () => {
  assert.deepEqual(
    [...getRectangleSelection(0, 10, 4, grid, new Set(), false)].sort((a, b) => a - b),
    [0, 2, 4, 5, 9, 10],
  );
});

test("rectangle selection can add to an existing selection", () => {
  assert.deepEqual(
    [...getRectangleSelection(5, 10, 4, grid, new Set([3]), true)].sort((a, b) => a - b),
    [3, 5, 9, 10],
  );
});

test("trajectory selection fills gaps between pointer samples", () => {
  assert.deepEqual(
    [...addSelectionLine(0, 15, 4, grid, new Set([3]))].sort((a, b) => a - b),
    [0, 3, 5, 10],
  );
});
