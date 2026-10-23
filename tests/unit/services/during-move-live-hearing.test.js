import { jest } from '@jest/globals';

const LIVE_PATH = '../../../scripts/services/Detection/during-move-live-hearing.js';
const CAN_DETECT_PATH = '../../../scripts/services/Detection/detection-can-detect.js';
const SOUNDWAVE_PATH = '../../../scripts/services/during-move-soundwave.js';

function token(id, flags = {}) {
  return { id, center: { x: 0, y: 0 }, document: { id, getFlag: jest.fn((_scope, key) => flags[key]) } };
}

describe('live imprecise sense during a committed move', () => {
  let pending;
  let live;

  beforeEach(async () => {
    pending = true;
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../../scripts/services/movement-tracking.js', () => ({
        hasActivePendingTokenMovement: jest.fn(() => pending),
      }));
      live = await import(LIVE_PATH);
    });
  });

  test('answers null until a sense probe is registered', () => {
    expect(live.liveImpreciseSenseDuringMove(token('o'), token('t'))).toBeNull();
  });

  test('answers null outside a committed move so stored states stay authoritative', () => {
    live.setLiveImpreciseSenseProbe(() => true);
    pending = false;
    expect(live.liveImpreciseSenseDuringMove(token('o'), token('t'))).toBeNull();
  });

  test('caps sense probes per render frame and falls back to the stored state beyond the budget', () => {
    const probe = jest.fn(() => true);
    live.setLiveImpreciseSenseProbe(probe);
    const previousCanvas = globalThis.canvas;
    globalThis.canvas = { app: { ticker: { lastTime: 1 } } };
    try {
      const answers = Array.from({ length: 50 }, (_, i) => live.liveImpreciseSenseDuringMove(token('o'), token(`t${i}`)));
      expect(probe).toHaveBeenCalledTimes(live.LIVE_HEARING_PROBES_PER_FRAME);
      expect(answers.filter((answer) => answer === null)).toHaveLength(50 - live.LIVE_HEARING_PROBES_PER_FRAME);

      globalThis.canvas.app.ticker.lastTime = 2;
      live.liveImpreciseSenseDuringMove(token('o'), token('t49'));
      expect(probe).toHaveBeenCalledTimes(live.LIVE_HEARING_PROBES_PER_FRAME + 1);
    } finally {
      globalThis.canvas = previousCanvas;
    }
  });

  test('spreads pair rechecks so they do not all expire on the same frame', () => {
    live.setLiveImpreciseSenseProbe(() => true);
    const offsets = new Set(Array.from({ length: 30 }, (_, i) => live.recheckOffsetForPair(token('o'), token(`t${i}`))));
    expect(offsets.size).toBeGreaterThan(10);
    for (const offset of offsets) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(live.LIVE_HEARING_RECHECK_INTERVAL_MS);
    }
  });

  test('probes each pair at most once per recheck interval', () => {
    const probe = jest.fn(() => true);
    live.setLiveImpreciseSenseProbe(probe);
    const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
    try {
      for (let i = 0; i < 20; i += 1) expect(live.liveImpreciseSenseDuringMove(token('o'), token('t'))).toBe(true);
      expect(probe).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1000 + live.LIVE_HEARING_RECHECK_INTERVAL_MS);
      live.liveImpreciseSenseDuringMove(token('o'), token('t'));
      expect(probe).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });
});

async function loadCanDetect({ visibility, liveSense }) {
  let wrapper;
  await jest.isolateModulesAsync(async () => {
    jest.doMock('../../../scripts/cover/ledge/ledge-vision.js', () => ({ isTokenSightBlockedByLedge: jest.fn(() => false) }));
    jest.doMock('../../../scripts/services/gm-vision-bypass.js', () => ({ shouldBypassAvsForGmVision: jest.fn(() => false) }));
    jest.doMock('../../../scripts/services/Detection/select-all-token-visibility-bypass.js', () => ({
      isSelectAllTokenVisibilityBypassActive: jest.fn(() => false),
    }));
    jest.doMock('../../../scripts/services/ExplicitVisibilityPairs.js', () => ({ isExplicitVisiblePair: jest.fn(() => false) }));
    jest.doMock('../../../scripts/services/movement-tracking.js', () => ({ hasActivePendingTokenMovement: jest.fn(() => true) }));
    jest.doMock('../../../scripts/services/Detection/detection-visibility-context.js', () => ({
      getVisionerVisibilityBetweenTokens: jest.fn(() => visibility),
      isAvsActiveGivenCombatGate: jest.fn(() => true),
      NON_VISUAL_DETECTION_MODE_IDS: new Set(['hearing', 'tremorsense']),
      reachesVisibilityThreshold: jest.fn(() => false),
      VISIBILITY_DETECTION_THRESHOLDS: { hidden: 'hidden', undetected: 'undetected' },
      detectionFrameCache: { getPerceptionProfile: () => null },
    }));
    jest.doMock('../../../scripts/stores/visibility-map.js', () => ({ AVS_EXPLICIT_VISIBLE_DETECTION_SENSE: 'avs-explicit' }));
    jest.doMock('../../../scripts/constants.js', () => ({ MODULE_ID: 'pf2e-visioner' }));
    const liveModule = await import(LIVE_PATH);
    if (liveSense !== undefined) liveModule.setLiveImpreciseSenseProbe(() => liveSense);
    wrapper = (await import(CAN_DETECT_PATH)).createCanDetectVisibilityWrapper('undetected');
  });
  return wrapper;
}

