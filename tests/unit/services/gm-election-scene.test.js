import '../../setup.js';

import { isCurrentSceneAvsWriter, isScenePrimaryGM } from '../../../scripts/services/gm-election.js';

function designate(users) {
  return (condition) => {
    const qualifying = users.filter(condition);
    if (!qualifying.length) return null;
    return qualifying.reduce((best, user) =>
      (user.role - best.role || best.id.localeCompare(user.id)) > 0 ? user : best,
    );
  };
}

function gm(id, viewedScene, { role = 4, active = true } = {}) {
  return { id, viewedScene, role, active, isGM: true };
}

function setUsers(current, users) {
  global.game.user = current;
  global.game.users = {
    activeGM: designate(users)((u) => u.active && u.isGM),
    getDesignatedUser: designate(users),
  };
}

describe('isScenePrimaryGM', () => {
  const savedUser = global.game.user;
  const savedUsers = global.game.users;
  const savedCanvas = global.canvas;

  afterEach(() => {
    global.game.user = savedUser;
    global.game.users = savedUsers;
    global.canvas = savedCanvas;
  });

  test('each GM writes for the scene it is viewing when GMs are on different scenes', () => {
    const roi = gm('bRoi', 'sceneA');
    const assistant = gm('aAss', 'sceneB');
    setUsers(roi, [roi, assistant]);
    expect(isScenePrimaryGM('sceneA')).toBe(true);
    expect(isScenePrimaryGM('sceneB')).toBe(false);
    setUsers(assistant, [roi, assistant]);
    expect(isScenePrimaryGM('sceneA')).toBe(false);
    expect(isScenePrimaryGM('sceneB')).toBe(true);
  });

  test('a GM on another scene does not take the writer role from the GM viewing the scene', () => {
    const lowId = gm('aAss', 'sceneB');
    const viewer = gm('zRoi', 'sceneA');
    setUsers(viewer, [lowId, viewer]);
    expect(isScenePrimaryGM('sceneA')).toBe(true);
  });

  test('two GMs on the same scene elect exactly one writer by role then id', () => {
    const first = gm('aaa', 'sceneA');
    const second = gm('bbb', 'sceneA');
    setUsers(first, [first, second]);
    expect(isScenePrimaryGM('sceneA')).toBe(true);
    setUsers(second, [first, second]);
    expect(isScenePrimaryGM('sceneA')).toBe(false);
  });

  test('a full GM outranks an assistant GM on the same scene', () => {
    const assistant = gm('aaa', 'sceneA', { role: 3 });
    const full = gm('zzz', 'sceneA', { role: 4 });
    setUsers(assistant, [assistant, full]);
    expect(isScenePrimaryGM('sceneA')).toBe(false);
    setUsers(full, [assistant, full]);
    expect(isScenePrimaryGM('sceneA')).toBe(true);
  });

  test('inactive GMs are ignored', () => {
    const gone = gm('aaa', 'sceneA', { active: false });
    const here = gm('bbb', 'sceneA');
    setUsers(here, [gone, here]);
    expect(isScenePrimaryGM('sceneA')).toBe(true);
  });

  test('falls back to the global active GM when no GM is viewing the scene yet', () => {
    const roi = gm('aaa', 'sceneB');
    const other = gm('bbb', 'sceneC');
    setUsers(roi, [roi, other]);
    expect(isScenePrimaryGM('sceneA')).toBe(true);
    setUsers(other, [roi, other]);
    expect(isScenePrimaryGM('sceneA')).toBe(false);
  });

  test('false for players', () => {
    const player = { id: 'p1', viewedScene: 'sceneA', role: 1, active: true, isGM: false };
    setUsers(player, [player]);
    expect(isScenePrimaryGM('sceneA')).toBe(false);
  });

  test('falls back to global election without a scene id or designation API', () => {
    const roi = gm('aaa', 'sceneA');
    setUsers(roi, [roi]);
    expect(isScenePrimaryGM(undefined)).toBe(true);
    global.game.users = { activeGM: { id: 'other' } };
    expect(isScenePrimaryGM('sceneA')).toBe(false);
  });

  test('isCurrentSceneAvsWriter uses the canvas scene', () => {
    const roi = gm('bRoi', 'sceneA');
    const assistant = gm('aAss', 'sceneB');
    setUsers(roi, [roi, assistant]);
    global.canvas = { scene: { id: 'sceneA' } };
    expect(isCurrentSceneAvsWriter()).toBe(true);
    global.canvas = { scene: { id: 'sceneB' } };
    expect(isCurrentSceneAvsWriter()).toBe(false);
  });
});
