import { applySeekChangesInternal } from '../../../scripts/chat/services/actions/Seek/seek-change-application.js';

function makePc(id) {
  return { id, document: { id }, actor: { type: 'character', hasPlayerOwner: true } };
}

function makeTarget(type, hidden) {
  const document = { id: 'loot', hidden, update: jest.fn(async (data) => Object.assign(document, data)) };
  return { id: 'loot', document, actor: { type } };
}

function baseDeps(tokens, visibility = {}) {
  return {
    groupChangesByObserver: (items) => [{ observer: items[0].observer, items }],
    getApplyDirection: () => 'observer_to_target',
    applyVisibilityChanges: jest.fn().mockResolvedValue(undefined),
    getSceneTokens: () => tokens,
    getVisibilityBetween: jest.fn((observer) => visibility[observer.id] || 'observed'),
    setVisibilityBetween: jest.fn().mockResolvedValue(undefined),
  };
}

describe('seek reveal of Foundry-hidden loot', () => {
  test('observed result on Foundry-hidden loot unhides it and keeps other PCs hidden', async () => {
    const seeker = makePc('seeker');
    const other = makePc('other');
    const target = makeTarget('loot', true);
    const deps = baseDeps([seeker, other, target]);

    await applySeekChangesInternal([{ observer: seeker, target, newVisibility: 'observed' }], deps);

    expect(target.document.hidden).toBe(false);
    expect(deps.setVisibilityBetween).toHaveBeenCalledWith(other, target, 'hidden', {
      direction: 'observer_to_target',
      skipEphemeralUpdate: true,
    });
    expect(deps.setVisibilityBetween).not.toHaveBeenCalledWith(
      seeker,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(deps.applyVisibilityChanges).toHaveBeenCalled();
  });

  test('does not overwrite other PCs that are already undetected', async () => {
    const seeker = makePc('seeker');
    const other = makePc('other');
    const target = makeTarget('loot', true);
    const deps = baseDeps([seeker, other, target], { other: 'undetected' });

    await applySeekChangesInternal([{ observer: seeker, target, newVisibility: 'observed' }], deps);

    expect(target.document.hidden).toBe(false);
    expect(deps.setVisibilityBetween).not.toHaveBeenCalled();
  });

  test('leaves Foundry-hidden loot alone when the result stays hidden', async () => {
    const seeker = makePc('seeker');
    const target = makeTarget('loot', true);
    const deps = baseDeps([seeker, target]);

    await applySeekChangesInternal([{ observer: seeker, target, newVisibility: 'hidden' }], deps);

    expect(target.document.hidden).toBe(true);
    expect(target.document.update).not.toHaveBeenCalled();
  });

  test('does not unhide Foundry-hidden creatures', async () => {
    const seeker = makePc('seeker');
    const target = makeTarget('npc', true);
    const deps = baseDeps([seeker, target]);

    await applySeekChangesInternal([{ observer: seeker, target, newVisibility: 'observed' }], deps);

    expect(target.document.update).not.toHaveBeenCalled();
  });
});
