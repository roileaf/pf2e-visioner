import { peekRegistry } from './PeekRegistry.js';

const VISIBILITY_RANK = { unnoticed: 0, undetected: 1, hidden: 2, concealed: 3, observed: 4 };
const FLOOR_STATES = new Set(['observed', 'concealed']);

const baselines = new Map();

function sessionBaseline(observerId, readBaselineMap, registry) {
  const peek = registry.get(observerId);
  if (!peek) {
    baselines.delete(observerId);
    return null;
  }
  const cached = baselines.get(observerId);
  if (cached?.startedAt === peek.startedAt) return cached.map;
  const map = { ...(readBaselineMap?.() ?? {}) };
  baselines.set(observerId, { startedAt: peek.startedAt, map });
  return map;
}

function floorStateFor(observerId, targetId, readBaselineMap, registry) {
  if (!observerId || !targetId) return null;
  const map = sessionBaseline(observerId, readBaselineMap, registry);
  if (!map) return null;
  const state = map[targetId] ?? 'observed';
  return FLOOR_STATES.has(state) ? state : null;
}

export function applyPeekVisibilityFloor({
  observerId,
  targetId,
  computed,
  readBaselineMap,
  registry = peekRegistry,
}) {
  const floor = floorStateFor(observerId, targetId, readBaselineMap, registry);
  if (!floor || !computed) return computed;
  return (VISIBILITY_RANK[computed] ?? 0) < VISIBILITY_RANK[floor] ? floor : computed;
}

export function isPeekFloorVisible({ observerId, targetId, readBaselineMap, registry = peekRegistry }) {
  return floorStateFor(observerId, targetId, readBaselineMap, registry) !== null;
}

export function clearPeekVisibilityFloors() {
  baselines.clear();
}
