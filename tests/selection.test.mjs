import assert from "node:assert/strict";
import test from "node:test";
import { addSelectionLine, getRectangleSelection, toggleSelectionCell } from "../app/selection.ts";

test("rectangle selection includes empty cells", () => {
  assert.deepEqual(
    [...getRectangleSelection(0, 10, 4, new Set(), false)].sort((a, b) => a - b),
    [0, 1, 2, 4, 5, 6, 8, 9, 10],
  );
});

test("rectangle selection can add to an existing selection", () => {
  assert.deepEqual(
    [...getRectangleSelection(5, 10, 4, new Set([3]), true)].sort((a, b) => a - b),
    [3, 5, 6, 9, 10],
  );
});

test("trajectory selection fills empty gaps between pointer samples", () => {
  assert.deepEqual(
    [...addSelectionLine(0, 15, 4, new Set([3]))].sort((a, b) => a - b),
    [0, 3, 5, 10, 15],
  );
});

test("single-cell selection toggles empty cells", () => {
  assert.deepEqual([...toggleSelectionCell(6, new Set([3]))].sort((a, b) => a - b), [3, 6]);
  assert.deepEqual([...toggleSelectionCell(6, new Set([3, 6]))].sort((a, b) => a - b), [3]);
});
