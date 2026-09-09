import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ApiRequestError,
  createApiRequestError,
  normalizeErrorText,
  normalizeRequestError
} from '../../client/src/utils/requestState.js';

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

test('normalizes API errors into a stable error contract', () => {
  const error = createApiRequestError({
    response: {
      status: 422,
      data: {
        code: 'INVALID_DATE_RANGE',
        message: 'Date range is invalid',
        details: { field: 'startDate' }
      }
    },
    message: 'Request failed with status code 422'
  });

  assert.ok(error instanceof ApiRequestError);
  assert.equal(error.message, 'Date range is invalid');
  assert.equal(error.code, 'INVALID_DATE_RANGE');
  assert.equal(error.status, 422);
  assert.deepEqual(error.details, { field: 'startDate' });
  assert.equal(error.isNetworkError, false);
  assert.equal(error.isTimeout, false);
});

test('provides stable messages for timeout and network failures', () => {
  const timeout = createApiRequestError({ code: 'ECONNABORTED' });
  const network = createApiRequestError({ code: 'ERR_NETWORK' });

  assert.equal(timeout.message, '请求超时，请稍后重试');
  assert.equal(timeout.isTimeout, true);
  assert.equal(network.message, '无法连接服务，请检查服务是否已启动');
  assert.equal(network.isNetworkError, true);
});

test('supports plain-text API error responses', () => {
  const error = createApiRequestError({
    response: {
      status: 503,
      data: 'Service unavailable'
    }
  });

  assert.equal(error.message, 'Service unavailable');
  assert.equal(error.status, 503);
});

test('keeps cancellation errors out of user-facing error state', () => {
  const canceled = { name: 'CanceledError', code: 'ERR_CANCELED', message: 'canceled' };

  assert.equal(createApiRequestError(canceled), canceled);
  assert.equal(normalizeRequestError(canceled), null);
});
