import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uncoveredLines } from '../../../../scripts/shared/coverage/report-uncovered-lines.mjs';

test('lists only lines with zero hits, per file', () => {
  const report = ['SF:/a/src/desktop/src/a.rs', 'DA:1,3', 'DA:2,0', 'DA:5,0', 'end_of_record', 'SF:/a/src/desktop/src/b.rs', 'DA:1,1', 'end_of_record'].join('\n');
  assert.deepEqual([...uncoveredLines(report)], [['/a/src/desktop/src/a.rs', [2, 5]], ['/a/src/desktop/src/b.rs', []]]);
});
