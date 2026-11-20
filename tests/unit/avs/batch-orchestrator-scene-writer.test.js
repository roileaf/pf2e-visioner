import '../../setup.js';

import { BatchOrchestrator } from '../../../scripts/visibility/auto-visibility/core/BatchOrchestrator.js';

function designate(users) {
  return (condition) => {
    const qualifying = users.filter(condition);
    if (!qualifying.length) return null;
    return qualifying.reduce((best, user) =>
      (user.role - best.role || best.id.localeCompare(user.id)) > 0 ? user : best,
    );
  };
}

function gm(id, viewedScene) {
  return { id, viewedScene, role: 4, active: true, isGM: true };
}

function setUsers(current, users) {
  global.game.user = current;
  global.game.users = {
    activeGM: designate(users)((u) => u.active && u.isGM),
    getDesignatedUser: designate(users),
  };
}

function hiddenUpdateResult() {
  const [observer, target] = global.canvas.tokens.placeables;
  return {
    updates: [{ observer, target, visibility: 'hidden' }],
    breakdown: { visGlobalHits: 0, visGlobalMisses: 0, losGlobalHits: 0, losGlobalMisses: 0 },
    processedTokens: 1,
    precomputeStats: { observerUsed: 0, observerMiss: 0, targetUsed: 0, targetMiss: 0 },
  };
}

describe('BatchOrchestrator scene writer election', () => {
  const savedUser = global.game.user;
  const savedUsers = global.game.users;
  const savedScene = global.canvas.scene;
  let applied;
  let batchProcessor;
  let orchestrator;

  beforeEach(() => {
    applied = [];
    batchProcessor = {
      globalVisibilityCache: { clear: jest.fn() },
      globalLosCache: { clear: jest.fn() },
      process: jest.fn(async () => hiddenUpdateResult()),
    };
    orchestrator = new BatchOrchestrator({
      batchProcessor,
      telemetryReporter: { start: jest.fn(), stop: jest.fn() },
      exclusionManager: { isExcludedToken: jest.fn(() => false) },
      positionManager: { getUpdatedTokenDoc: jest.fn(() => null) },
      visibilityMapService: {
        setVisibilityBetween: (o, t, v) => applied.push([o?.document?.id, t?.document?.id, v]),
        getVisibilityMap: () => ({}),
        setVisibilityMap: async (token, visMap) => {
          for (const [targetId, state] of Object.entries(visMap)) {
            applied.push([token?.document?.id, targetId, state]);
          }
        },
      },
      moduleId: 'pf2e-visioner',
      nowProvider: () => 0,
    });
    const a = createMockToken({ id: 'A', x: 0, y: 0 });
    const b = createMockToken({ id: 'B', x: 100, y: 0 });
    global.canvas.tokens.placeables = [a, b];
    global.canvas.tokens.get = jest.fn(
      (id) => global.canvas.tokens.placeables.find((token) => token.document.id === id) ?? null,
    );
    global.canvas.perception = { update: jest.fn(async () => {}) };
    global.canvas.scene = { ...savedScene, id: 'sceneA', getFlag: () => undefined };
  });

  afterEach(() => {
    global.game.user = savedUser;
    global.game.users = savedUsers;
    global.canvas.scene = savedScene;
  });

  test('a GM alone on its scene writes even when another GM is the global active GM', async () => {
    const roi = gm('zRoi', 'sceneA');
    setUsers(roi, [gm('aAss', 'sceneB'), roi]);
    await orchestrator.processBatch(new Set(['A']));
    expect(applied).toEqual([['A', 'B', 'hidden']]);
  });

  test('a GM does not write for a scene another GM is the writer of', async () => {
    const second = gm('zzz', 'sceneA');
    setUsers(second, [gm('aaa', 'sceneA'), second]);
    await orchestrator.processBatch(new Set(['A']));
    expect(batchProcessor.process).not.toHaveBeenCalled();
    expect(applied).toEqual([]);
  });

  test('discards the result when the canvas switches scene mid-batch', async () => {
    const roi = gm('aaa', 'sceneA');
    setUsers(roi, [roi]);
    batchProcessor.process.mockImplementationOnce(async () => {
      global.canvas.scene = { ...global.canvas.scene, id: 'sceneB' };
      roi.viewedScene = 'sceneB';
      return hiddenUpdateResult();
    });
    await orchestrator.processBatch(new Set(['A']));
    expect(applied).toEqual([]);
  });

  test('discards the result when a higher-priority GM joins the scene mid-batch', async () => {
    const roi = gm('zzz', 'sceneA');
    const other = gm('aaa', 'sceneB');
    setUsers(roi, [roi, other]);
    batchProcessor.process.mockImplementationOnce(async () => {
      other.viewedScene = 'sceneA';
      return hiddenUpdateResult();
    });
    await orchestrator.processBatch(new Set(['A']));
    expect(applied).toEqual([]);
  });
});
