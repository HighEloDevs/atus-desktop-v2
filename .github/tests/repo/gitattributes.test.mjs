/** Verify frontend files retain the same line endings on Windows checkouts. */
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

test('frontend text files are checked out with LF line endings', () => {
  for (const file of ['src/frontend/src/App.tsx', 'src/frontend/package.json']) {
    const output = execFileSync('git', ['check-attr', 'eol', '--', file], { encoding: 'utf8' });
    assert.equal(output.trim(), `${file}: eol: lf`);
  }
});
