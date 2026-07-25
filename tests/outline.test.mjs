import assert from "node:assert/strict";
import test from "node:test";
import { PALETTE, PURE_WHITE_BEAD_CODE } from "../app/bead-palette.ts";
import { createOuterOutline } from "../app/outline.ts";

test("uses the closest MARD color to pure white", () => {
  assert.equal(PURE_WHITE_BEAD_CODE, "H2");
  assert.equal(PALETTE.find(({ code }) => code === PURE_WHITE_BEAD_CODE)?.hex, "#FEFFFF");
});

test("adds one white layer around a subject in all eight directions", () => {
  const cells = [
    null, null, null,
    null, "F5", null,
    null, null, null,
  ];
  const outlined = createOuterOutline(cells, 3, 3, PURE_WHITE_BEAD_CODE, 160);

  assert.equal(outlined.addedCount, 8);
  assert.deepEqual(outlined.cells, [
    "H2", "H2", "H2",
    "H2", "F5", "H2",
    "H2", "H2", "H2",
  ]);
});

test("keeps enclosed holes empty while outlining the exterior", () => {
  const cells = [
    null, null, null, null, null,
    null, "F5", "F5", "F5", null,
    null, "F5", null, "F5", null,
    null, "F5", "F5", "F5", null,
    null, null, null, null, null,
  ];
  const outlined = createOuterOutline(cells, 5, 5, PURE_WHITE_BEAD_CODE, 160);

  assert.equal(outlined.cells[2 * 5 + 2], null);
  assert.equal(outlined.addedCount, 16);
});

test("repositions an edge-touching subject without resizing when space is available", () => {
  const cells = [
    "F5", null, null,
    null, null, null,
    null, null, null,
  ];
  const outlined = createOuterOutline(cells, 3, 3, PURE_WHITE_BEAD_CODE, 160);

  assert.equal(outlined.width, 3);
  assert.equal(outlined.height, 3);
  assert.equal(outlined.offsetX, 1);
  assert.equal(outlined.offsetY, 1);
  assert.equal(outlined.cells[4], "F5");
  assert.equal(outlined.addedCount, 8);
});

test("expands the grid when a full-width subject needs exterior space", () => {
  const outlined = createOuterOutline(["F5", "F5"], 2, 1, PURE_WHITE_BEAD_CODE, 160);

  assert.equal(outlined.width, 4);
  assert.equal(outlined.height, 3);
  assert.deepEqual(outlined.cells.slice(5, 7), ["F5", "F5"]);
  assert.equal(outlined.addedCount, 10);
});

test("rejects a subject that cannot fit inside the maximum grid with its outline", () => {
  assert.throws(
    () => createOuterOutline(Array.from({ length: 4 }, () => "F5"), 4, 1, PURE_WHITE_BEAD_CODE, 4),
    /主体尺寸过大/,
  );
});
