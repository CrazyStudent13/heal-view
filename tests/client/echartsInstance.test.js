import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveEchartsThemeColors } from '../../client/src/composables/useEchartsInstance.js';

test('resolves shared chart colors for light and dark themes', () => {
  assert.deepEqual(resolveEchartsThemeColors(false), {
    textColor: '#606266',
    axisLineColor: '#e8e8e8',
    splitLineColor: '#ebeef5',
    backgroundColor: '#ffffff'
  });

  assert.deepEqual(resolveEchartsThemeColors(true), {
    textColor: '#a8a8a8',
    axisLineColor: '#3a3a3a',
    splitLineColor: '#3a3a3a',
    backgroundColor: '#262626'
  });
});
