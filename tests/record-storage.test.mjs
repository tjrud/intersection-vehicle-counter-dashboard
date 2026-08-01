import assert from "node:assert/strict";
import test from "node:test";
import { migrateDrafts, migrateRecords } from "../app/record-storage.mjs";

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
