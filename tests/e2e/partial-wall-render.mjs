const MODULE_ID = 'pf2e-visioner';
const TAG = 'Visioner E2E - PartialWall';

const LIGHTING = {
  daylight: { darknessLevel: 0, globalLight: { enabled: true, darkness: { max: 1 } } },
  dark: { darknessLevel: 1, globalLight: { enabled: false } },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function api() {
  return game.modules.get(MODULE_ID)?.api;
}

async function cleanupLeftovers() {
  for (const scene of game.scenes.filter((s) => s.name.startsWith(TAG))) await scene.delete();
  const ids = game.actors.filter((a) => a.name.startsWith(TAG)).map((a) => a.id);
  if (ids.length) await game.actors.documentClass.deleteDocuments(ids);
}

async function createFixture({ lighting, wall, wallSight, wallSound, lightAt, observerAt, targetAt }) {
  const actors = await game.actors.documentClass.createDocuments([
    { name: `${TAG} obs`, type: 'npc' },
    { name: `${TAG} tgt`, type: 'npc' },
  ]);
  const scene = await game.scenes.documentClass.create({
    name: TAG,
    width: 2000,
    height: 2000,
    padding: 0,
    grid: { size: 100, distance: 5, units: 'ft' },
    tokenVision: true,
    environment: LIGHTING[lighting],
  });
  await scene.createEmbeddedDocuments('Wall', [{ c: wall, sight: wallSight, light: 20, sound: wallSound, move: 20 }]);
  if (lightAt) {
    await scene.createEmbeddedDocuments('AmbientLight', [{ x: lightAt[0], y: lightAt[1], config: { bright: 20, dim: 40 } }]);
  }
  const data = [
    (await actors[0].getTokenDocument({ x: observerAt[0], y: observerAt[1] })).toObject(),
    (await actors[1].getTokenDocument({ x: targetAt[0], y: targetAt[1] })).toObject(),
  ];
  await scene.createEmbeddedDocuments('Token', data);
  return { scene, actors };
}

function tokenFor(actor) {
  return canvas.tokens.placeables.find((t) => t.actor?.id === actor.id);
}

function losContains(observer, point) {
  const los = observer.vision?.los;
  if (!los) return null;
  return typeof los.contains === 'function' ? los.contains(point.x, point.y) : null;
}

async function measure(observer, target) {
  const points = target.document.getVisibilityTestPoints?.() ?? [];
  return {
    direct: await api().autoVisibility.calculateVisibility(observer, target),
    stored: api().getVisibility(observer.id, target.id),
    tokenVisible: target.visible,
    meshVisible: target.mesh?.visible ?? null,
    meshAlpha: target.mesh?.alpha ?? null,
    coreTest: canvas.visibility.testVisibility(target.center, { object: target }),
    pointsInLos: points.map((p) => losContains(observer, p)),
    centerInLos: losContains(observer, target.center),
  };
}

export async function runPartialWallRenderTest({
  lighting = 'daylight',
  wall = [480, 950, 620, 950],
  observerAt = [500, 300],
  targetAt = [500, 1000],
  wallSight = 20,
  wallSound = 0,
  lightAt = null,
  settleMs = 2500,
  keepScene = false,
} = {}) {
  if (!game.user.isGM) return { pass: false, error: 'run as a GM' };
  await cleanupLeftovers();
  const previousScene = canvas.scene;
  const { scene, actors } = await createFixture({ lighting, wall, wallSight, wallSound, lightAt, observerAt, targetAt });
  try {
    await scene.view();
    await sleep(settleMs);
    const observer = tokenFor(actors[0]);
    const target = tokenFor(actors[1]);
    observer.control({ releaseOthers: true });
    await sleep(settleMs);
    const result = await measure(observer, target);
    const visibleState = ['observed', 'concealed'].includes(result.direct);
    return { pass: !visibleState || result.tokenVisible === true, lighting, ...result };
  } finally {
    canvas.tokens?.releaseAll?.();
    if (previousScene) await previousScene.view();
    if (!keepScene) await cleanupLeftovers();
  }
}
