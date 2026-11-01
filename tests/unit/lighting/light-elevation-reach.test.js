import { LightingCalculator } from '../../../scripts/visibility/auto-visibility/LightingCalculator.js';

function darkSceneWithLight(light) {
  const origCanvas = global.canvas, origFoundry = global.foundry;
  global.foundry = { ...(origFoundry ?? {}), canvas: { ...(origFoundry?.canvas ?? {}), sources: { ...(origFoundry?.canvas?.sources ?? {}), GlobalLightSource: class GlobalLightSource {} } } };
  global.canvas = {
    scene: { environment: { darknessLevel: 1, globalLight: { enabled: false } }, darkness: 1, grid: { distance: 5 }, flags: {} },
    grid: { size: 100 },
    dimensions: { distancePixels: 20 },
    effects: { darknessSources: [], lightSources: [light], getDarknessLevel: () => 1 },
    lighting: { placeables: [] },
    tokens: { placeables: [] },
    regions: { placeables: [] },
    visibility: { testVisibility: () => true },
    walls: { checkCollision: () => false },
  };
  return () => { global.canvas = origCanvas; global.foundry = origFoundry; };
}

const token = () => ({
  shape: {
    points: [0, 0, 10, 0, 10, 10, 0, 10],
    clone() {
      return { points: [...this.points], toClipperPoints() { const out = []; for (let i = 0; i < this.points.length; i += 2) out.push({ X: this.points[i], Y: this.points[i + 1] }); return out; } };
    },
  },
});

const torch = (elevation, extra = {}) => ({
  active: true, x: 500, y: 500, data: { bright: 400, dim: 800, elevation, priority: 0 },
  shape: { intersectClipper: (points) => [points] },
  ...extra,
});

function levelAt(light, targetElevation) {
  const teardown = darkSceneWithLight(light);
  try {
    return LightingCalculator.getInstance().getLightLevelAt({ x: 505, y: 505, elevation: targetElevation }, token()).level;
  } finally {
    teardown();
  }
}

describe('light reach across elevation', () => {
  it('a torch at the same elevation lights the target brightly', () => {
    expect(levelAt(torch(0), 0)).toBe('bright');
  });

  it('a torch raised beyond its bright radius only dimly lights the target below', () => {
    expect(levelAt(torch(30), 0)).toBe('dim');
  });

  it('a torch raised beyond its dim radius leaves the target below in darkness', () => {
    expect(levelAt(torch(60), 0)).toBe('darkness');
    expect(levelAt(torch(80), 0)).toBe('darkness');
  });

  it('a torch exactly at its dim radius above still reaches the target', () => {
    expect(levelAt(torch(40), 0)).toBe('dim');
  });

  it('a target raised far above a torch on the ground is in darkness', () => {
    expect(levelAt(torch(0), 70)).toBe('darkness');
  });

  it('a magical light reaches every elevation', () => {
    const magical = torch(80);
    magical.data.priority = 1;
    expect(levelAt(magical, 0)).toBe('bright');
  });

  it('a light without an elevation keeps lighting the target', () => {
    expect(levelAt(torch(undefined), 70)).toBe('bright');
  });
});
