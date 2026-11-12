import '../../../setup.js';

import {
  cleanupHoverExplain,
  explainObserversFor,
  hoverExplainEnabled,
  initializeHoverExplain,
} from '../../../../scripts/services/HoverExplain/hover-explain.js';

function withSettings(values) {
  game.settings.get.mockImplementation((_module, key) => values[key]);
}

afterEach(() => {
  cleanupHoverExplain();
});

describe('hover explain wiring', () => {
  test('needs both hover tooltips and the explain setting', () => {
    withSettings({ enableHoverTooltips: true, hoverExplain: true });
    expect(hoverExplainEnabled()).toBe(true);
    withSettings({ enableHoverTooltips: false, hoverExplain: true });
    expect(hoverExplainEnabled()).toBe(false);
    withSettings({ enableHoverTooltips: true, hoverExplain: false });
    expect(hoverExplainEnabled()).toBe(false);
  });

  test('stays out of the way while a keybind overlay is shown', () => {
    withSettings({ enableHoverTooltips: true, hoverExplain: true });
    expect(hoverExplainEnabled({ isShowingFactorsOverlay: true })).toBe(false);
  });

  test('a GM with nothing selected explains from player characters only', () => {
    const pc = { id: 'pc', isOwner: true, actor: { hasPlayerOwner: true, type: 'character' } };
    const npc = { id: 'npc', isOwner: true, actor: { hasPlayerOwner: false, type: 'npc' } };
    const hovered = { id: 'goblin' };
    const observers = explainObserversFor(hovered, { isGM: true, tokens: { controlled: [], placeables: [pc, npc, hovered] } });
    expect(observers.map((t) => t.id)).toEqual(['pc']);
  });

  test('a player with nothing selected explains from tokens they own', () => {
    const mine = { id: 'mine', isOwner: true, actor: { type: 'character' } };
    const theirs = { id: 'theirs', isOwner: false, actor: { hasPlayerOwner: true, type: 'character' } };
    const observers = explainObserversFor({ id: 'goblin' }, { isGM: false, tokens: { controlled: [], placeables: [mine, theirs] } });
    expect(observers.map((t) => t.id)).toEqual(['mine']);
  });

  test('registers on hover and removes its hooks on cleanup', () => {
    Hooks.on.mockImplementation((hook) => `${hook}-id`);
    try {
      initializeHoverExplain();
      expect(Hooks.on).toHaveBeenCalledWith('hoverToken', expect.any(Function));
      cleanupHoverExplain();
      expect(Hooks.off).toHaveBeenCalledWith('hoverToken', 'hoverToken-id');
    } finally {
      Hooks.on.mockReset();
    }
  });
});
