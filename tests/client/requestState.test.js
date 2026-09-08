import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeErrorText, normalizeRequestError } from '../../client/src/utils/requestState.js';

test('normalizes nested request errors to displayable text', () => {
  assert.equal(normalizeErrorText({ message: ' API failed ' }), 'API failed');
  assert.equal(normalizeErrorText({ title: 'Bad request' }), 'Bad request');
  assert.equal(normalizeErrorText({ description: 'Missing date' }), 'Missing date');
  assert.equal(normalizeErrorText({ code: 'UNKNOWN' }), '');
});

test('normalizes response error objects without leaking object strings', () => {
  const error = {
    response: {
      data: {
        error: { message: 'Date range is invalid' }
      }
    },
    message: 'Request failed with status code 400'
  };

  assert.equal(normalizeRequestError(error), 'Date range is invalid');
});
