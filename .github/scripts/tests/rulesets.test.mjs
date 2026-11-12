/** Verify the tracked main-branch ruleset definitions retain their separation. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

test('CI checks have no bypass and reviews have a separate PR-only bypass', () => {
  const ci = JSON.parse(readFileSync('.github/rulesets/main-ci.json', 'utf8'));
  const review = JSON.parse(readFileSync('.github/rulesets/main-review.json', 'utf8'));
  assert.deepEqual(ci.bypass_actors, []);
  assert.ok(ci.rules.some((rule) => rule.type === 'required_status_checks'));
  assert.equal(review.rules.find((rule) => rule.type === 'pull_request').parameters.required_approving_review_count, 1);
  assert.deepEqual(review.bypass_actors.map((actor) => actor.bypass_mode), ['pull_request', 'pull_request']);
});
