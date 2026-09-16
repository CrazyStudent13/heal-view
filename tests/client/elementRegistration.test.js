import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource = fs.readFileSync(new URL('../../client/src/main.js', import.meta.url), 'utf8');
const exercisePageSource = fs.readFileSync(new URL('../../client/src/pages/PlansPage.vue', import.meta.url), 'utf8');

test('registers the Element Plus pagination component used by the exercise list', () => {
  assert.match(exercisePageSource, /<el-pagination\b/);
  assert.match(mainSource, /import\s*\{[\s\S]*\bElPagination\b[\s\S]*\}\s*from\s*['"]element-plus['"]/);
  assert.match(mainSource, /const elementComponents = \[[\s\S]*\bElPagination\b[\s\S]*\]/);
});
