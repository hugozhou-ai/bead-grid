import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

test("exports a GitHub Pages-ready static site", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>豆格 Bead Grid｜图片转拼豆图纸<\/title>/i);
  assert.match(html, /(?:src|href)="\/bead-grid\/_next\//);
  assert.match(html, /https:\/\/hugozhou-ai\.github\.io\/bead-grid\/og\.png/);
  await access(new URL("og.png", outputRoot));
  await access(new URL(".nojekyll", outputRoot));
});
