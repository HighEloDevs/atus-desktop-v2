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
    const hosts = join(dir, 'hosts');
    writeFileSync(hosts, '127.0.0.1 localhost\n');
    writeFileSync(join(dir, 'getent'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
    writeFileSync(join(dir, 'apt-get'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$TEST_APT_LOG"\nfor arg in "$@"; do case "$arg" in Dir::Etc::sourcelist=*) cat "${arg#*=}" >> "$TEST_APT_LOG" ;; esac; done\n', { mode: 0o755 });
    execFileSync('bash', ['scripts/ci/install-ubuntu-deps.sh'], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_APT_LOG: log, ATUS_HOSTS_FILE: hosts } });
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

test('resolves missing mirrors over HTTPS and removes temporary host entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atus-dns-test-'));
  try {
    const hosts = join(dir, 'hosts');
    writeFileSync(hosts, '127.0.0.1 localhost\n');
    writeFileSync(join(dir, 'getent'), '#!/usr/bin/env bash\nexit 2\n', { mode: 0o755 });
    writeFileSync(join(dir, 'curl'), '#!/usr/bin/env bash\nprintf \'%s\' \'{"Status":0,"Answer":[{"type":1,"data":"192.0.2.1"}]}\'\n', { mode: 0o755 });
    writeFileSync(join(dir, 'apt-get'), '#!/usr/bin/env bash\ncat "$ATUS_HOSTS_FILE" >> "$TEST_APT_LOG"\n', { mode: 0o755 });
    const log = join(dir, 'apt.log');
    execFileSync('bash', ['scripts/ci/install-ubuntu-deps.sh'], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_APT_LOG: log, ATUS_HOSTS_FILE: hosts } });
    assert.match(readFileSync(log, 'utf8'), /192\.0\.2\.1 archive\.ubuntu\.com/);
    assert.match(readFileSync(log, 'utf8'), /192\.0\.2\.1 security\.ubuntu\.com/);
    assert.equal(readFileSync(hosts, 'utf8'), '127.0.0.1 localhost\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
