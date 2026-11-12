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

const HP_EXPECTED_EXCLUDED = {
  npcHealthy: false,
  npcDown: true,
  pcReal: false,
  pcDown: true,
  pcBlank: false,
};

const HP_POSITIONS = { npcHealthy: [3, 3], npcDown: [9, 3], pcReal: [3, 9], pcDown: [9, 9], pcBlank: [6, 12] };

function worldCharacterWithHp() {
  return game.actors.find(
    (a) => a.type === 'character' && !a.name.startsWith(TAG) && Number(a.system?.attributes?.hp?.max) > 0,
  );
}

async function cloneActor(source, key) {
  return source.clone({ name: `${TAG} ${key}`, folder: null }, { save: true });
}

async function createHpActors() {
  const source = worldCharacterWithHp();
  if (!source) throw new Error('no world character with hit points to clone');
  const created = await game.actors.documentClass.createDocuments([
    { name: `${TAG} npcHealthy`, type: 'npc' },
    { name: `${TAG} npcDown`, type: 'npc' },
    { name: `${TAG} pcBlank`, type: 'character' },
  ]);
  const actors = Object.fromEntries(created.map((a) => [a.name.replace(`${TAG} `, ''), a]));
  actors.pcReal = await cloneActor(source, 'pcReal');
  actors.pcDown = await cloneActor(source, 'pcDown');
  await actors.npcDown.update({ 'system.attributes.hp.value': 0 });
  await actors.pcDown.update({ 'system.attributes.hp.value': 0 });
  return { actors, sourceName: source.name };
}

async function createHpScene(actors, gridSize) {
  const lighting = { key: 'hp', darknessLevel: 1, globalLight: { enabled: false } };
  const scene = await game.scenes.documentClass.create(sceneData(gridSize, lighting));
  const keys = Object.keys(HP_POSITIONS);
  const data = [];
  for (const key of keys) data.push(await tokenData(actors[key], HP_POSITIONS[key], gridSize));
  const created = await scene.createEmbeddedDocuments('Token', data);
  return { scene, tokenIds: Object.fromEntries(keys.map((key, i) => [key, created[i].id])) };
}

function hpOf(token) {
  const hp = token.actor?.system?.attributes?.hp;
  return `${hp?.value}/${hp?.max}`;
}

async function exclusionRow(key, token, exclusion) {
  const excluded = exclusion.isExcludedToken(token);
  return { key, hp: hpOf(token), excluded, expected: HP_EXPECTED_EXCLUDED[key], ok: excluded === HP_EXPECTED_EXCLUDED[key] };
}

function hasDarkvision(token) {
  const senses = token.actor?.perception?.senses ?? [];
  return senses.some?.((s) => String(s.type).includes('darkvision')) ?? false;
}

async function healthyPairCheck(tokenIds) {
  const pc = canvas.tokens.get(tokenIds.pcReal);
  const npc = canvas.tokens.get(tokenIds.npcHealthy);
  const pcToNpc = await directVisibility(pc, npc);
  const npcToPc = await directVisibility(npc, pc);
  const pcDarkvision = hasDarkvision(pc);
  const expectedPcToNpc = pcDarkvision ? 'observed' : 'hidden';
  return { pcDarkvision, pcToNpc, npcToPc, ok: pcToNpc === expectedPcToNpc && npcToPc === 'hidden' };
}

export async function runHpDefeatedTest({ gridSize = 100, settleMs = 2500, keepScene = false } = {}) {
  if (!game.user.isGM) return { pass: false, error: 'run as a GM' };
  const previousScene = canvas.scene;
  const { actors, sourceName } = await createHpActors();
  const { scene, tokenIds } = await createHpScene(actors, gridSize);
  try {
    await scene.view();
    await waitForCanvasScene(scene.id);
    await sleep(settleMs);
    const { ExclusionManager } = await import('../../scripts/visibility/auto-visibility/core/ExclusionManager.js');
    const exclusion = new ExclusionManager();
    const rows = [];
    for (const [key, id] of Object.entries(tokenIds)) rows.push(await exclusionRow(key, canvas.tokens.get(id), exclusion));
    const pair = await healthyPairCheck(tokenIds);
    return { pass: rows.every((r) => r.ok) && pair.ok, clonedFrom: sourceName, rows, pair };
  } finally {
    if (previousScene) await previousScene.view();
    if (!keepScene) {
      await scene.delete();
      await game.actors.documentClass.deleteDocuments(Object.values(actors).map((a) => a.id));
    }
  }
}
