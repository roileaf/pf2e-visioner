import '../../../setup.js';
import { isDoorPeekAllowed, readPeekDC, rollPeekCheck } from '../../../../scripts/services/Peek/peek-door-dc.js';

describe('peek door DC', () => {
  test('readPeekDC returns numeric flag', () => {
    const door = { getFlag: (m, k) => (m === 'pf2e-visioner' && k === 'peekDC' ? 18 : undefined) };
    expect(readPeekDC(door)).toBe(18);
  });

  test('readPeekDC returns null when unset', () => {
    const door = { getFlag: () => undefined };
    expect(readPeekDC(door)).toBeNull();
  });

  test('readPeekDC returns null for a string value', () => {
    const door = { getFlag: () => '18' };
    expect(readPeekDC(door)).toBeNull();
  });

  test('readPeekDC returns null for NaN', () => {
    const door = { getFlag: () => NaN };
    expect(readPeekDC(door)).toBeNull();
  });

  test('isDoorPeekAllowed true when flag is true', () => {
    const door = { getFlag: (m, k) => (m === 'pf2e-visioner' && k === 'peekAllowed' ? true : undefined) };
    expect(isDoorPeekAllowed(door)).toBe(true);
  });

  test('isDoorPeekAllowed false when flag is false', () => {
    const door = { getFlag: () => false };
    expect(isDoorPeekAllowed(door)).toBe(false);
  });

  test('isDoorPeekAllowed false when flag is undefined', () => {
    const door = { getFlag: () => undefined };
    expect(isDoorPeekAllowed(door)).toBe(false);
  });

  test('isDoorPeekAllowed false for a non-boolean value', () => {
    const door = { getFlag: () => 'true' };
    expect(isDoorPeekAllowed(door)).toBe(false);
  });

  describe('allDoorsPeekable world setting', () => {
    afterEach(() => {
      game.settings.set('pf2e-visioner', 'allDoorsPeekable', undefined);
    });

    test('door without flag is peekable when setting is on', () => {
      game.settings.set('pf2e-visioner', 'allDoorsPeekable', true);
      expect(isDoorPeekAllowed({ getFlag: () => undefined })).toBe(true);
    });

    test('door with flag explicitly false is peekable when setting is on', () => {
      game.settings.set('pf2e-visioner', 'allDoorsPeekable', true);
      expect(isDoorPeekAllowed({ getFlag: () => false })).toBe(true);
    });

    test('door without flag is not peekable when setting is off', () => {
      game.settings.set('pf2e-visioner', 'allDoorsPeekable', false);
      expect(isDoorPeekAllowed({ getFlag: () => undefined })).toBe(false);
    });

    test('missing door is not peekable even when setting is on', () => {
      game.settings.set('pf2e-visioner', 'allDoorsPeekable', true);
      expect(isDoorPeekAllowed(null)).toBe(false);
    });
  });

  test('rollPeekCheck success when degree >= 2', async () => {
    const roll = jest.fn(async () => ({ degreeOfSuccess: 2 }));
    const out = await rollPeekCheck({ token: createMockToken({ id: 't' }), dc: 15, roll });
    expect(out.success).toBe(true);
  });

  test('rollPeekCheck failure when degree < 2', async () => {
    const roll = jest.fn(async () => ({ degreeOfSuccess: 1 }));
    const out = await rollPeekCheck({ token: createMockToken({ id: 't' }), dc: 15, roll });
    expect(out.success).toBe(false);
  });
});
