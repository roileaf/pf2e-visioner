import '../../setup.js';
import { isSightBlockedBetweenCenters } from '../../../scripts/helpers/explain-line-of-sight.js';

describe('explainVisibility line of sight', () => {
  const originalConfig = global.CONFIG;
  const originalUtils = global.foundry?.utils;

  afterEach(() => {
    global.CONFIG = originalConfig;
    if (global.foundry) global.foundry.utils = originalUtils;
  });

  test('uses the sight polygon backend without foundry.utils.Ray', () => {
    const testCollision = jest.fn(() => true);
    global.CONFIG = { ...originalConfig, Canvas: { polygonBackends: { sight: { testCollision } } } };
    global.foundry = { ...global.foundry, utils: { ...originalUtils, Ray: undefined } };
    const observer = { center: { x: 10, y: 20 } };
    const target = { center: { x: 110, y: 220 } };

    expect(isSightBlockedBetweenCenters(observer, target)).toBe(true);
    expect(testCollision).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      { x: 110, y: 220 },
      { type: 'sight', mode: 'any' },
    );
  });

  test('reports clear sight when nothing collides', () => {
    global.CONFIG = { ...originalConfig, Canvas: { polygonBackends: { sight: { testCollision: () => false } } } };

    expect(isSightBlockedBetweenCenters({ center: { x: 0, y: 0 } }, { center: { x: 1, y: 1 } })).toBe(false);
  });
});
