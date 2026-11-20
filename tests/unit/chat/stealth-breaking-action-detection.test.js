import '../../setup.js';
import { extractActionData } from '../../../scripts/chat/services/action-extractor.js';

const SETTING = 'stealthBreakingActionConsequences';

function hiddenToken() {
  return {
    actor: { itemTypes: { condition: [] } },
    document: {
      flags: {
        'pf2e-visioner': {
          'avs-override-from-observer': { state: 'hidden', source: 'hide_action' },
        },
      },
    },
  };
}

function observedToken() {
  return { actor: { itemTypes: { condition: [] } }, document: { flags: {} } };
}

function actionCard({ token = hiddenToken(), context, origin } = {}) {
  return {
    id: 'msg-stealth-break',
    flags: { pf2e: { ...(context ? { context } : {}), ...(origin ? { origin } : {}) } },
    token: { object: token },
  };
}

describe('Stealth-breaking non-attack action detection', () => {
  beforeEach(() => {
    game.settings.set('pf2e-visioner', SETTING, true);
  });

  test('action card from a hidden actor opens stealth-break consequences', async () => {
    const result = await extractActionData(
      actionCard({ origin: { type: 'action', rollOptions: ['origin:item:slug:interact'] } }),
    );
    expect(result?.actionType).toBe('consequences');
    expect(result.attackData).toEqual({ isAttackRoll: false, stealthBreak: true });
  });

  test('spell cast from a hidden actor opens stealth-break consequences', async () => {
    const result = await extractActionData(
      actionCard({
        context: { type: 'spell-cast', options: [] },
        origin: { type: 'spell', rollOptions: ['origin:item:slug:heal'] },
      }),
    );
    expect(result?.actionType).toBe('consequences');
    expect(result.attackData.stealthBreak).toBe(true);
  });

  test('skill action from a hidden actor opens stealth-break consequences', async () => {
    const result = await extractActionData(
      actionCard({ context: { type: 'skill-check', options: ['action:demoralize'] } }),
    );
    expect(result?.actionType).toBe('consequences');
    expect(result.attackData.stealthBreak).toBe(true);
  });

  test('Step does not break stealth', async () => {
    const result = await extractActionData(
      actionCard({ origin: { type: 'action', rollOptions: ['origin:item:slug:step'] } }),
    );
    expect(result).toBeNull();
  });

  test('spell with the attack trait is left to the attack roll', async () => {
    const result = await extractActionData(
      actionCard({
        context: { type: 'spell-cast', options: [] },
        origin: { type: 'spell', rollOptions: ['origin:item:trait:attack'] },
      }),
    );
    expect(result).toBeNull();
  });

  test('saving throws do not break stealth', async () => {
    const result = await extractActionData(
      actionCard({ context: { type: 'saving-throw', options: [] } }),
    );
    expect(result).toBeNull();
  });

  test('actor that is not hidden to anyone gets no panel', async () => {
    const result = await extractActionData(
      actionCard({
        token: observedToken(),
        origin: { type: 'action', rollOptions: ['origin:item:slug:interact'] },
      }),
    );
    expect(result).toBeNull();
  });

  test('setting off keeps non-attack actions untouched', async () => {
    game.settings.set('pf2e-visioner', SETTING, false);
    const result = await extractActionData(
      actionCard({ origin: { type: 'action', rollOptions: ['origin:item:slug:interact'] } }),
    );
    expect(result).toBeNull();
  });

  test('attack consequences keep attack data', async () => {
    const result = await extractActionData(
      actionCard({ context: { type: 'attack-roll', options: [] } }),
    );
    expect(result?.actionType).toBe('consequences');
    expect(result.attackData).toEqual({ isAttackRoll: true });
  });
});
