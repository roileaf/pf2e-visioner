/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import '../../setup.js';

const mockGetVisibilityMap = jest.fn(() => ({}));
const mockGetCoverMap = jest.fn(() => ({}));

jest.mock('../../../scripts/utils.js', () => ({
  getVisibilityMap: mockGetVisibilityMap,
  getCoverMap: mockGetCoverMap,
}));

jest.mock('../../../scripts/stores/detection-map.js', () => ({
  getDetectionBetween: jest.fn(),
}));

function makeToken(id, x = 0) {
  return {
    id,
    x,
    y: 0,
    isVisible: true,
    isOwner: true,
    document: { id, width: 1, height: 1 },
    center: { x: x + 25, y: 25 },
    mesh: {},
    on: jest.fn(),
    off: jest.fn(),
  };
}

describe('keyboard badge overlay performance', () => {
  let observer;
  let target;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    mockGetVisibilityMap.mockReset();
    mockGetVisibilityMap.mockImplementation((token) =>
      token?.id === 'target' ? { observer: 'hidden' } : { target: 'hidden' },
    );
    global.PIXI = {
      Point: class Point {
        constructor(x, y) {
          this.x = x;
          this.y = y;
        }
      },
      Container: class Container {
        destroy = jest.fn();
      },
    };
    global.canvas.app = {
      view: {
        getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0 })),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      ticker: { add: jest.fn(), remove: jest.fn() },
    };
    global.canvas.stage = { pivot: { x: 0, y: 0 }, scale: { x: 1 } };
    global.canvas.animatePan = jest.fn();
    global.canvas.tokens.addChild = jest.fn();
    global.canvas.tokens.toGlobal = jest.fn((point) => point);
    observer = makeToken('observer', 0);
    target = makeToken('target', 100);
    global.canvas.tokens.controlled = [observer];
    global.canvas.tokens.placeables = [observer, target];
    global.game.user.isGM = true;
    global.game.settings.get = jest.fn((moduleId, settingId) => {
      if (moduleId === 'pf2e-visioner' && settingId === 'enableHoverTooltips') return true;
      if (moduleId === 'pf2e-visioner' && settingId === 'tooltipFontSize') return 'medium';
      return false;
    });
  });

  test('canvas rect is measured once across repeated overlays until the window resizes', async () => {
    const { initializeHoverTooltips, onHighlightObjects, showControlledTokenVisibility } =
      await import('../../../scripts/services/HoverTooltips.js');
    initializeHoverTooltips();
    const measure = global.canvas.app.view.getBoundingClientRect;

    showControlledTokenVisibility();
    onHighlightObjects(false);
    showControlledTokenVisibility();
    onHighlightObjects(false);
    expect(measure).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('resize'));
    showControlledTokenVisibility();
    expect(measure).toHaveBeenCalledTimes(2);
  });

  test('badges render inside one layout-contained layer instead of directly in the body', async () => {
    const { onHighlightObjects, showControlledTokenVisibility } = await import(
      '../../../scripts/services/HoverTooltips.js'
    );

    showControlledTokenVisibility();
    onHighlightObjects(false);
    showControlledTokenVisibility();

    const layers = document.querySelectorAll('#pf2e-visioner-tooltip-badge-layer');
    expect(layers).toHaveLength(1);
    const layer = layers[0];
    expect(layer.parentElement).toBe(document.body);
    expect(layer.style.contain).toBe('strict');
    expect(layer.style.pointerEvents).toBe('none');
    const badge = document.querySelector('.pf2e-visioner-tooltip-badge');
    expect(badge).not.toBeNull();
    expect(layer.contains(badge)).toBe(true);
  });

  test('observer key overlay start shows observer badges and keeps observer mode while held', async () => {
    const { HoverTooltips, startObserverKeyOverlay } = await import(
      '../../../scripts/services/HoverTooltips.js'
    );

    startObserverKeyOverlay();

    expect(HoverTooltips.tooltipMode).toBe('observer');
    expect(HoverTooltips.isShowingKeyTooltips).toBe(true);
    expect(HoverTooltips.keyTooltipTokens.has('observer')).toBe(true);
  });

  test('observer key overlay end clears badges and returns to target mode', async () => {
    const { HoverTooltips, endObserverKeyOverlay, startObserverKeyOverlay } = await import(
      '../../../scripts/services/HoverTooltips.js'
    );

    startObserverKeyOverlay();
    endObserverKeyOverlay();

    expect(HoverTooltips.tooltipMode).toBe('target');
    expect(HoverTooltips.isShowingKeyTooltips).toBe(false);
    expect(HoverTooltips.keyTooltipTokens.size).toBe(0);
    expect(document.querySelectorAll('.pf2e-visioner-tooltip-badge')).toHaveLength(0);
  });

  test('the O keybinding drives the observer key overlay', async () => {
    const registered = new Map();
    global.game.keybindings = {
      register: jest.fn((_moduleId, key, config) => registered.set(key, config)),
    };
    const hover = await import('../../../scripts/services/HoverTooltips.js');
    const start = jest.spyOn(hover, 'startObserverKeyOverlay').mockImplementation(() => {});
    const end = jest.spyOn(hover, 'endObserverKeyOverlay').mockImplementation(() => {});
    const { registerKeybindings } = await import('../../../scripts/settings.js');

    registerKeybindings();
    await registered.get('toggleObserverMode').onDown();
    await registered.get('toggleObserverMode').onUp();

    expect(start).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  test('lifecycle no longer binds a raw window listener for the O key', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../scripts/hooks/lifecycle.js'),
      'utf8',
    );
    expect(source).not.toMatch(/toLowerCase\(\)\s*!==\s*'o'/);
  });
});
