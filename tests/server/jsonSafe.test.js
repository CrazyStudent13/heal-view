import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonParse } from '../../server/src/utils/jsonSafe.js';

test('parses JSON safely with fallback values', () => {
  assert.deepEqual(safeJsonParse('{"a":1}', {}), { a: 1 });
  assert.deepEqual(safeJsonParse('bad-json', []), []);
  assert.equal(safeJsonParse('', null), null);
  assert.deepEqual(safeJsonParse({ a: 1 }, {}), { a: 1 });
});
