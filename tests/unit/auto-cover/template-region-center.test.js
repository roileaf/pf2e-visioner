import '../../setup.js';

// A v14 token emanation (RegionDocument.createTokenEmanation) has no x/y of its own, only the token
// it surrounds. Reading shape.x/y put the area's center at the scene's corner, so cover for every
// creature inside was measured from 0,0 through the walls: greater cover from an adjacent creature.
describe('regionShapeCenter', () => {
  let regionShapeCenter;

  beforeEach(async () => {
    jest.resetModules();
    global.canvas = { ...(global.canvas ?? {}), grid: { ...(global.canvas?.grid ?? {}), size: 100 } };
    ({ regionShapeCenter } = await import('../../../scripts/cover/auto-cover/TemplateManager.js'));
  });

  test('centers an emanation on the token it surrounds', () => {
    const shape = { type: 'emanation', radius: 100, base: { type: 'token', x: 500, y: 800, width: 1, height: 1 } };
    expect(regionShapeCenter(shape)).toEqual({ x: 550, y: 850 });
  });

  test('a large token base uses its grid size', () => {
    const shape = { type: 'emanation', radius: 100, base: { type: 'token', x: 500, y: 800, width: 2, height: 2 } };
    expect(regionShapeCenter(shape)).toEqual({ x: 600, y: 900 });
  });

  test('a shape with its own center keeps it', () => {
    expect(regionShapeCenter({ type: 'circle', x: 300, y: 400, radius: 50 })).toEqual({ x: 300, y: 400 });
  });
});
