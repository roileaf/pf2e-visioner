export function isPrimaryGM() {
  if (!globalThis.game?.user?.isGM) return false;
  const activeGM = globalThis.game?.users?.activeGM;
  if (!activeGM) return true;
  return activeGM.id === globalThis.game.user.id;
}

function designatedSceneGM(sceneId) {
  const users = globalThis.game?.users;
  if (!sceneId || typeof users?.getDesignatedUser !== 'function') return null;
  return users.getDesignatedUser((user) => user.active && user.isGM && user.viewedScene === sceneId);
}

export function isScenePrimaryGM(sceneId) {
  if (!globalThis.game?.user?.isGM) return false;
  const designated = designatedSceneGM(sceneId);
  if (!designated) return isPrimaryGM();
  return designated.id === globalThis.game.user.id;
}

export function isCurrentSceneAvsWriter() {
  return isScenePrimaryGM(globalThis.canvas?.scene?.id);
}
