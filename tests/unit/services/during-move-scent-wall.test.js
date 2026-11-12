import { jest } from '@jest/globals';
import '../../setup.js';

const analyzer = {
  distanceFeet: () => 15,
  getSensingCapabilities: () => ({ precise: { vision: Infinity }, imprecise: { scent: 30 } }),
  getVisionCapabilities: () => ({ isDeafened: false }),
  isSoundBlocked: () => false,
};

function scentWall(blocksScent) {
  return {
    document: {
      c: [0, 100, 300, 100],
      door: 0,
      ds: 0,
      flags: { 'pf2e-visioner': { blocksScent } },
    },
  };
}

async function loadModule() {
  let mod;
  await jest.isolateModulesAsync(async () => {
    jest.doMock('../../../scripts/visibility/auto-visibility/VisionAnalyzer.js', () => ({
      VisionAnalyzer: { getInstance: () => analyzer },
    }));
    mod = await import('../../../scripts/services/during-move-soundwave.js');
  });
  return mod;
}

describe('during-move imprecise sense respects Blocks scent walls', () => {
  const observer = { center: { x: 50, y: 50 }, document: { elevation: 0 } };
  const target = { center: { x: 50, y: 150 }, document: { elevation: 0, flags: {} }, actor: { conditions: [] } };
  let savedCanvas;

  beforeEach(() => {
    savedCanvas = globalThis.canvas;
  });

  afterEach(() => {
    globalThis.canvas = savedCanvas;
  });

  test.each([
    { blocksScent: true, expected: false },
    { blocksScent: false, expected: true },
  ])('scent in range across wall: %j', async ({ blocksScent, expected }) => {
    globalThis.canvas = { ...savedCanvas, walls: { placeables: [scentWall(blocksScent)] } };
    const mod = await loadModule();
    expect(mod.impreciselySensedOutOfSight(observer, target)).toBe(expected);
  });
});
