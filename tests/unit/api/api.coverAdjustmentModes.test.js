/**
 * @jest-environment jsdom
 */

import '../../setup.js';

describe('api.coverAdjustmentModes', () => {
  test('exposes supported adjustCover modes including minimum', async () => {
    const { api } = await import('../../../scripts/api.js');
    expect(api.coverAdjustmentModes).toEqual(['step', 'bonus', 'minimum']);
  });

  test('returns a copy so callers cannot mutate the supported list', async () => {
    const { api } = await import('../../../scripts/api.js');
    api.coverAdjustmentModes.push('bogus');
    expect(api.coverAdjustmentModes).toEqual(['step', 'bonus', 'minimum']);
  });
});
