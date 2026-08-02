import assert from "node:assert/strict";
import test from "node:test";
import { migrateDrafts, migrateRecords, migrateToLibrary } from "../app/record-storage.mjs";

const counts = (value) => Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, value]));

test("19시부터 자정까지의 전날 기록과 00시 이후 기록을 합친다", () => {
  const previous = {};
  for (let slot = 76; slot < 96; slot += 1) previous[String(slot).padStart(2, "0")] = counts(slot);
  const current = {};
  for (let slot = 0; slot <= 28; slot += 1) current[String(slot).padStart(2, "0")] = counts(slot);

  const migrated = migrateRecords({ "2026-08-01": previous, "2026-08-02": current });
  assert.equal(Object.keys(migrated).length, 49);
  assert.equal(migrated["76"][1], 76);
  assert.equal(migrated["95"][12], 95);
  assert.equal(migrated["00"][1], 0);
  assert.equal(migrated["28"][12], 28);
});

test("날짜가 포함된 작성 중 키도 시간 키로 복구한다", () => {
  const migrated = migrateDrafts({ "2026-08-01|95": counts(95), "2026-08-02|00": counts(0) });
  assert.deepEqual(Object.keys(migrated), ["95", "00"]);
});

test("기존 하루 기록을 사용 중이던 모드의 기록 1로 이전한다", () => {
  const migrated = migrateToLibrary({ mode: "photo", records: { "12": counts(12) }, drafts: {}, slot: "13" });
  assert.equal(migrated.library.photo[0].records["12"][1], 12);
  assert.equal(migrated.library.photo[0].slot, "13");
  assert.deepEqual(migrated.library.full[0].records, {});
});

test("12개 모드와 6개 모드의 여러 기록 슬롯을 분리해서 유지한다", () => {
  const migrated = migrateToLibrary({
    library: {
      full: [
        { id: "full-a", name: "기록 1", records: { "00": counts(1) }, drafts: {}, slot: "01" },
        { id: "full-b", name: "기록 2", records: { "00": counts(2) }, drafts: {}, slot: "02" },
      ],
      photo: [{ id: "photo-a", name: "기록 1", records: { "00": counts(3) }, drafts: {}, slot: "03" }],
    },
    activeRecordIds: { full: "full-b", photo: "photo-a" },
  });
  assert.equal(migrated.library.full[1].records["00"][1], 2);
  assert.equal(migrated.library.photo[0].records["00"][1], 3);
  assert.equal(migrated.activeRecordIds.full, "full-b");
  assert.equal(migrated.library.box[0].id, "box-1");
});

test("모드 3 기록도 다른 모드와 별도 저장한다", () => {
  const migrated = migrateToLibrary({
    mode: "box",
    records: { "00": counts(30) },
    drafts: {},
    slot: "01",
  });
  assert.equal(migrated.library.box[0].records["00"][3], 30);
  assert.deepEqual(migrated.library.full[0].records, {});
  assert.deepEqual(migrated.library.photo[0].records, {});
});
