import '../../setup.js';

import { TimedOverrideManager as Timers } from '../../../scripts/services/TimedOverrideManager.js';
import { isMinuteTimerActive } from '../../../scripts/services/minute-timer.js';

describe('minute timers follow game time, not real time', () => {
  let originalTime;

  beforeEach(() => {
    originalTime = game.time;
    game.time = { worldTime: 1000 };
    game.paused = false;
    game.i18n.format.mockImplementation((key, data = {}) =>
      key === 'PF2E_VISIONER.TIMED_OVERRIDE.TIME_REMAINING' ? data.time : key,
    );
  });

  afterEach(() => {
    game.time = originalTime;
    jest.restoreAllMocks();
  });

  function tokenWithTimer(timedOverride) {
    const token = createMockToken({
      id: 'target',
      actor: createMockActor({ type: 'npc' }),
      flags: { 'pf2e-visioner': { 'avs-override-from-observer': { state: 'hidden', timedOverride } } },
    });
    canvas.tokens.placeables = [token];
    return token;
  }

  test('a 5 minute timer expires 300 game seconds after it was set', () => {
    const timer = Timers._buildTimedOverrideData({ type: 'realtime', minutes: 5 });
    expect(timer.expiresAtWorldTime).toBe(1300);
    expect(timer.expiresAt).toBeNull();
  });

  test('real time passing without game time advancing keeps the timer active', () => {
    const timer = Timers._buildTimedOverrideData({ type: 'realtime', minutes: 5 });
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);
    expect(isMinuteTimerActive(timer)).toBe(true);
    expect(Timers.isTimedOverrideActive(timer)).toBeTruthy();
  });

  test('advancing game time past the expiry ends the timer', () => {
    const timer = Timers._buildTimedOverrideData({ type: 'realtime', minutes: 5 });
    game.time.worldTime = 1300;
    expect(isMinuteTimerActive(timer)).toBe(false);
  });

  test('remaining time shows the game time left', () => {
    const timer = Timers._buildTimedOverrideData({ type: 'realtime', minutes: 5 });
    game.time.worldTime = 1090;
    expect(Timers.getRemainingTimeDisplay(timer)).toBe('3m 30s');
  });

  test('a world time update expires a due game-time timer even while paused', async () => {
    const token = tokenWithTimer({ type: 'realtime', expiresAtWorldTime: 1300, expiresAt: null });
    const expire = jest.spyOn(Timers, '_expireOverride').mockResolvedValue();
    game.paused = true;
    game.time.worldTime = 1300;
    await Timers.processRealtimeExpirations();
    expect(expire).toHaveBeenCalledWith(expect.objectContaining({ token, observerId: 'observer' }));
  });

  test('a world time update leaves a game-time timer that is not yet due', async () => {
    tokenWithTimer({ type: 'realtime', expiresAtWorldTime: 1300, expiresAt: null });
    const expire = jest.spyOn(Timers, '_expireOverride').mockResolvedValue();
    game.time.worldTime = 1299;
    await Timers.processRealtimeExpirations();
    expect(expire).not.toHaveBeenCalled();
  });

  test('legacy wall-clock timers do not expire while paused', async () => {
    tokenWithTimer({ type: 'realtime', expiresAt: Date.now() - 1000 });
    const expire = jest.spyOn(Timers, '_expireOverride').mockResolvedValue();
    game.paused = true;
    await Timers.processRealtimeExpirations();
    expect(expire).not.toHaveBeenCalled();
  });

  test('registering hooks listens for world time updates', () => {
    const on = jest.spyOn(Hooks, 'on');
    jest.spyOn(Timers, '_startRealtimeChecker').mockImplementation(() => {});
    Timers.registerHooks();
    expect(on).toHaveBeenCalledWith('updateWorldTime', expect.any(Function));
  });
});
