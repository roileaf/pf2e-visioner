import { createHoverExplain } from '../../../../scripts/services/HoverExplain/hover-explain-controller.js';

const token = (id) => ({ id, name: id, x: 100, y: 50, w: 100, h: 100 });

function setup(overrides = {}) {
  const factors = overrides.factors ?? { state: 'hidden', lighting: 'dim', reasons: ['Heard'] };
  const getFactors = jest.fn(async () => factors);
  const controller = createHoverExplain({
    document,
    enabled: () => true,
    canExplain: () => true,
    observersFor: () => [token('ezren')],
    getFactors,
    render: (view) => (view ? `<b>${view.entry?.name ?? 'multi'}</b>` : ''),
    toScreen: ({ x, y }) => ({ x, y }),
    setInterval: () => 1,
    clearInterval: () => {},
    ...overrides,
  });
  return { controller, getFactors };
}

const box = () => document.querySelector('.pf2e-visioner-hover-explain');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hover explain controller', () => {
  test('hovering shows the box at the token top-right corner', async () => {
    const { controller, getFactors } = setup();
    await controller.hover(token('goblin'), true);
    expect(getFactors).toHaveBeenCalledWith('ezren', 'goblin');
    expect(box().hidden).toBe(false);
    expect(box().innerHTML).toBe('<b>ezren</b>');
    expect(box().style.left).toBe('200px');
    expect(box().style.top).toBe('50px');
  });

  test('hover end hides the box', async () => {
    const { controller } = setup();
    const goblin = token('goblin');
    await controller.hover(goblin, true);
    await controller.hover(goblin, false);
    expect(box().hidden).toBe(true);
  });

  test('nothing to explain keeps the box hidden', async () => {
    const { controller } = setup({ factors: { state: 'observed', reasons: [] } });
    await controller.hover(token('goblin'), true);
    expect(box()?.hidden ?? true).toBe(true);
  });

  test('a token that cannot be explained is skipped without computing factors', async () => {
    const { controller, getFactors } = setup({ canExplain: () => false });
    await controller.hover(token('goblin'), true);
    expect(getFactors).not.toHaveBeenCalled();
  });

  test('a slow answer for a token no longer hovered is dropped', async () => {
    let release;
    const getFactors = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const { controller } = setup({ getFactors });
    const goblin = token('goblin');
    const pending = controller.hover(goblin, true);
    await controller.hover(goblin, false);
    release({ state: 'hidden', lighting: null, reasons: ['Heard'] });
    await pending;
    expect(box()?.hidden ?? true).toBe(true);
  });

  test('disabled shows nothing', async () => {
    const { controller, getFactors } = setup({ enabled: () => false });
    await controller.hover(token('goblin'), true);
    expect(getFactors).not.toHaveBeenCalled();
  });
});
