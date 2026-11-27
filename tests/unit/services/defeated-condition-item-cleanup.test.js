import '../../setup.js';

import { handleDefeatConditionItemCreated } from '../../../scripts/services/defeated-actor-cleanup.js';

const gmWithAvs = { isCurrentUserGm: () => true, isAvsEnabled: () => true };

describe('defeat cleanup for PF2e condition items', () => {
  test('cleans overrides when an unconscious condition item is created on an actor', async () => {
    const actor = { id: 'pc' };
    const cleanupDefeatedActor = jest.fn();

    const result = await handleDefeatConditionItemCreated(
      { type: 'condition', slug: 'unconscious', name: 'Unconscious', parent: actor },
      { ...gmWithAvs, cleanupDefeatedActor },
    );

    expect(result).toEqual({ cleaned: true });
    expect(cleanupDefeatedActor).toHaveBeenCalledWith(actor);
  });

  test('ignores non-condition items even when named like a defeat', async () => {
    const cleanupDefeatedActor = jest.fn();

    const result = await handleDefeatConditionItemCreated(
      { type: 'effect', slug: 'effect-dead-eye', name: 'Dead Eye', parent: { id: 'pc' } },
      { ...gmWithAvs, cleanupDefeatedActor },
    );

    expect(result).toEqual({ cleaned: false, reason: 'not-condition' });
    expect(cleanupDefeatedActor).not.toHaveBeenCalled();
  });

  test('ignores conditions that are not defeats', async () => {
    const cleanupDefeatedActor = jest.fn();

    await handleDefeatConditionItemCreated(
      { type: 'condition', slug: 'frightened', name: 'Frightened', parent: { id: 'pc' } },
      { ...gmWithAvs, cleanupDefeatedActor },
    );

    expect(cleanupDefeatedActor).not.toHaveBeenCalled();
  });
});
