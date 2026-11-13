import assert from "node:assert/strict";
import { test } from "node:test";
import { lineCoveragePasses } from "../../../../scripts/shared/coverage/check-coverage.mjs";

test("requires strictly more than 90 percent of executable lines", () => {
  assert.equal(lineCoveragePasses(90, 100), false);
  assert.equal(lineCoveragePasses(91, 100), true);
  assert.equal(lineCoveragePasses(9, 10), false);
});

test("rejects missing, malformed, and impossible counters", () => {
  for (const [hit, total] of [[0, 0], [-1, 10], [11, 10], [1.5, 2], [NaN, 10], [1, Infinity], [undefined, 1]]) {
    assert.equal(lineCoveragePasses(hit, total), false);
  }
});

test("LCOV reports include every record and reject empty or inconsistent reports", async () => {
  const { parseLcov } = await import("../../../../scripts/shared/coverage/check-coverage.mjs");
  assert.deepEqual(parseLcov("SF:a.ts\nLF:10\nLH:9\nend_of_record\nSF:b.ts\nLF:1\nLH:1\nend_of_record\n"), { hit: 10, total: 11 });
  for (const bad of ["", "SF:a\nLF:10\nend_of_record\n", "SF:a\nLF:1\nLH:2\nend_of_record\n", "SF:a\nLF:1\nLH:1\n", "SF:a\nLF:1\nLF:1\nLH:1\nend_of_record\n"]) {
    assert.throws(() => parseLcov(bad));
  }
});
