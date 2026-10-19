jest.mock('../../../scripts/services/Detection/current-view-hard-hide.js', () => ({
  observerViewStateForCurrentView: jest.fn(() => 'hidden'),
}));
jest.mock('../../../scripts/services/gm-vision-bypass.js', () => ({
  shouldBypassAvsForGmVision: jest.fn(() => false),
}));
jest.mock('../../../scripts/services/scene-token-vision.js', () => ({
  isSceneTokenVisionDisabled: jest.fn(() => false),
}));

import { MODULE_ID } from '../../../scripts/constants.js';
import { registerPf2eHudHealthStatusIntegration } from '../../../scripts/integrations/pf2e-hud-health-status.js';

describe('PF2e HUD health status refresh coalescing', () => {
  let callbacks;
  let onSpy;
  let app;

  beforeEach(() => {
    game.user.isGM = false;
    game.modules.get = jest.fn(() => ({ active: true }));
    game.settings.get = jest.fn((moduleId, key) =>
      moduleId === MODULE_ID && key === 'hideHiddenTokenHealthEstimates' ? 'players' : false,
    );
    document.body.innerHTML = `<section id="pf2e-hud-tooltip">
      <div data-panel="health-status">Injured</div></section>`;
    app = { id: 'pf2e-hud-tooltip', element: document.body.firstElementChild, token: {} };
    callbacks = new Map();
    onSpy = jest.spyOn(Hooks, 'on').mockImplementation((event, callback) => {
      callbacks.set(event, callback);
    });
    registerPf2eHudHealthStatusIntegration();
    callbacks.get('renderApplicationV2')(app, app.element);
    game.settings.get.mockClear();
  });

  afterEach(() => onSpy.mockRestore());

  it('runs one refresh for a burst of token refresh hooks in the same tick', async () => {
    for (let i = 0; i < 50; i += 1) callbacks.get('refreshToken')();
    callbacks.get('updateToken')();
    await Promise.resolve();
    expect(game.settings.get).toHaveBeenCalledTimes(1);
  });

  it('refreshes again for hooks fired after the previous refresh ran', async () => {
    callbacks.get('refreshToken')();
    await Promise.resolve();
    callbacks.get('refreshToken')();
    await Promise.resolve();
    expect(game.settings.get).toHaveBeenCalledTimes(2);
  });

  it('skips the refresh entirely when no HUD tooltip is open', async () => {
    callbacks.get('closeApplicationV2')(app);
    for (let i = 0; i < 10; i += 1) callbacks.get('refreshToken')();
    await Promise.resolve();
    expect(game.settings.get).not.toHaveBeenCalled();
  });
});
