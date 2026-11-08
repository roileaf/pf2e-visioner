const REVEALABLE_ACTOR_TYPES = new Set(['loot', 'hazard']);
const REVEALING_STATES = new Set(['observed', 'concealed']);
const UNSEEN_STATES = new Set(['hidden', 'undetected', 'unnoticed']);

function tokenIdOf(token) {
  return token?.document?.id ?? token?.id ?? null;
}

function isRevealableFoundryHidden(target) {
  return (
    target?.document?.hidden === true &&
    REVEALABLE_ACTOR_TYPES.has(String(target?.actor?.type ?? '').toLowerCase())
  );
}

function isPlayerCharacterToken(token) {
  return token?.actor?.type === 'character' && !!token.actor.hasPlayerOwner;
}

function collectRevealsByTarget(tokenChanges) {
  const reveals = new Map();
  for (const change of tokenChanges) {
    const state = change?.overrideState || change?.newVisibility;
    const targetId = tokenIdOf(change?.target);
    if (!targetId || !REVEALING_STATES.has(state)) continue;
    if (!isRevealableFoundryHidden(change.target)) continue;
    if (!reveals.has(targetId)) reveals.set(targetId, { target: change.target, observerIds: new Set() });
    reveals.get(targetId).observerIds.add(tokenIdOf(change.observer));
  }
  return reveals;
}

async function keepOtherPlayersUnseen(target, observerIds, deps) {
  const targetId = tokenIdOf(target);
  for (const token of deps.getSceneTokens()) {
    const id = tokenIdOf(token);
    if (!id || id === targetId || observerIds.has(id) || !isPlayerCharacterToken(token)) continue;
    if (UNSEEN_STATES.has(deps.getVisibilityBetween(token, target))) continue;
    await deps.setVisibilityBetween(token, target, 'hidden', {
      direction: 'observer_to_target',
      skipEphemeralUpdate: true,
    });
  }
}

async function resolveDeps(deps) {
  if (deps.getSceneTokens && deps.getVisibilityBetween && deps.setVisibilityBetween) return deps;
  const visibilityMap = await import('../../../../stores/visibility-map.js');
  return {
    getSceneTokens: deps.getSceneTokens || (() => globalThis.canvas?.tokens?.placeables ?? []),
    getVisibilityBetween: deps.getVisibilityBetween || visibilityMap.getVisibilityBetween,
    setVisibilityBetween: deps.setVisibilityBetween || visibilityMap.setVisibilityBetween,
  };
}

export async function revealFoundryHiddenSeekTargets(tokenChanges, deps = {}) {
  const reveals = collectRevealsByTarget(tokenChanges);
  if (reveals.size === 0) return;
  const resolved = await resolveDeps(deps);
  for (const { target, observerIds } of reveals.values()) {
    try {
      await keepOtherPlayersUnseen(target, observerIds, resolved);
      await target.document.update({ hidden: false });
    } catch (error) {
      console.warn('PF2E Visioner | Failed to reveal Foundry-hidden Seek target:', error);
    }
  }
}
