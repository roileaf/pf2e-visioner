const rememberedStates = new Map();

function tokenId(token) {
  return token?.document?.id ?? token?.id ?? null;
}

export function getRememberedInvisiblePreviousState(targetId, observerId) {
  return rememberedStates.get(targetId)?.get(observerId) ?? null;
}

function rememberInvisiblePreviousState(targetId, observerId, state) {
  if (!targetId || !observerId || !state) return;
  if (!rememberedStates.has(targetId)) rememberedStates.set(targetId, new Map());
  const states = rememberedStates.get(targetId);
  if (!states.has(observerId)) states.set(observerId, state);
}

export function forgetInvisiblePreviousStates(targetId) {
  rememberedStates.delete(targetId);
}

function readCachedState(observer, targetId, visibilityMapCache) {
  if (!visibilityMapCache) return null;
  try {
    return visibilityMapCache.getMap(observer)?.[targetId] || 'observed';
  } catch {
    return null;
  }
}

export function resolveInvisiblePreviousState(observer, target, visibilityMapCache) {
  const observerId = tokenId(observer);
  const targetId = tokenId(target);
  const fromFlags = target?.document?.flags?.['pf2e-visioner']?.invisibility?.[observerId]?.previousState;
  if (fromFlags) return fromFlags;

  const remembered = getRememberedInvisiblePreviousState(targetId, observerId);
  if (remembered) return remembered;

  const cached = readCachedState(observer, targetId, visibilityMapCache);
  rememberInvisiblePreviousState(targetId, observerId, cached);
  return cached;
}
