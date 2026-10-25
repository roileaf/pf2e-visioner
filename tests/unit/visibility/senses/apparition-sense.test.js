/**
 * @jest-environment jsdom
 */

import { SenseType, SPECIAL_SENSES } from '../../../../scripts/constants.js';
import {
  APPARITION_SENSE,
  APPARITION_SENSE_RANGE,
  canApparitionSenseDetect,
  getApparitionSenseFromFeats,
  hasApparitionSenseFeat,
} from '../../../../scripts/visibility/apparition-sense.js';
import {
  calculateVisibility,
  _internal,
} from '../../../../scripts/visibility/StatelessVisibilityCalculator.js';
import { VisionAnalyzer } from '../../../../scripts/visibility/auto-visibility/VisionAnalyzer.js';
import { SeekDialogAdapter } from '../../../../scripts/visibility/auto-visibility/SeekDialogAdapter.js';

global.canvas = {
  grid: { size: 100 },
  scene: { grid: { distance: 5 } },
};

global.game = {
  settings: {
    get: jest.fn(() => false),
  },
  i18n: { localize: (key) => key },
};

function actorWithFeats(slugs) {
  return {
    itemTypes: { feat: slugs.map((slug) => ({ type: 'feat', system: { slug } })) },
    system: { perception: { senses: [] } },
  };
}

function buildInput({
  precise = {},
  imprecise = {},
  target = {},
  conditions = {},
  hasLineOfSight = true,
  soundBlocked = false,
} = {}) {
  return {
    target: {
      lightingLevel: 'bright',
      concealment: false,
      auxiliary: ['invisible'],
      traits: ['undead'],
      movementAction: 0,
      ...target,
    },
    observer: {
      precise: { vision: { range: Infinity }, ...precise },
      imprecise: { ...imprecise },
      conditions: { blinded: false, deafened: false, dazzled: false, ...conditions },
    },
    hasLineOfSight,
    soundBlocked,
    rayDarkness: null,
  };
}

const apparition = { [APPARITION_SENSE]: { range: 30 } };

