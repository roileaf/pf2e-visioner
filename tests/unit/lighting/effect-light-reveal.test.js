import { LightingCalculator } from '../../../scripts/visibility/auto-visibility/LightingCalculator.js';

// Animater's spell lights (a Fireball's flash) say whether they reveal the creatures they light: its homebrew
// "Effect light reveals creatures" setting. One that reveals nothing lights the scene but not the creatures in it.
function darkSceneWithLight(light) {
  const origCanvas = global.canvas, origFoundry = global.foundry;
  global.foundry = { ...(origFoundry ?? {}), canvas: { ...(origFoundry?.canvas ?? {}), sources: { ...(origFoundry?.canvas?.sources ?? {}), GlobalLightSource: class GlobalLightSource {} } } };
  global.canvas = {
    scene: { environment: { darknessLevel: 1, globalLight: { enabled: false } }, darkness: 1, grid: { distance: 5 }, flags: {} },
    grid: { size: 100 },
    effects: { darknessSources: [], lightSources: [light], getDarknessLevel: () => 1 },
    lighting: { placeables: [] },
    tokens: { placeables: [] },
    regions: { placeables: [] },
    visibility: { testVisibility: () => true },
    walls: { checkCollision: () => false },
  };
  return () => { global.canvas = origCanvas; global.foundry = origFoundry; };
}
// A token with its own shape, as the other lighting tests make one.
const token = () => ({
  shape: {
    points: [0, 0, 10, 0, 10, 10, 0, 10],
    clone() {
      return { points: [...this.points], toClipperPoints() { const out = []; for (let i = 0; i < this.points.length; i += 2) out.push({ X: this.points[i], Y: this.points[i + 1] }); return out; } };
    },
  },
});
const flash = (extra = {}) => ({
  active: true, x: 500, y: 500, data: { bright: 300, dim: 600 },
  shape: { intersectClipper: (points) => [points] },
  ...extra,
});

describe('Animater effect lights and revealing creatures', () => {
  const level = (light) => {
    const teardown = darkSceneWithLight(light);
    try { return LightingCalculator.getInstance().getLightLevelAt({ x: 505, y: 505 }, token()).level; }
    finally { teardown(); }
  };
  it('a light that reveals creatures lights them', () => {
    expect(level(flash())).toBe('bright');
    expect(level(flash({ revealsCreatures: true }))).toBe('bright');
  });
  it('a light that reveals nothing leaves them in the dark', () => {
    expect(level(flash({ revealsCreatures: false }))).toBe('darkness');
  });
});
