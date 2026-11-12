const MODULE_ID = 'pf2e-visioner';
const TAG = 'Visioner E2E - Symmetry';

const LIGHTING_CASES = [
  { key: 'dark75-gi-on', darknessLevel: 0.75, globalLight: { enabled: true, darkness: { max: 1 } } },
  { key: 'dark75-gi-off', darknessLevel: 0.75, globalLight: { enabled: false } },
  { key: 'bright', darknessLevel: 0, globalLight: { enabled: true, darkness: { max: 1 } } },
];

const PAIRS = [
  ['pcA', 'npcA'],
  ['pcA', 'pcB'],
  ['npcA', 'npcB'],
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function api() {
  return game.modules.get(MODULE_ID)?.api;
}

function storedVisibility(observerId, targetId) {
  try {
    return api()?.getVisibility?.(observerId, targetId) ?? null;
  } catch {
    return null;
  }
}

async function directVisibility(observer, target) {
  try {
    return await api()?.autoVisibility?.calculateVisibility?.(observer, target);
  } catch (error) {
    return `error: ${error?.message ?? error}`;
  }
}

async function createBlankActors() {
  const data = [
    { name: `${TAG} pcA`, type: 'character' },
    { name: `${TAG} pcB`, type: 'character' },
    { name: `${TAG} npcA`, type: 'npc' },
    { name: `${TAG} npcB`, type: 'npc' },
  ];
  const actors = await game.actors.documentClass.createDocuments(data);
  return Object.fromEntries(actors.map((a) => [a.name.replace(`${TAG} `, ''), a]));
}

function sceneData(gridSize, lighting) {
  return {
    name: `${TAG} ${lighting.key}`,
    width: gridSize * 16,
    height: gridSize * 16,
    padding: 0,
    grid: { size: gridSize, distance: 5, units: 'ft' },
    tokenVision: true,
    environment: { darknessLevel: lighting.darknessLevel, globalLight: lighting.globalLight },
  };
}

const POSITIONS = { pcA: [4, 4], pcB: [10, 4], npcA: [4, 10], npcB: [10, 10] };

async function tokenData(actor, [col, row], gridSize) {
  const doc = await actor.getTokenDocument({ x: col * gridSize, y: row * gridSize, hidden: false });
  return doc.toObject();
}

async function createScene(actors, gridSize, lighting) {
  const scene = await game.scenes.documentClass.create(sceneData(gridSize, lighting));
  const keys = Object.keys(POSITIONS);
  const data = [];
  for (const key of keys) data.push(await tokenData(actors[key], POSITIONS[key], gridSize));
  const created = await scene.createEmbeddedDocuments('Token', data);
  const tokenIds = Object.fromEntries(keys.map((key, i) => [key, created[i].id]));
  return { scene, tokenIds };
}

async function waitForCanvasScene(sceneId, timeoutMs = 20000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (canvas?.ready && canvas.scene?.id === sceneId && canvas.tokens?.placeables?.length) return;
    await sleep(100);
  }
  throw new Error('temp scene did not load on canvas');
}

function visionSummary(token) {
  const doc = token.document;
  const actor = token.actor;
  return {
    name: token.name,
    actorType: actor?.type,
    sight: { enabled: doc.sight?.enabled, range: doc.sight?.range, visionMode: doc.sight?.visionMode },
    detectionModes: Object.entries(doc.detectionModes ?? {}).map(
      ([id, m]) => `${m?.id ?? id}:${m?.range}:${m?.enabled}`,
    ),
    perceptionVision: actor?.system?.perception?.vision,
    systemSenses: actor?.system?.perception?.senses,
    preparedSenses: actor?.perception?.senses?.map?.((s) => `${s.type}:${s.acuity}:${s.range}`) ?? null,
  };
}

async function directionResult(observerKey, targetKey, tokenIds) {
  const observer = canvas.tokens.get(tokenIds[observerKey]);
  const target = canvas.tokens.get(tokenIds[targetKey]);
  return {
    stored: storedVisibility(observer.id, target.id),
    direct: await directVisibility(observer, target),
    factors: await api()?.getVisibilityFactors?.(observer.id, target.id),
  };
}

async function pairResult([a, b], tokenIds) {
  const forward = await directionResult(a, b, tokenIds);
  const backward = await directionResult(b, a, tokenIds);
  const symmetric = forward.direct === backward.direct;
  return { pair: `${a}<->${b}`, symmetric, [`${a}->${b}`]: forward, [`${b}->${a}`]: backward };
}

async function runLightingCase(actors, gridSize, lighting, settleMs, keepScene) {
  const { scene, tokenIds } = await createScene(actors, gridSize, lighting);
  try {
    await scene.view();
    await waitForCanvasScene(scene.id);
    await sleep(settleMs);
    const vision = Object.fromEntries(
      Object.entries(tokenIds).map(([key, id]) => [key, visionSummary(canvas.tokens.get(id))]),
    );
    const pairs = [];
    for (const pair of PAIRS) pairs.push(await pairResult(pair, tokenIds));
    return { lighting: lighting.key, pass: pairs.every((p) => p.symmetric), pairs, vision };
  } finally {
    if (!keepScene) await scene.delete();
  }
}

export async function runBlankPcNpcSymmetryTest({
  gridSize = 100,
  settleMs = 3000,
  cases = LIGHTING_CASES,
  keepScene = false,
} = {}) {
  if (!game.user.isGM) return { pass: false, error: 'run as a GM' };
  const previousScene = canvas.scene;
  const actors = await createBlankActors();
  const results = [];
  try {
    for (const lighting of cases) {
      results.push(await runLightingCase(actors, gridSize, lighting, settleMs, keepScene));
    }
  } finally {
    if (previousScene) await previousScene.view();
    if (!keepScene) await game.actors.documentClass.deleteDocuments(Object.values(actors).map((a) => a.id));
  }
  return {
    pass: results.every((r) => r.pass),
    activeGM: game.users.activeGM?.name,
    storedIsAuthoritative: game.users.activeGM?.id === game.user.id,
    results,
  };
}
