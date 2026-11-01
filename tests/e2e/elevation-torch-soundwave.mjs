import { sampleTokenRender } from './during-move-harness.mjs';

const MODULE_ID = 'pf2e-visioner';
const VISIBLE_STATES = new Set(['observed', 'concealed']);
const TORCH_LIGHT = {
  bright: 20,
  dim: 40,
  color: '#ff9b40',
  alpha: 0.4,
  animation: { type: 'torch', speed: 5, intensity: 5 },
};
const DEFAULT_ELEVATIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 60, 0, 75, 0];
const TARGET_OFFSETS_SQUARES = [
  [1, 0],
  [2, 1],
  [0, 3],
  [5, 0],
  [4, 4],
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storedVisibility(observerId, targetId) {
  try {
    return game.modules.get(MODULE_ID)?.api?.getVisibility?.(observerId, targetId) ?? 'observed';
  } catch {
    return 'observed';
  }
}

function pickActor(type, preferredId) {
  if (preferredId) return game.actors.get(preferredId) ?? null;
  return game.actors.find((a) => a.type === type) ?? null;
}

function darkSceneData(gridSize) {
  return {
    name: 'Visioner E2E - Elevation Torch',
    width: gridSize * 20,
    height: gridSize * 20,
    padding: 0,
    grid: { size: gridSize, distance: 5, units: 'ft' },
    tokenVision: true,
    environment: { darknessLevel: 1, globalLight: { enabled: false } },
  };
}

async function tokenDataFor(actor, x, y, extra = {}) {
  const proto = await actor.getTokenDocument({ x, y, elevation: 0, hidden: false, ...extra });
  return proto.toObject();
}

async function createFixture({ observerActorId, targetActorIds, gridSize }) {
  const observerActor = pickActor('character', observerActorId);
  if (!observerActor) throw new Error('no character actor for observer');
  const scene = await game.scenes.documentClass.create(darkSceneData(gridSize));
  const origin = { x: gridSize * 8, y: gridSize * 8 };
  const observerData = await tokenDataFor(observerActor, origin.x, origin.y, {
    light: TORCH_LIGHT,
    sight: { enabled: true },
  });
  const targetData = await buildTargets({ targetActorIds, origin, gridSize });
  const created = await scene.createEmbeddedDocuments('Token', [observerData, ...targetData]);
  return { scene, observerId: created[0].id, targetIds: created.slice(1).map((t) => t.id) };
}

async function buildTargets({ targetActorIds, origin, gridSize }) {
  const npcs = targetActorIds?.length
    ? targetActorIds.map((id) => game.actors.get(id)).filter(Boolean)
    : game.actors.filter((a) => a.type === 'npc').slice(0, TARGET_OFFSETS_SQUARES.length);
  if (!npcs.length) throw new Error('no npc actors for targets');
  const result = [];
  for (const [i, [dx, dy]] of TARGET_OFFSETS_SQUARES.entries()) {
    const actor = npcs[i % npcs.length];
    const x = origin.x + dx * gridSize;
    const y = origin.y + dy * gridSize;
    result.push(await tokenDataFor(actor, x, y, { actorLink: false }));
  }
  return result;
}

async function waitForCanvasScene(sceneId, timeoutMs = 20000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (canvas?.ready && canvas.scene?.id === sceneId && canvas.tokens?.placeables?.length) return;
    await sleep(100);
  }
  throw new Error('temp scene did not load on canvas');
}

function sampleTargets(observerId, targetIds, ms, elevation) {
  return targetIds.map((id) => ({
    id,
    ms,
    elevation,
    state: storedVisibility(observerId, id),
    render: sampleTokenRender(canvas.tokens.get(id)),
  }));
}

function sampleWhile(observerId, targetIds, durationMs, elevationOf) {
  return new Promise((resolve) => {
    const samples = [];
    const t0 = performance.now();
    const tick = () => {
      const ms = Math.round(performance.now() - t0);
      samples.push(...sampleTargets(observerId, targetIds, ms, elevationOf()));
      if (ms < durationMs) return;
      canvas.app.ticker.remove(tick);
      resolve(samples);
    };
    canvas.app.ticker.add(tick);
  });
}

function isRenderFlash(sample) {
  return sample.render !== 'visible';
}

function isStateBlip(sample) {
  return !VISIBLE_STATES.has(sample.state);
}

function groupByTarget(samples, field) {
  const byTarget = {};
  for (const s of samples) {
    const entry = (byTarget[s.id] ??= {
      name: canvas.tokens.get(s.id)?.name,
      count: 0,
      values: new Set(),
      firstMs: s.ms,
      lastMs: s.ms,
      elevations: [],
    });
    entry.count += 1;
    entry.values.add(s[field]);
    entry.lastMs = s.ms;
    if (entry.elevations.length < 5) entry.elevations.push(Math.round(s.elevation));
  }
  for (const entry of Object.values(byTarget)) entry.values = [...entry.values];
  return byTarget;
}

function summarizeStep({ from, to, samples, targetCount }) {
  const renderFlashes = samples.filter(isRenderFlash);
  const stateBlips = samples.filter(isStateBlip);
  return {
    from: Math.round(from),
    to,
    frames: Math.round(samples.length / Math.max(targetCount, 1)),
    flashCount: renderFlashes.length,
    stateBlipCount: stateBlips.length,
    flashesByTarget: groupByTarget(renderFlashes, 'render'),
    stateBlipsByTarget: groupByTarget(stateBlips, 'state'),
  };
}

