import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

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

test("교차로 차량 카운터 페이지를 제공한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
});

test("엑셀 자동 입력 기능과 원본 보존 안내를 포함한다", async () => {
  const [page, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(page, /동연사거리 엑셀 자동 입력/);
  assert.match(page, /원본 서식과 다른 값은 그대로 유지/);
  assert.match(page, /const excelColumns = \["H", "P", "X"\]/);
  assert.match(page, /fullCalcOnLoad/);
  assert.match(packageJson, /"jszip"/);
});
