export function worldTimeNow() {
  return Number(game?.time?.worldTime) || 0;
}

export function usesGameTime(timer) {
  return Number.isFinite(timer?.expiresAtWorldTime);
}

export function gameTimeExpiry(minutes) {
  return worldTimeNow() + minutes * 60;
}

export function minuteTimerRemainingMs(timer, nowMs = Date.now()) {
  if (usesGameTime(timer)) return (timer.expiresAtWorldTime - worldTimeNow()) * 1000;
  if (!timer?.expiresAt) return null;
  return timer.expiresAt - nowMs;
}

export function isMinuteTimerActive(timer, nowMs = Date.now()) {
  const remaining = minuteTimerRemainingMs(timer, nowMs);
  return remaining !== null && remaining > 0;
}