function isSettledMismatch({ state, render }) {
  return VISIBLE_STATES.has(state) !== (render === 'visible');
}

function settledMismatches(observerId, targetIds) {
  return Object.values(settledStates(observerId, targetIds)).filter(isSettledMismatch);
}

async function runElevationStep({ observer, targetIds, to, stepSampleMs, stepSettleMs }) {
  const from = observer.document.elevation;
  const update = observer.document.update({ elevation: to });
  const samples = await sampleWhile(
    observer.document.id,
    targetIds,
    stepSampleMs,
    () => observer.document.elevation,
  );
  await update.catch(() => undefined);
  await sleep(stepSettleMs);
  const mismatches = settledMismatches(observer.document.id, targetIds);
  return { ...summarizeStep({ from, to, samples, targetCount: targetIds.length }), mismatches };
}

function settledStates(observerId, targetIds) {
  return Object.fromEntries(
    targetIds.map((id) => [
      id,
      {
        name: canvas.tokens.get(id)?.name,
        state: storedVisibility(observerId, id),
        render: sampleTokenRender(canvas.tokens.get(id)),
      },
    ]),
  );
}

async function cleanupFixture(scene, previousScene, keepScene) {
  if (previousScene && previousScene.id !== scene.id) await previousScene.view();
  if (!keepScene) await scene.delete();
}

function assertActiveGm() {
  if (game.users.activeGM?.id === game.user.id) return null;
  return `run from the active GM client (${game.users.activeGM?.name ?? 'none'}); only it writes AVS state`;
}

async function runSteps({ observer, targetIds, elevations, stepSampleMs, stepSettleMs }) {
  const steps = [];
  for (const to of elevations) {
    steps.push(await runElevationStep({ observer, targetIds, to, stepSampleMs, stepSettleMs }));
  }
  return steps;
}

function visibleTargetIds(observerId, candidateIds) {
  return candidateIds.filter((id) => {
    const token = canvas.tokens.get(id);
    return VISIBLE_STATES.has(storedVisibility(observerId, id)) && sampleTokenRender(token) === 'visible';
  });
}

function totals(steps) {
  return {
    totalFlashes: steps.reduce((n, s) => n + s.flashCount, 0),
    totalStateBlips: steps.reduce((n, s) => n + s.stateBlipCount, 0),
    totalMismatches: steps.reduce((n, s) => n + s.mismatches.length, 0),
  };
}

async function runAgainstObserver({
  observerId,
  targetIds,
  elevations,
  settleMs,
  stepSampleMs,
  stepSettleMs,
}) {
  const observer = canvas.tokens.get(observerId);
  observer.control({ releaseOthers: true });
  await sleep(800);
  const watched = visibleTargetIds(observerId, targetIds);
  const baseline = settledStates(observerId, targetIds);
  const steps = await runSteps({ observer, targetIds: watched, elevations, stepSampleMs, stepSettleMs });
  await sleep(settleMs);
  const final = settledStates(observerId, targetIds);
  const { totalFlashes, totalStateBlips, totalMismatches } = totals(steps);
  const pass = totalMismatches === 0 && !settledMismatches(observerId, targetIds).length;
  return { pass, totalMismatches, totalFlashes, totalStateBlips, watched, baseline, final, steps };
}

export async function runElevationTorchSoundwaveTest({
  elevations = DEFAULT_ELEVATIONS,
  observerActorId = null,
  targetActorIds = null,
  gridSize = 100,
  settleMs = 3000,
  stepSampleMs = 2000,
  stepSettleMs = 2500,
  keepScene = false,
} = {}) {
  const gmError = assertActiveGm();
  if (gmError) return { pass: false, error: gmError };
  const previousScene = canvas.scene;
  const { scene, observerId, targetIds } = await createFixture({
    observerActorId,
    targetActorIds,
    gridSize,
  });
  try {
    await scene.view();
    await waitForCanvasScene(scene.id);
    await sleep(settleMs);
    return await runAgainstObserver({
      observerId,
      targetIds,
      elevations,
      settleMs,
      stepSampleMs,
      stepSettleMs,
    });
  } finally {
    await cleanupFixture(scene, previousScene, keepScene);
  }
}

function candidateTargetIds(observerTokenId) {
  return canvas.tokens.placeables
    .filter((t) => t.actor && t.id !== observerTokenId && !t.document.hidden)
    .map((t) => t.id);
}

export async function runElevationSoundwaveOnCurrentScene({
  observerTokenId,
  targetIds = null,
  elevations = DEFAULT_ELEVATIONS,
  settleMs = 3000,
  stepSampleMs = 2000,
  stepSettleMs = 2500,
} = {}) {
  const gmError = assertActiveGm();
  if (gmError) return { pass: false, error: gmError };
  const observer = canvas.tokens.get(observerTokenId);
  if (!observer) return { pass: false, error: `observer token ${observerTokenId} not on canvas` };
  const originalElevation = observer.document.elevation;
  const candidates = targetIds ?? candidateTargetIds(observerTokenId);
  try {
    return await runAgainstObserver({
      observerId: observerTokenId,
      targetIds: candidates,
      elevations,
      settleMs,
      stepSampleMs,
      stepSettleMs,
    });
  } finally {
    await observer.document.update({ elevation: originalElevation }, { animate: false });
  }
}
