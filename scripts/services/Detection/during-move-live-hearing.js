import { hasActivePendingTokenMovement } from '../movement-tracking.js';

export const LIVE_HEARING_RECHECK_INTERVAL_MS = 200;
export const LIVE_HEARING_PROBES_PER_FRAME = 12;

const results = new Map();
let probe = null;
let budgetFrame = null;
let probesThisFrame = 0;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function frameStamp() {
  const stamp = globalThis.canvas?.app?.ticker?.lastTime;
  return typeof stamp === 'number' ? stamp : null;
}

function pairKey(observer, target) {
  const observerId = observer?.document?.id ?? observer?.id ?? '';
  const targetId = target?.document?.id ?? target?.id ?? '';
  return `${observerId}:${targetId}`;
}

export function recheckOffsetForPair(observer, target) {
  const key = pairKey(observer, target);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % LIVE_HEARING_RECHECK_INTERVAL_MS;
}

function takeProbeBudget() {
  const frame = frameStamp();
  if (frame === null) return true;
  if (frame !== budgetFrame) {
    budgetFrame = frame;
    probesThisFrame = 0;
  }
  if (probesThisFrame >= LIVE_HEARING_PROBES_PER_FRAME) return false;
  probesThisFrame += 1;
  return true;
}

function runProbe(observer, target) {
  try {
    const verdict = probe(observer, target);
    return typeof verdict === 'boolean' ? verdict : null;
  } catch {
    return null;
  }
}

export function setLiveImpreciseSenseProbe(fn) {
  probe = typeof fn === 'function' ? fn : null;
  results.clear();
}

export function clearLiveImpreciseSenseCache() {
  results.clear();
}

export function liveImpreciseSenseDuringMove(observer, target) {
  if (!probe) return null;
  if (!hasActivePendingTokenMovement()) {
    results.clear();
    return null;
  }
  const key = pairKey(observer, target);
  const at = now();
  const hit = results.get(key);
  if (hit && at - hit.at < LIVE_HEARING_RECHECK_INTERVAL_MS) return hit.value;
  if (!takeProbeBudget()) return hit?.value ?? null;
  const value = runProbe(observer, target);
  results.set(key, { value, at: hit ? at : at - recheckOffsetForPair(observer, target) });
  return value;
}
