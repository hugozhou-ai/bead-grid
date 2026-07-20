import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_CODE_MAP, PALETTE, PALETTE_NAME } from "../app/bead-palette.ts";

test("uses the complete MARD 221 palette with its standard series prefixes", () => {
  assert.equal(PALETTE_NAME, "MARD 标准 221 色");
  assert.equal(PALETTE.length, 221);
  assert.equal(new Set(PALETTE.map((color) => color.code)).size, 221);
  assert.deepEqual([...new Set(PALETTE.map((color) => color.code.match(/^[A-Z]+/)?.[0]))], ["A", "B", "C", "D", "E", "F", "G", "H", "M"]);
});

test("maps every legacy A01-A32 code to the closest valid MARD color", () => {
  assert.equal(Object.keys(LEGACY_CODE_MAP).length, 32);
  const validCodes = new Set(PALETTE.map((color) => color.code));
  for (const code of Object.values(LEGACY_CODE_MAP)) assert.equal(validCodes.has(code), true);
  assert.equal(LEGACY_CODE_MAP.A04, "F9");
  assert.equal(LEGACY_CODE_MAP.A11, "B25");
  assert.equal(LEGACY_CODE_MAP.A28, "C29");
});
