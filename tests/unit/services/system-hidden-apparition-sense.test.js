import '../../setup.js';

import {
  buildSystemHiddenIndicatorDecision,
  getSystemHiddenSenseContext,
  shouldEvaluateSystemHiddenIndicators,
} from '../../../scripts/services/system-hidden-token-highlights.js';
import { isPresenceOnlyIndicatorMode } from '../../../scripts/services/system-hidden-presence-only-suppression.js';
import { canApparitionSenseDetect } from '../../../scripts/visibility/apparition-sense.js';

function observerWithFeat(distance = 20) {
  return {
    center: { x: 0, y: 0 },
    document: { elevation: 0 },
    distanceTo: () => distance,
    actor: {
      itemTypes: { feat: [{ type: 'feat', system: { slug: 'apparition-sense' } }] },
      system: { perception: { senses: [] } },
    },
  };
}

function hiddenTarget(traits) {
  return {
    visible: false,
    center: { x: 100, y: 0 },
    document: { elevation: 0 },
    actor: { type: 'npc', system: { traits: { value: traits } } },
  };
}

function decide(observer, token) {
  return buildSystemHiddenIndicatorDecision({
    observer,
    token,
    getDetectionBetween: () => ({ sense: 'apparition-sense', isPrecise: false }),
    canApparitionSenseDetect,
    isSoundBlocked: () => false,
    isScentBlocked: () => false,
  });
}

describe('Apparition sense presence indicator', () => {
  test('sense context picks up the feat-granted sense', () => {
    const context = getSystemHiddenSenseContext(observerWithFeat());
    expect(context.observerHasApparitionSense).toBe(true);
    expect(context.apparitionSenseSense).toMatchObject({ type: 'apparition-sense', range: 30 });
    expect(shouldEvaluateSystemHiddenIndicators(context)).toBe(true);
  });

  test('observer without feat has no apparition sense', () => {
    const context = getSystemHiddenSenseContext({ actor: { system: { perception: { senses: [] } } } });
    expect(context.observerHasApparitionSense).toBe(false);
  });

  test('shows indicator for hidden undead within 30 ft', () => {
    const decision = decide(observerWithFeat(20), hiddenTarget(['undead']));
    expect(decision.shouldShowIndicator).toBe(true);
    expect(decision.shouldShowApparitionSenseIndicator).toBe(true);
    expect(decision.indicatorMode).toBe('apparition-sense');
  });

  test('no indicator beyond 30 ft', () => {
    const decision = decide(observerWithFeat(35), hiddenTarget(['spirit']));
    expect(decision.shouldShowApparitionSenseIndicator).toBe(false);
  });

  test('no indicator for living targets', () => {
    const decision = decide(observerWithFeat(20), hiddenTarget(['humanoid']));
    expect(decision.shouldShowApparitionSenseIndicator).toBe(false);
  });

  test('apparition sense is a presence-only indicator mode', () => {
    expect(isPresenceOnlyIndicatorMode('apparition-sense')).toBe(true);
  });
});
