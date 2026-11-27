import '../../setup.js';

import {
  forgetInvisiblePreviousStates,
  getRememberedInvisiblePreviousState,
  resolveInvisiblePreviousState,
} from '../../../scripts/visibility/auto-visibility/invisibility-previous-state.js';
import { ConditionManager } from '../../../scripts/visibility/auto-visibility/ConditionManager.js';

function mapCache(states) {
  return { getMap: jest.fn(() => states) };
}

function token(id, flags = {}) {
  return { id, document: { id, flags } };
}

describe('invisibility previous state before flags are recorded', () => {
  afterEach(() => forgetInvisiblePreviousStates('target'));

  test('keeps the first seen state when later passes see the already transitioned state', () => {
    const observer = token('observer');
    const target = token('target');

    expect(resolveInvisiblePreviousState(observer, target, mapCache({ target: 'observed' }))).toBe('observed');
    expect(resolveInvisiblePreviousState(observer, target, mapCache({ target: 'hidden' }))).toBe('observed');
  });

  test('treats a target missing from the batch map as previously observed', () => {
    const observer = token('observer');
    const target = token('target');

    expect(resolveInvisiblePreviousState(observer, target, mapCache({}))).toBe('observed');
    expect(resolveInvisiblePreviousState(observer, target, mapCache({ target: 'hidden' }))).toBe('observed');
  });

  test('without a batch map there is no previous state', () => {
    expect(resolveInvisiblePreviousState(token('observer'), token('target'), null)).toBeNull();
  });

  test('recorded invisibility flags win over the remembered state', () => {
    const observer = token('observer');
    resolveInvisiblePreviousState(observer, token('target'), mapCache({ target: 'observed' }));
    const target = token('target', {
      'pf2e-visioner': { invisibility: { observer: { previousState: 'hidden' } } },
    });

    expect(resolveInvisiblePreviousState(observer, target, mapCache({ target: 'undetected' }))).toBe('hidden');
  });

  test('forgetting the target clears remembered states', () => {
    const observer = token('observer');
    const target = token('target');
    resolveInvisiblePreviousState(observer, target, mapCache({ target: 'observed' }));

    forgetInvisiblePreviousStates('target');

    expect(getRememberedInvisiblePreviousState('target', 'observer')).toBeNull();
  });

  test('condition recording uses the remembered state instead of the transitioned stored state', async () => {
    global.game.user.isGM = true;
    global.canvas.perception = { update: jest.fn() };
    const actor = {
      id: 'actor-1',
      hasCondition: jest.fn(() => true),
      system: { conditions: { invisible: { active: true } } },
      conditions: { has: jest.fn(() => true) },
    };
    const target = {
      id: 'target',
      name: 'Target',
      actor,
      document: {
        id: 'target',
        flags: {},
        setFlag: jest.fn().mockResolvedValue(undefined),
        unsetFlag: jest.fn().mockResolvedValue(undefined),
      },
    };
    const observer = { id: 'observer', actor: { id: 'observer-actor' }, document: { id: 'observer' } };
    global.game.modules.get.mockReturnValue({ api: { getVisibility: jest.fn(() => 'undetected') } });
    global.canvas.tokens.controlled = [];
    global.canvas.tokens.placeables = [target, observer];
    resolveInvisiblePreviousState(observer, target, mapCache({ target: 'observed' }));

    await ConditionManager.getInstance().handleInvisibilityChange(actor, {
      hasInvisibility: true,
      token: target,
    });

    expect(target.document.setFlag).toHaveBeenCalledWith('pf2e-visioner', 'invisibility', {
      observer: expect.objectContaining({ previousState: 'observed', wasVisible: true }),
    });
  });
});
