import { beforeEach, describe, expect, test } from '@jest/globals';
import { getWallsVerticalBlockedFraction } from '../../../scripts/helpers/wall-height-utils.js';

const wall = (bottom, top) => ({ flags: { 'wall-height': { bottom, top } } });
const medium = { bottom: 0, top: 5 };

describe('getWallsVerticalBlockedFraction', () => {
  beforeEach(() => {
    global.game = { modules: new Map([['wall-height', { active: true }]]) };
    global.window = {};
  });

  test('returns 0 without hits', () => {
    expect(getWallsVerticalBlockedFraction([], medium, medium)).toBe(0);
  });

  test('treats walls without height bounds as fully blocking', () => {
    global.game.modules.set('wall-height', { active: false });
    expect(getWallsVerticalBlockedFraction([{ wallDocument: wall(0, 1), t: 0.5 }], medium, medium)).toBe(1);
  });

  test('wall right in front of target hides its own height share', () => {
    const fraction = getWallsVerticalBlockedFraction([{ wallDocument: wall(0, 3), t: 1 }], medium, medium);
    expect(fraction).toBeCloseTo(0.6);
  });

  test('wall entirely below a high target hides nothing', () => {
    const target = { bottom: 100, top: 120 };
    expect(getWallsVerticalBlockedFraction([{ wallDocument: wall(0, 1), t: 0.5 }], medium, target)).toBe(0);
  });

  test('wall entirely above both creatures hides nothing', () => {
    expect(getWallsVerticalBlockedFraction([{ wallDocument: wall(20, 30), t: 0.5 }], medium, medium)).toBe(0);
  });

  test('stacked walls merge their hidden ranges', () => {
    const hits = [
      { wallDocument: wall(0, 3), t: 1 },
      { wallDocument: wall(3, 10), t: 1 },
    ];
    expect(getWallsVerticalBlockedFraction(hits, medium, medium)).toBeCloseTo(1);
  });
});