function hear(wrapper, observer, target, coreResult = false) {
  return wrapper.call({ id: 'hearing' }, jest.fn(() => coreResult), { object: observer }, target);
}

describe('core hearing during a committed move follows the live sense', () => {
  const npc = () => ({ ...token('target'), actor: { type: 'npc' } });

  test('a stored-Undetected target the observer can now hear is detected by hearing', async () => {
    const wrapper = await loadCanDetect({ visibility: 'undetected', liveSense: true });
    expect(hear(wrapper, token('observer'), npc())).toBe(true);
  });

  test('a stored-Undetected target still out of earshot stays undetected', async () => {
    const wrapper = await loadCanDetect({ visibility: 'undetected', liveSense: false });
    expect(hear(wrapper, token('observer'), npc())).toBe(false);
  });

  test('an Unnoticed target is not revealed by hearing mid-move', async () => {
    const wrapper = await loadCanDetect({ visibility: 'unnoticed', liveSense: true });
    expect(hear(wrapper, token('observer'), npc())).toBe(false);
  });

  test('a manual Undetected override is respected', async () => {
    const wrapper = await loadCanDetect({ visibility: 'undetected', liveSense: true });
    const target = { ...token('target', { 'avs-override-from-observer': { state: 'undetected' } }), actor: { type: 'npc' } };
    expect(hear(wrapper, token('observer'), target)).toBe(false);
  });

  test('a stored-Hidden target whose sound is now blocked stops being heard', async () => {
    const wrapper = await loadCanDetect({ visibility: 'hidden', liveSense: false });
    expect(hear(wrapper, token('observer'), npc(), true)).toBe(false);
  });

  test('a manual Hidden override keeps the target heard', async () => {
    const wrapper = await loadCanDetect({ visibility: 'hidden', liveSense: false });
    const target = { ...token('target', { 'avs-override-from-observer': { state: 'hidden' } }), actor: { type: 'npc' } };
    expect(hear(wrapper, token('observer'), target)).toBe(true);
  });

  test('without a live answer the stored Hidden state keeps the target heard', async () => {
    const wrapper = await loadCanDetect({ visibility: 'hidden' });
    expect(hear(wrapper, token('observer'), npc())).toBe(true);
  });
});

describe('during-move ring decision follows the live sense', () => {
  let soundwave;
  const outOfSight = { vision: { los: { contains: () => false } }, document: { id: 'observer', getFlag: () => undefined } };
  const target = { center: { x: 100, y: 100 }, document: { id: 'target', getFlag: () => undefined } };

  beforeEach(async () => {
    soundwave = await import(SOUNDWAVE_PATH);
  });

  test('a stored-Undetected target the observer can now hear gets a ring', () => {
    expect(soundwave.targetShouldShowSoundwave(target, [outOfSight], () => 'undetected', () => false, () => false, () => true)).toBe(true);
  });

  test('a stored-Undetected target still out of earshot gets no ring', () => {
    expect(soundwave.targetShouldShowSoundwave(target, [outOfSight], () => 'undetected', () => false, () => false, () => false)).toBe(false);
  });

  test('a stored-Hidden target whose sound is now blocked loses its ring', () => {
    expect(soundwave.targetShouldShowSoundwave(target, [outOfSight], () => 'hidden', () => false, () => false, () => false)).toBe(false);
  });

  test('a stored-Hidden target keeps its ring without a live answer', () => {
    expect(soundwave.targetShouldShowSoundwave(target, [outOfSight], () => 'hidden', () => false, () => false, () => null)).toBe(true);
  });
});
