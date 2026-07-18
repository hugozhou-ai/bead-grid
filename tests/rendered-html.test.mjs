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
  assert.match(html, /比例已锁定 32:32/);
  assert.match(html, /5 mm 拼豆/);
  assert.match(html, /打开项目/);
  assert.match(html, /导出材料 CSV/);
  assert.match(html, /class="canvas-scroll-content fit"/);
  assert.match(html, /class="bead-canvas tool-paint" style="width:720px;height:720px"/);
  assert.match(html, />适应<\/button>/);
  assert.doesNotMatch(html, /transform:\s*scale/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/);
});

test("provides project persistence and non-destructive resizing", async () => {
  const source = await readFile(new URL("../app/bead-studio.tsx", import.meta.url), "utf8");

  assert.match(source, /bead-grid\.project\.v2/);
  assert.match(source, /window\.localStorage\.setItem/);
  assert.match(source, /function importProject/);
  assert.match(source, /function resizeGrid/);
  assert.doesNotMatch(source, /else commitGrid\(createDemo/);
});

test("uses the hand-inked visual system across the page and canvas", async () => {
  const source = await readFile(new URL("../app/bead-studio.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /--pen-font:/);
  assert.match(styles, /repeating-linear-gradient/);
  assert.match(styles, /border-radius: 46% 54% 49% 51%/);
  assert.match(source, /context\.ellipse\(centerX, centerY/);
  assert.match(source, /const wobble =/);
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
