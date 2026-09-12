import test from 'node:test';
import assert from 'node:assert/strict';

import { useAsyncRequest } from '../../client/src/composables/useAsyncRequest.js';

test('tracks async request lifecycle and returns the request value', async () => {
  const state = useAsyncRequest();
  let observedLoading = false;

  const resultPromise = state.run(async () => {
    observedLoading = state.loading.value;
    return { ok: true };
  });

  assert.deepEqual(await resultPromise, { ok: true });
  assert.equal(observedLoading, true);
  assert.equal(state.loading.value, false);
  assert.equal(state.pendingCount.value, 0);
  assert.equal(state.error.value, null);
});

test('normalizes failed requests and returns the configured fallback', async () => {
  const state = useAsyncRequest({ fallbackError: 'Fallback error' });
  const result = await state.run(async () => {
    throw new Error('Request failed');
  }, { fallback: [] });

  assert.deepEqual(result, []);
  assert.equal(state.error.value, 'Request failed');
  assert.equal(state.loading.value, false);
});

test('can rethrow a failed request after updating state', async () => {
  const state = useAsyncRequest();
  const error = new Error('Needs handling');

  await assert.rejects(
    state.run(async () => {
      throw error;
    }, { rethrow: true }),
    error
  );
  assert.equal(state.error.value, 'Needs handling');
});
