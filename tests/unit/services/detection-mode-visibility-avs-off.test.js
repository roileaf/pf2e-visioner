import { jest } from '@jest/globals';

const MODE_VISIBILITY_PATH = '../../../scripts/services/Detection/detection-mode-visibility.js';

async function loadWithAvsOff() {
  let testDetectionModeVisibility;
  await jest.isolateModulesAsync(async () => {
    jest.doMock('../../../scripts/services/gm-vision-bypass.js', () => ({
      shouldBypassAvsForGmVision: jest.fn(() => false),
    }));
    jest.doMock(
      '../../../scripts/services/Detection/select-all-token-visibility-bypass.js',
      () => ({
        isSelectAllTokenVisibilityBypassActive: jest.fn(() => false),
      }),
    );
    jest.doMock('../../../scripts/services/Detection/detection-visibility-context.js', () => ({
      getVisionerVisibilityBetweenTokens: jest.fn(() => 'observed'),
      isAvsActiveGivenCombatGate: jest.fn(() => false),
      NON_VISUAL_DETECTION_MODE_IDS: new Set(['hearing', 'feelTremor']),
    }));
    jest.doMock('../../../scripts/constants.js', () => ({
      MODULE_ID: 'pf2e-visioner',
    }));
    const mod = await import(MODE_VISIBILITY_PATH);
    testDetectionModeVisibility = mod.testDetectionModeVisibility;
  });
  return testDetectionModeVisibility;
}

function makeHearingMode(canDetect) {
  return {
    id: 'hearing',
    _canDetect: jest.fn(() => canDetect),
    _testPoint: jest.fn(() => true),
  };
}

function callMode(testDetectionModeVisibility, detectionMode) {
  const target = { document: { id: 'target', level: 'lvl', getFlag: jest.fn(() => null) } };
  return testDetectionModeVisibility.call(
    detectionMode,
    { object: { document: { id: 'observer' } } },
    { id: detectionMode.id, enabled: true },
    { object: target, tests: [{ point: { x: 0, y: 0 } }] },
  );
}

describe('detection-mode visibility with AVS off', () => {
  afterEach(() => {
    jest.resetModules();
  });

  test('dark room hearing: target that emits no sound stays undetected', async () => {
    const testDetectionModeVisibility = await loadWithAvsOff();
    const hearing = makeHearingMode(false);

    expect(callMode(testDetectionModeVisibility, hearing)).toBe(false);
    expect(hearing._canDetect).toHaveBeenCalled();
    expect(hearing._testPoint).not.toHaveBeenCalled();
  });

  test('system allows detection: falls through to the point test', async () => {
    const testDetectionModeVisibility = await loadWithAvsOff();
    const hearing = makeHearingMode(true);

    expect(callMode(testDetectionModeVisibility, hearing)).toBe(true);
    expect(hearing._canDetect).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'lvl');
    expect(hearing._testPoint).toHaveBeenCalled();
  });
});