describe('Apparition Sense', () => {
  describe('constants', () => {
    test('sense type and range', () => {
      expect(APPARITION_SENSE).toBe('apparition-sense');
      expect(SenseType.APPARITION_SENSE).toBe('apparition-sense');
      expect(APPARITION_SENSE_RANGE).toBe(30);
    });

    test('special sense config is imprecise 30 ft with i18n keys', () => {
      const config = SPECIAL_SENSES['apparition-sense'];
      expect(config.type).toBe('imprecise');
      expect(config.defaultRange).toBe(30);
      expect(config.detectsUndead).toBe(true);
      expect(config.detectsConstructs).toBe(false);
      expect(config.label).toBe('PF2E_VISIONER.SPECIAL_SENSES.apparition_sense');
      expect(config.description).toBe('PF2E_VISIONER.SPECIAL_SENSES.apparition_sense_description');
    });
  });

  describe('feat detection', () => {
    test('detects the Apparition Sense feat by slug', () => {
      expect(hasApparitionSenseFeat(actorWithFeats(['apparition-sense']))).toBe(true);
    });

    test('ignores actors without the feat', () => {
      expect(hasApparitionSenseFeat(actorWithFeats(['lifesense', 'spirit-walk']))).toBe(false);
      expect(hasApparitionSenseFeat(null)).toBe(false);
    });

    test('falls back to actor items when itemTypes is missing', () => {
      const actor = { items: [{ type: 'feat', system: { slug: 'apparition-sense' } }] };
      expect(hasApparitionSenseFeat(actor)).toBe(true);
    });

    test('builds an imprecise 30 ft sense entry from the feat', () => {
      expect(getApparitionSenseFromFeats(actorWithFeats(['apparition-sense']))).toEqual({
        type: 'apparition-sense',
        acuity: 'imprecise',
        range: 30,
      });
      expect(getApparitionSenseFromFeats(actorWithFeats([]))).toBeNull();
    });
  });

  describe('target filtering', () => {
    test.each([['spirit'], ['undead'], ['haunt'], ['incorporeal', 'spirit']])(
      'detects targets with %s trait',
      (...traits) => {
        expect(canApparitionSenseDetect({ traits })).toBe(true);
      },
    );

    test.each([[[]], [['humanoid']], [['construct']], [['animal', 'beast']]])(
      'ignores targets with traits %j',
      (traits) => {
        expect(canApparitionSenseDetect({ traits })).toBe(false);
      },
    );

    test('handles missing traits', () => {
      expect(canApparitionSenseDetect({})).toBe(false);
      expect(canApparitionSenseDetect(null)).toBe(false);
    });

    test('is case insensitive', () => {
      expect(canApparitionSenseDetect({ traits: ['Undead'] })).toBe(true);
    });
  });

  describe('visibility calculation', () => {
    test('invisible undead in range is hidden, never observed', () => {
      const result = calculateVisibility(buildInput({ imprecise: apparition }));
      expect(result.state).toBe('hidden');
      expect(result.detection).toEqual({ isPrecise: false, sense: 'apparition-sense' });
    });

    test('invisible spirit is hidden', () => {
      const result = calculateVisibility(
        buildInput({ imprecise: apparition, target: { traits: ['spirit'] } }),
      );
      expect(result.state).toBe('hidden');
      expect(result.detection.sense).toBe('apparition-sense');
    });

    test('invisible living creature stays undetected', () => {
      const result = calculateVisibility(
        buildInput({ imprecise: apparition, target: { traits: ['humanoid'] } }),
      );
      expect(result.state).toBe('undetected');
      expect(result.detection).toBeNull();
    });

    test('does not detect through sight-blocking walls', () => {
      const result = calculateVisibility(buildInput({ imprecise: apparition, hasLineOfSight: false }));
      expect(result.state).toBe('undetected');
    });

    test('does not detect when sound is blocked', () => {
      const result = calculateVisibility(buildInput({ imprecise: apparition, soundBlocked: true }));
      expect(result.state).toBe('undetected');
    });

    test('detects undead while the observer is deafened', () => {
      const result = calculateVisibility(
        buildInput({ imprecise: apparition, conditions: { deafened: true } }),
      );
      expect(result.state).toBe('hidden');
      expect(result.detection.sense).toBe('apparition-sense');
    });

    test('blinded observer detects undead as hidden', () => {
      const result = calculateVisibility(
        buildInput({ precise: {}, imprecise: apparition, conditions: { blinded: true } }),
      );
      expect(result.state).toBe('hidden');
      expect(result.detection.sense).toBe('apparition-sense');
    });

    test('undead hidden in darkness is hidden for a deafened observer', () => {
      const result = calculateVisibility(
        buildInput({
          imprecise: apparition,
          target: { auxiliary: [], lightingLevel: 'darkness' },
          conditions: { deafened: true },
        }),
      );
      expect(result.state).toBe('hidden');
      expect(result.detection).toEqual({ isPrecise: false, sense: 'apparition-sense' });
    });

    test('living creature hidden in darkness stays undetected for a deafened observer', () => {
      const result = calculateVisibility(
        buildInput({
          imprecise: apparition,
          target: { auxiliary: [], lightingLevel: 'darkness', traits: ['humanoid'] },
          conditions: { deafened: true },
        }),
      );
      expect(result.state).toBe('undetected');
    });

    test('concealed undead is not downgraded by apparition sense', () => {
      const result = calculateVisibility(
        buildInput({ imprecise: apparition, target: { auxiliary: [], concealment: true } }),
      );
      expect(result.state).toBe('concealed');
      expect(result.detection.sense).toBe('vision');
    });

    test('visible undead stays observed by vision', () => {
      const result = calculateVisibility(
        buildInput({ imprecise: apparition, target: { auxiliary: [] } }),
      );
      expect(result.state).toBe('observed');
      expect(result.detection.sense).toBe('vision');
    });

    test('exports reach helper that mirrors lifesense gates', () => {
      const target = { traits: ['undead'] };
      expect(_internal.canApparitionSenseReachTarget(target, {})).toBe(true);
      expect(_internal.canApparitionSenseReachTarget(target, { hasLineOfSight: false })).toBe(false);
      expect(_internal.canApparitionSenseReachTarget(target, { soundBlocked: true })).toBe(false);
      expect(_internal.canApparitionSenseReachTarget({ traits: ['humanoid'] }, {})).toBe(false);
    });
  });

  describe('seek sense limitations', () => {
    function targetWithTraits(traits) {
      return { actor: { type: 'npc', system: { traits: { value: traits } } } };
    }

    test('valid against spirits, undead and haunts', async () => {
      const adapter = new SeekDialogAdapter(new VisionAnalyzer());
      for (const trait of ['spirit', 'undead', 'haunt']) {
        const result = await adapter.checkSenseLimitations(targetWithTraits([trait]), 'apparition-sense');
        expect(result.valid).toBe(true);
      }
    });

    test('invalid against living creatures', async () => {
      const adapter = new SeekDialogAdapter(new VisionAnalyzer());
      const result = await adapter.checkSenseLimitations(targetWithTraits(['humanoid']), 'apparition-sense');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('PF2E_VISIONER.SPECIAL_SENSES.apparition_sense_limitation');
    });

    test('special sense check matches the target filter', async () => {
      const analyzer = new VisionAnalyzer();
      await expect(
        analyzer.canDetectWithSpecialSense(targetWithTraits(['spirit']), 'apparition-sense'),
      ).resolves.toBe(true);
      await expect(
        analyzer.canDetectWithSpecialSense(targetWithTraits(['humanoid']), 'apparition-sense'),
      ).resolves.toBe(false);
    });
  });

  describe('VisionAnalyzer capabilities', () => {
    function observerToken(id, feats) {
      return {
        id,
        center: { x: 0, y: 0 },
        document: { elevation: 0, detectionModes: [] },
        actor: actorWithFeats(feats),
      };
    }

    test('feat grants imprecise apparition sense at 30 ft', () => {
      const analyzer = new VisionAnalyzer();
      analyzer.clearVisionCache();
      const caps = analyzer.getVisionCapabilities(observerToken(`app-${Date.now()}`, ['apparition-sense']));
      expect(caps.imprecise['apparition-sense']).toBe(30);
      expect(caps.sensingSummary.imprecise).toContainEqual({ type: 'apparition-sense', range: 30 });
    });

    test('no feat means no apparition sense', () => {
      const analyzer = new VisionAnalyzer();
      analyzer.clearVisionCache();
      const caps = analyzer.getVisionCapabilities(observerToken(`noapp-${Date.now()}`, []));
      expect(caps.imprecise['apparition-sense']).toBeUndefined();
    });
  });
});
