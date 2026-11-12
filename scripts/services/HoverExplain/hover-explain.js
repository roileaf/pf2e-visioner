import { MODULE_ID } from '../../constants.js';
import { createHoverExplain } from './hover-explain-controller.js';
import { canExplainTarget, explainHTML, pickExplainObservers } from './hover-explain-view.js';

export const HOVER_EXPLAIN_REFRESH_THROTTLE_MS = 500;

let controller = null;
let refreshTimer = null;
const hookIds = [];

function setting(key) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return false;
  }
}

function keyOverlayActive(tooltips) {
  return !!(tooltips?.isShowingFactorsOverlay || tooltips?.isShowingKeyTooltips || tooltips?.isShowingCoverOverlay);
}

export function hoverExplainEnabled(tooltips = null) {
  if (!setting('enableHoverTooltips') || !setting('hoverExplain')) return false;
  return !keyOverlayActive(tooltips);
}

function isPartyToken(token) {
  return !!token?.actor?.hasPlayerOwner && token.actor.type === 'character';
}

export function explainObserversFor(hovered, { isGM, tokens }) {
  const placeables = tokens?.placeables ?? [];
  return pickExplainObservers(hovered, {
    isGM,
    controlled: tokens?.controlled ?? [],
    owned: placeables.filter((t) => t.isOwner && t.actor),
    party: placeables.filter(isPartyToken),
  });
}

export function canvasToClient(point) {
  if (typeof canvas?.clientCoordinatesFromCanvas === 'function') return canvas.clientCoordinatesFromCanvas(point);
  return canvas?.stage?.worldTransform?.apply?.(point) ?? null;
}

async function factorsBetween(observerId, targetId) {
  const { Pf2eVisionerApi } = await import('../../api.js');
  return Pf2eVisionerApi.getVisibilityFactors(observerId, targetId);
}

function buildController(tooltips) {
  return createHoverExplain({
    document,
    enabled: () => hoverExplainEnabled(tooltips),
    canExplain: (token) =>
      canExplainTarget(token, { isGM: !!game.user?.isGM, playersAllowed: !!setting('playerHoverExplain') }),
    observersFor: (token) => explainObserversFor(token, { isGM: !!game.user?.isGM, tokens: canvas?.tokens }),
    getFactors: factorsBetween,
    render: (view) =>
      explainHTML(view, {
        localize: (key) => game.i18n.localize(key),
        format: (key, data) => game.i18n.format(key, data),
      }),
    toScreen: canvasToClient,
  });
}

function scheduleRefresh() {
  if (!controller || refreshTimer !== null) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    controller?.refresh();
  }, HOVER_EXPLAIN_REFRESH_THROTTLE_MS);
}

function on(hook, fn) {
  hookIds.push([hook, Hooks.on(hook, fn)]);
}

export function initializeHoverExplain(tooltips = null) {
  if (controller) return controller;
  controller = buildController(tooltips);
  on('hoverToken', (token, hovered) => controller?.hover(token, hovered));
  on('canvasPan', () => controller?.reposition());
  on('controlToken', scheduleRefresh);
  on('pf2e-visioner.visibilityMapUpdated', scheduleRefresh);
  on('canvasTearDown', () => controller?.hide());
  return controller;
}

export function cleanupHoverExplain() {
  for (const [hook, id] of hookIds.splice(0)) Hooks.off(hook, id);
  if (refreshTimer !== null) clearTimeout(refreshTimer);
  refreshTimer = null;
  controller?.destroy();
  controller = null;
}
