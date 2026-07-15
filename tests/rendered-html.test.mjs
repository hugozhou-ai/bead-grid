import assert from "node:assert/strict";
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
  assert.match(html, /class="canvas-scroll-content fit"/);
  assert.match(html, /class="bead-canvas tool-paint" style="width:720px;height:720px"/);
  assert.match(html, />适应<\/button>/);
  assert.doesNotMatch(html, /transform:\s*scale/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/);
});
