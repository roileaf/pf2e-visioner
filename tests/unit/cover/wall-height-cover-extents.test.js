import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import '../../setup.js';

const GRID = 100;

function makeToken(id, { x, y, size = 'med', squares = 1, elevation = 0 }) {
  const half = (squares * GRID) / 2;
  return {
    id,
    document: { id, x, y, width: squares, height: squares, elevation },
    center: { x: x + half, y: y + half },
    getCenterPoint: () => ({ x: x + half, y: y + half }),
    actor: { system: { traits: { size: { value: size } } }, alliance: id },
  };
}

function makeWall({ bottom, top, coverOverride = null, y = 200 }) {
  const c = [-1000, y, 1000, y];
  return {
    coords: c,
    document: {
      sight: 1,
      door: 0,
      ds: 0,
      dir: 0,
      c,
      flags: { 'wall-height': { bottom, top } },
      getFlag: jest.fn((scope, key) => (key === 'coverOverride' ? coverOverride : null)),
    },
  };
}

function setupScene(walls, tokens) {
  global.canvas = {
    walls: { objects: { children: walls }, placeables: walls },
    tokens: { placeables: tokens },
    tiles: { placeables: [] },
    grid: { size: GRID },
    scene: { id: 'scene', grid: { distance: 5 } },
  };
}

describe('auto-cover compares wall height range with token vertical extents', () => {
  let detector;

  beforeEach(async () => {
    jest.resetModules();
    detector = (await import('../../../scripts/cover/auto-cover/CoverDetector.js')).default;
    global.game.modules = new Map([['wall-height', { active: true }]]);
    global.game.settings.get = jest.fn((module, key) => {
      if (key === 'autoCoverTokenIntersectionMode') return 'tactical';
      if (key === 'wallCoverStandardThreshold') return 50;
      if (key === 'wallCoverGreaterThreshold') return 70;
      if (key === 'wallCoverAllowGreater') return true;
      return false;
    });
  });

  const detect = (wall, attackerOpts, targetOpts) => {
    const attacker = makeToken('attacker', attackerOpts);
    const target = makeToken('target', targetOpts);
    setupScene([wall], [attacker, target]);
    return detector.detectBetweenTokens(attacker, target);
  };

  const behindWall = (wall, targetY, attackerOpts = { x: 0, y: 0 }, targetOpts = {}) =>
    detect(wall, attackerOpts, { x: 0, y: targetY, ...targetOpts });

  test.each([200, 300, 500])('3ft wall gives standard cover regardless of distance (target y=%i)', (y) => {
    expect(behindWall(makeWall({ bottom: 0, top: 3 }), y)).toBe('standard');
  });

  test.each([200, 300, 500])('full-height wall gives greater cover even when target hugs it (y=%i)', (y) => {
    expect(behindWall(makeWall({ bottom: 0, top: 10 }), y)).toBe('greater');
  });

  test.each([200, 300, 500])('1ft wall below sight lines gives no cover (y=%i)', (y) => {
    expect(behindWall(makeWall({ bottom: 0, top: 1 }), y)).toBe('none');
  });

  test('lesser-max wall ignores a gargantuan target far above its top', () => {
    const wall = makeWall({ bottom: 0, top: 1, coverOverride: 'lesser' });
    const target = { size: 'grg', squares: 4, elevation: 100 };
    expect(behindWall(wall, 200, { x: 0, y: 0 }, target)).toBe('none');
  });

  test('lesser-max wall still applies when it overlaps the sight lines', () => {
    expect(behindWall(makeWall({ bottom: 0, top: 3, coverOverride: 'lesser' }), 300)).toBe('lesser');
  });

  test('center-to-center line through a height wall gives at least standard cover', () => {
    const large = { size: 'lg', squares: 2 };
    const wall = makeWall({ bottom: 5, top: 8, y: 300 });
    expect(behindWall(wall, 400, { x: 0, y: 0, ...large }, large)).toBe('standard');
  });

  test('large attacker past a short wall sees over it to a distant target', () => {
    const attacker = { x: 0, y: 0, size: 'lg', squares: 2 };
    expect(behindWall(makeWall({ bottom: 0, top: 4 }), 200, attacker)).not.toBe('greater');
    expect(behindWall(makeWall({ bottom: 0, top: 4 }), 400, attacker)).toBe('none');
  });
});
