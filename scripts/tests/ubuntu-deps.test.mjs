/** Validate the pinned Ubuntu package source and retry settings without installing packages. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('uses official Jammy sources and bounded network retries for update and install', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-apt-test-'));
  try {
    const log = join(dir, 'apt.log');
    writeFileSync(join(dir, 'apt-get'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$TEST_APT_LOG"\nfor arg in "$@"; do case "$arg" in Dir::Etc::sourcelist=*) cat "${arg#*=}" >> "$TEST_APT_LOG" ;; esac; done\n', { mode: 0o755 });
    execFileSync('bash', ['scripts/ci/install-ubuntu-deps.sh'], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_APT_LOG: log } });
    const output = readFileSync(log, 'utf8');
    assert.match(output, /archive\.ubuntu\.com\/ubuntu jammy main universe/);
    assert.match(output, /security\.ubuntu\.com\/ubuntu jammy-security main universe/);
    assert.equal((output.match(/Acquire::Retries=3/g) || []).length, 2);
    assert.equal((output.match(/Acquire::http::Timeout=15/g) || []).length, 2);
    assert.equal((output.match(/APT::Update::Error-Mode=any/g) || []).length, 2);
    assert.match(output, / update\n/);
    assert.match(output, / install -y .*libwebkit2gtk-4\.1-dev/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
