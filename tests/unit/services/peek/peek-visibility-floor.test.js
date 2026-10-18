import { PeekRegistry } from '../../../../scripts/services/Peek/PeekRegistry.js';
import {
  applyPeekVisibilityFloor,
  clearPeekVisibilityFloors,
  isPeekFloorVisible,
} from '../../../../scripts/services/Peek/peek-visibility-floor.js';

describe('peek visibility floor', () => {
  let registry;
  const peekData = { origin: { x: 0, y: 0 }, direction: 0, fov: 20 };

  beforeEach(() => {
    registry = new PeekRegistry();
    clearPeekVisibilityFloors();
  });

  function floor(computed, targetId, baselineMap, observerId = 'peeker') {
    return applyPeekVisibilityFloor({
      observerId,
      targetId,
      computed,
      readBaselineMap: () => baselineMap,
      registry,
    });
  }

  test('no active peek leaves the computed state alone', () => {
    expect(floor('hidden', 'a', { a: 'observed' })).toBe('hidden');
  });

  test('a peek never downgrades a creature the peeker could already see', () => {
    registry.set('peeker', peekData, 1);
    const map = { a: 'observed', b: 'concealed' };
    expect(floor('hidden', 'a', map)).toBe('observed');
    expect(floor('undetected', 'b', map)).toBe('concealed');
  });

  test('creatures missing from the map count as observed', () => {
    registry.set('peeker', peekData, 1);
    expect(floor('hidden', 'a', {})).toBe('observed');
  });

  test('a peek can still reveal creatures the peeker could not see', () => {
    registry.set('peeker', peekData, 1);
    const map = { a: 'hidden', b: 'hidden' };
    expect(floor('observed', 'a', map)).toBe('observed');
    expect(floor('undetected', 'b', map)).toBe('undetected');
  });

  test('the baseline is captured once per peek, not re-read mid-peek', () => {
    registry.set('peeker', peekData, 1);
    const map = { a: 'observed' };
    expect(floor('hidden', 'a', map)).toBe('observed');
    map.a = 'hidden';
    expect(floor('hidden', 'a', map)).toBe('observed');
  });

  test('a new peek captures a fresh baseline', () => {
    registry.set('peeker', peekData, 1);
    expect(floor('hidden', 'a', { a: 'observed' })).toBe('observed');
    registry.clear('peeker');
    registry.set('peeker', peekData, 2);
    expect(floor('hidden', 'a', { a: 'hidden' })).toBe('hidden');
  });

  test('re-aiming keeps the same peek session', () => {
    registry.set('peeker', peekData, 1);
    registry.set('peeker', { ...peekData, direction: 1 }, 5);
    expect(registry.get('peeker').startedAt).toBe(1);
  });

  test('isPeekFloorVisible reports floor-visible targets only while peeking', () => {
    const readBaselineMap = () => ({ a: 'observed', b: 'hidden' });
    expect(isPeekFloorVisible({ observerId: 'peeker', targetId: 'a', readBaselineMap, registry })).toBe(false);
    registry.set('peeker', peekData, 1);
    expect(isPeekFloorVisible({ observerId: 'peeker', targetId: 'a', readBaselineMap, registry })).toBe(true);
    expect(isPeekFloorVisible({ observerId: 'peeker', targetId: 'b', readBaselineMap, registry })).toBe(false);
  });
});
