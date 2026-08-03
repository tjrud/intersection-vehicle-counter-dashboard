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
  assert.match(page, /엑셀 자동 입력/);
  assert.doesNotMatch(page, /동연사거리 엑셀 자동 입력/);
  assert.match(page, /원본 서식과 다른 값은 그대로 유지/);
  assert.match(page, /const excelColumns = \["H", "P", "X"\]/);
  assert.match(page, /const savedSlots = Object\.entries\(records\)/);
  assert.match(page, /savedSlots\.forEach/);
  assert.match(page, /fullCalcOnLoad/);
  assert.match(page, /zip\.remove\("xl\/calcChain\.xml"\)/);
  assert.match(page, /endsWith\("\/calcChain"\)/);
  assert.match(page, /calcCompleted/);
  assert.match(packageJson, /"jszip"/);
});

test("자정 전후의 기존 날짜별 기록을 한 기록표로 복구한다", async () => {
  const [page, storage] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/record-storage.mjs", root), "utf8"),
  ]);
  assert.match(page, /intersection-timed-records-v2/);
  assert.match(page, /intersection-timed-records-v3/);
  assert.match(page, /localStorage\.getItem\("intersection-timed-records-v1"\)/);
  assert.match(storage, /isCounts\(latestDay\["00"\]\)/);
  assert.match(page, /slot:\s*pad\(\(Number\(slot\) \+ 1\) % 96\)/);
  assert.doesNotMatch(page, /setDate|records\[date\]/);
});

test("모드별 다중 기록 슬롯 선택과 생성 기능을 제공한다", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /기록 슬롯/);
  assert.match(page, /\+ 새 기록/);
  assert.match(page, /이름 변경/);
  assert.match(page, /saveRecordName/);
  assert.match(page, /기록 삭제/);
  assert.match(page, /deleteRecordSet/);
  assert.match(page, /복구할 수 없습니다/);
  assert.match(page, /library\[mode\]/);
  assert.match(page, /activeRecordIds\[mode\]/);
  assert.match(page, /safeRecordName/);
  assert.match(page, /모드 3 · 12개/);
  assert.match(page, /boxMode/);
  assert.match(page, /onContextMenu/);
  assert.match(page, /movement-\$\{movement\}/);
});

test("모드 3 색상과 모드 2의 큰 조작 버튼 스타일을 제공한다", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /--left-turn:#1f6b45/);
  assert.match(css, /--straight:#69ace0/);
  assert.match(css, /--right-turn:#1f6b45/);
  assert.match(css, /\.photo-layout \.controls button \{ width:72px; height:72px;/);
});

test("모드별 번호마다 버튼 소리를 설정하고 저장한다", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /type CounterSounds = Record<Mode/);
  assert.match(page, /counterSounds\[mode\]\[id\]/);
  assert.match(page, /번호별 소리/);
  assert.match(page, /counterSounds, volume/);
  assert.match(css, /\.counter-sound-grid/);
});

test("모드 1과 2의 카드 클릭 및 버튼 조작 방식을 선택한다", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /type InputStyle = "card" \| "buttons"/);
  assert.match(page, /const usesCardControls = isBoxMode \|\| isGyuhoMode \|\| inputStyle === "card"/);
  assert.match(page, /모드 1·2 조작 방식/);
  assert.match(page, /모드 3과 규호 모드는 항상 카드 클릭 방식/);
  assert.match(page, /inputStyle, selectedVehicle, soundOn/);
  assert.match(css, /\.click-counter/);
  assert.match(css, /\.input-style-options/);
});

test("규호 모드에서 12방향과 6개 차량 분류를 집계한다", async () => {
  const [page, storage, css] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/record-storage.mjs", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(page, /const gyuhoMode/);
  assert.match(page, /\{ id: 6, area: "n1" \}.*\{ id: 4, area: "n3" \}/s);
  assert.match(page, /\{ id: 10, area: "s1" \}.*\{ id: 12, area: "s3" \}/s);
  assert.match(page, /승용/);
  assert.match(page, /버스/);
  assert.match(page, /트레일러/);
  assert.match(page, /vehicleCountKey\(id, selectedVehicle\)/);
  assert.match(page, /표 복사 또는 CSV 다운로드/);
  assert.match(storage, /"gyuho"/);
  assert.match(css, /\.vehicle-selector/);
});
