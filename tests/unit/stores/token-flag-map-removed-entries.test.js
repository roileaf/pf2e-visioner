import {
  applyTokenFlagMapUpdates,
  setTokenFlagMap,
} from '../../../scripts/stores/token-flag-map-persistence.js';

function mergeLikeFoundry(stored, update) {
  const next = { ...stored };
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith('-=')) delete next[key.slice(2)];
    else next[key] = value;
  }
  return next;
}

function createStoredDocument(initialMap) {
  let stored = { ...initialMap };
  const document = {
    id: 'observer',
    getFlag: jest.fn(() => stored),
    update: jest.fn(async (changes) => {
      stored = mergeLikeFoundry(stored, changes['flags.pf2e-visioner.detection'] ?? {});
    }),
  };
  const scene = {
    tokens: new Map([['observer', document]]),
    updateEmbeddedDocuments: jest.fn(async (_type, updates) => {
      for (const update of updates) {
        stored = mergeLikeFoundry(stored, update['flags.pf2e-visioner.detection'] ?? {});
      }
    }),
  };
  document.parent = scene;
  return { document, scene, getStored: () => stored };
}

const options = { moduleId: 'pf2e-visioner', flagKey: 'detection', invalidate: jest.fn() };

describe('token flag map persistence with removed entries', () => {
  test('batch write deletes entries missing from the next map so the map is stable afterwards', async () => {
    const { document, scene, getStored } = createStoredDocument({
      kept: { sense: 'vision', isPrecise: true },
      stale: { sense: 'hearing', isPrecise: false },
    });
    const nextMap = { kept: { sense: 'vision', isPrecise: true } };
    const write = () =>
      applyTokenFlagMapUpdates({
        ...options,
        entries: [{ tokenId: 'observer', map: nextMap }],
        scene,
        getTokenById: () => ({ document }),
      });

    expect(await write()).toEqual({ written: 1, skipped: 0 });
    expect(getStored()).toEqual(nextMap);
    expect(await write()).toEqual({ written: 0, skipped: 1 });
    expect(scene.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
  });

  test('single-token write deletes entries missing from the next map so the map is stable afterwards', async () => {
    const { document, getStored } = createStoredDocument({
      kept: { sense: 'vision', isPrecise: true },
      stale: { sense: 'hearing', isPrecise: false },
    });
    const nextMap = { kept: { sense: 'vision', isPrecise: true } };
    const write = () => setTokenFlagMap({ ...options, token: { document }, map: nextMap });

    expect(await write()).toEqual({ written: 1, skipped: 0 });
    expect(getStored()).toEqual(nextMap);
    expect(await write()).toEqual({ written: 0, skipped: 1 });
    expect(document.update).toHaveBeenCalledTimes(1);
  });
});
