export function isSightBlockedBetweenCenters(observerToken, targetToken) {
  const origin = { x: observerToken.center.x, y: observerToken.center.y };
  const destination = { x: targetToken.center.x, y: targetToken.center.y };
  const backend = CONFIG.Canvas?.polygonBackends?.sight;
  if (typeof backend?.testCollision !== 'function') return false;
  return !!backend.testCollision(origin, destination, { type: 'sight', mode: 'any' });
}
