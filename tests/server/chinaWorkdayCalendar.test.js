import test from 'node:test';
import assert from 'node:assert/strict';
import { isChinaWorkday, normalizeChinaCalendarPayload } from '../../server/src/services/chinaWorkdayCalendar.js';

test('China workday calculation applies holiday and transfer-workday exceptions', () => {
  assert.equal(isChinaWorkday('2026-09-21'), true);
  assert.equal(isChinaWorkday('2026-09-20'), false);
  assert.equal(isChinaWorkday('2026-09-20', { type: 'transfer_workday' }), true);
  assert.equal(isChinaWorkday('2026-10-05', { type: 'public_holiday' }), false);
});

test('China calendar source payload accepts only recognized dates and types', () => {
  const days = normalizeChinaCalendarPayload(
    {
      year: 2026,
      region: 'CN',
      dates: [
        { date: '2026-01-01', name_cn: '元旦', type: 'public_holiday' },
        { date: '2026-01-04', name: '元旦补班', type: 'transfer_workday' }
      ]
    },
    2026
  );

  assert.deepEqual(days, [
    { date: '2026-01-01', name: '元旦', type: 'public_holiday' },
    { date: '2026-01-04', name: '元旦补班', type: 'transfer_workday' }
  ]);
  assert.throws(
    () =>
      normalizeChinaCalendarPayload(
        { year: 2026, region: 'CN', dates: [{ date: '2026-01-01', type: 'weekend' }] },
        2026
      ),
    /Invalid China calendar day/
  );
});
