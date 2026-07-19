import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Bead Grid application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>豆格 Bead Grid｜图片转拼豆图纸<\/title>/i);
  assert.match(html, /把喜欢的图片/);
  assert.match(html, /生成设置/);
  assert.match(html, /材料清单/);
  assert.match(html, /图片仅在本机处理/);
  assert.match(html, /aria-label="关闭比例锁定"/);
  assert.doesNotMatch(html, /比例已锁定 32:32/);
  assert.match(html, /5 mm 拼豆/);
  assert.match(html, /打开项目/);
  assert.match(html, /导出材料 CSV/);
  assert.match(html, /class="canvas-scroll-content fit"/);
  assert.match(html, /class="bead-canvas tool-paint" style="width:720px;height:720px"/);
  assert.match(html, /href="\/fonts\/lxgw-wenkai\/regular\.css"/);
  assert.match(html, /href="\/fonts\/lxgw-wenkai\/bold\.css"/);
  assert.match(html, />适应<\/button>/);
  assert.doesNotMatch(html, /transform:\s*scale/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/);
  assert.doesNotMatch(html, /id="project-name"/);
});

test("provides project persistence and non-destructive resizing", async () => {
  const source = await readFile(new URL("../app/bead-studio.tsx", import.meta.url), "utf8");
  const processing = await readFile(new URL("../app/image-processing.ts", import.meta.url), "utf8");

  assert.match(source, /bead-grid\.project\.v2/);
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /function importProject/);
  assert.match(source, /function resizeGrid/);
  assert.match(source, /MAX_GRID_SIZE = 160/);
  assert.match(source, /max=\{MAX_GRID_SIZE\}/);
  assert.match(source, /max=\{PALETTE\.length\}/);
  assert.match(source, /function openSaveProjectDialog/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /useState\(false\).*autoRemoveBackground|autoRemoveBackground.*useState\(false\)/s);
  assert.match(source, /candidate\.autoRemoveBackground === true/);
  assert.match(source, /id="auto-remove-background"/);
  assert.match(source, /createPatternFromPixels\(/);
  assert.match(processing, /removeBackground \? getDominantColorCode\(firstPass\) : null/);
  assert.doesNotMatch(source, /else commitGrid\(createDemo/);
  assert.doesNotMatch(source, /project-name-field/);
});

test("uses the hand-inked visual system across the page and canvas", async () => {
  const source = await readFile(new URL("../app/bead-studio.tsx", import.meta.url), "utf8");
  const processing = await readFile(new URL("../app/image-processing.ts", import.meta.url), "utf8");
  const palette = await readFile(new URL("../app/bead-palette.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /--pen-font:/);
  assert.match(styles, /"LXGW WenKai"/);
  assert.match(styles, /repeating-linear-gradient/);
  assert.match(styles, /border-radius: 46% 54% 49% 51%/);
  assert.match(styles, /scrollbar-width: none/);
  assert.match(styles, /\.canvas-scroll::\-webkit-scrollbar/);
  assert.doesNotMatch(styles, /\*::\-webkit-scrollbar|display: none;[^}]*scrollbar/);
  assert.match(styles, /\.swatches \{[^}]*overflow-x: auto;[^}]*touch-action: pan-x;[^}]*overscroll-behavior-inline: contain/);
  assert.match(styles, /\.canvas-panel \{ width: 100%; max-width: 100%; min-height: 580px; \}/);
  assert.match(styles, /\.palette-strip \{ width: 100%; max-width: 100%; min-width: 0;[^}]*overflow: hidden; \}/);
  assert.match(styles, /\.swatches \{ width: 100%; max-width: 100%; min-width: 0;[^}]*overflow-x: auto/);
  assert.match(source, /context\.ellipse\(centerX, centerY/);
  assert.match(source, /const wobble =/);
  assert.match(source, /document\.fonts\.load\('700 16px "LXGW WenKai"'/);
  assert.match(source, /\[BEAD_FONT\]/);
  assert.match(source, /context\.font = `700 .*"LXGW WenKai"/);
  assert.match(source, /getExportLayout\(width, height\)/);
  assert.match(source, /createPatternFromPixels\(/);
  assert.match(processing, /quantizeGridByMode\(pixels, targetWidth, targetHeight/);
  assert.match(processing, /getDominantColorCode\(firstPass\)/);
  assert.match(processing, /firstPass\[index\] === backgroundCode \? null : code/);
  assert.match(source, /PEGBOARD_SIZE_OPTIONS = \[52, 78, 104, 120\]/);
  assert.match(source, /useState<number>\(PEGBOARD_SIZE_OPTIONS\[0\]\)/);
  assert.match(source, /<h2 id="export-dialog-title">拼豆板尺寸<\/h2>/);
  assert.match(source, /x \+= pegboardSize/);
  assert.match(source, /y \+= pegboardSize/);
  assert.match(source, /context\.translate\(labelGutter, labelGutter\)/);
  assert.match(source, /context\.fillText\(String\(x \+ 1\), centerX, labelGutter \/ 2\)/);
  assert.match(source, /context\.fillText\(String\(y \+ 1\), labelGutter \/ 2, centerY\)/);
  assert.doesNotMatch(source, /PEGBOARD_GRID_SIZE|save-dialog-heading|save-dialog-actions/);
  assert.match(source, /beadLabelColor/);
  assert.match(palette, /function beadLabelColor/);
});

test("keeps browser zoom interception scoped to the canvas workspace", async () => {
  const source = await readFile(new URL("../app/bead-studio.tsx", import.meta.url), "utf8");

  assert.match(source, /scrollArea\.addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(source, /scrollArea\.addEventListener\("gesturechange", handleGestureChange, \{ passive: false \}\)/);
  assert.doesNotMatch(source, /onWheel=/);
});

test("uses one icon library and exposes batch selection controls", async () => {
  const source = await readFile(new URL("../app/bead-studio.tsx", import.meta.url), "utf8");

  assert.match(source, /from "lucide-react"/);
  assert.match(source, /"rectangle" \| "trace"/);
  assert.match(source, /长按选择：沿着豆子移动即可连续选中/);
  assert.match(source, /aria-label="所选豆子操作"/);
  assert.doesNotMatch(source, /✎|◇|◉|↶|↷|⌄/);
});
