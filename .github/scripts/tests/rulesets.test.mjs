/** Verify the tracked main and staging ruleset definitions retain their separation. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

test('CI checks have no bypass and the review ruleset keeps a separate PR-only bypass without required approvals', () => {
  const ci = JSON.parse(readFileSync('.github/rulesets/main-ci.json', 'utf8'));
  const review = JSON.parse(readFileSync('.github/rulesets/main-review.json', 'utf8'));
  assert.deepEqual(ci.bypass_actors, []);
  assert.ok(ci.rules.some((rule) => rule.type === 'required_status_checks'));
  assert.equal(review.rules.find((rule) => rule.type === 'pull_request').parameters.required_approving_review_count, 0);
  assert.deepEqual(review.bypass_actors.map((actor) => actor.bypass_mode), ['pull_request', 'pull_request']);
});

test('staging has the same protection shape as main with the checks that run for pull requests into staging', () => {
  const ci = JSON.parse(readFileSync('.github/rulesets/staging-ci.json', 'utf8'));
  const review = JSON.parse(readFileSync('.github/rulesets/staging-review.json', 'utf8'));
  for (const ruleset of [ci, review]) {
    assert.deepEqual(ruleset.conditions.ref_name.include, ['refs/heads/staging']);
    assert.equal(ruleset.enforcement, 'active');
    assert.ok(ruleset.rules.some((rule) => rule.type === 'pull_request'));
  }
  assert.deepEqual(ci.bypass_actors, []);
  for (const type of ['deletion', 'non_fast_forward']) assert.ok(ci.rules.some((rule) => rule.type === type), type);
  const checks = ci.rules.find((rule) => rule.type === 'required_status_checks').parameters.required_status_checks;
  assert.deepEqual(checks.map((check) => check.context), ['test-linux', 'test-windows']);
  assert.deepEqual(review.bypass_actors, JSON.parse(readFileSync('.github/rulesets/main-review.json', 'utf8')).bypass_actors);
});

test('main requires the source-branch guard and every required check is a job of the workflow', () => {
  const workflow = readFileSync('.github/workflows/build.yml', 'utf8');
  for (const name of ['main-ci', 'staging-ci']) {
    const ruleset = JSON.parse(readFileSync(`.github/rulesets/${name}.json`, 'utf8'));
    const checks = ruleset.rules.find((rule) => rule.type === 'required_status_checks').parameters.required_status_checks;
    const contexts = checks.map((check) => check.context);
    for (const context of contexts) assert.match(workflow, new RegExp(`^  ${context}:$`, 'm'), `${name}: ${context}`);
    assert.equal(contexts.includes('check-source-branch'), name === 'main-ci');
  }
});
