import '../../setup.js';

import {
  clearGmVisionBypassCache,
  shouldBypassAvsForGmVision,
} from '../../../scripts/services/gm-vision-bypass.js';

describe('GM Vision read from the system settings cache', () => {
  let originalCanvas;
  let originalPf2e;

  beforeEach(() => {
    originalCanvas = global.canvas;
    originalPf2e = global.game.pf2e;
    global.game.user.isGM = true;
    global.game.pf2e = { settings: { gmVision: true } };
    global.canvas = {
      ...global.canvas,
      ready: true,
      app: { ticker: { lastTime: 1 } },
      scene: { getFlag: jest.fn(() => false) },
    };
    clearGmVisionBypassCache();
  });

  afterEach(() => {
    global.game.pf2e = originalPf2e;
    global.canvas = originalCanvas;
    clearGmVisionBypassCache();
    jest.restoreAllMocks();
  });

  test('uses the system cached GM Vision value without reading settings on any frame', async () => {
    const get = jest.spyOn(global.game.settings, 'get');
    const gmVisionReads = () =>
      get.mock.calls.filter(([namespace, key]) => namespace === 'pf2e' && key === 'gmVision').length;

    for (let frame = 1; frame <= 50; frame += 1) {
      global.canvas.app.ticker.lastTime = frame;
      await Promise.resolve();
      expect(shouldBypassAvsForGmVision()).toBe(true);
    }

    expect(gmVisionReads()).toBe(0);
  });

  test('follows the system cache as soon as the next frame after GM Vision is toggled', async () => {
    expect(shouldBypassAvsForGmVision()).toBe(true);

    global.game.pf2e.settings.gmVision = false;
    global.canvas.app.ticker.lastTime = 2;
    await Promise.resolve();

    expect(shouldBypassAvsForGmVision()).toBe(false);
  });
});
