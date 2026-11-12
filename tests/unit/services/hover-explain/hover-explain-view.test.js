import {
  buildExplainView,
  canExplainTarget,
  explainEntry,
  explainHTML,
  pickExplainObservers,
} from '../../../../scripts/services/HoverExplain/hover-explain-view.js';

const token = (id, extra = {}) => ({ id, name: id, visible: true, document: { hidden: false }, ...extra });
const text = {
  localize: (key) => key.split('.').pop(),
  format: (key, data) => `${key.split('.').pop()}:${Object.values(data).join(',')}`,
};

describe('canExplainTarget', () => {
  test('the GM can explain any token', () => {
    expect(canExplainTarget(token('t', { visible: false }), { isGM: true })).toBe(true);
  });

  test('players need the world setting', () => {
    expect(canExplainTarget(token('t'), { isGM: false, playersAllowed: false })).toBe(false);
    expect(canExplainTarget(token('t'), { isGM: false, playersAllowed: true })).toBe(true);
  });

  test('players never get explanations for tokens they cannot see or that they own', () => {
    expect(canExplainTarget(token('t', { visible: false }), { isGM: false, playersAllowed: true })).toBe(false);
    expect(canExplainTarget(token('t', { document: { hidden: true } }), { isGM: false, playersAllowed: true })).toBe(false);
    expect(canExplainTarget(token('t', { isOwner: true }), { isGM: false, playersAllowed: true })).toBe(false);
  });
});

describe('pickExplainObservers', () => {
  const hovered = token('goblin');

  test('controlled tokens are the observers, without the hovered token', () => {
    const picked = pickExplainObservers(hovered, { controlled: [token('ezren'), hovered], owned: [token('amiri')] });
    expect(picked.map((t) => t.id)).toEqual(['ezren']);
  });

  test('a player with nothing controlled explains from their owned tokens', () => {
    const picked = pickExplainObservers(hovered, { isGM: false, controlled: [], owned: [token('amiri')], party: [token('seelah')] });
    expect(picked.map((t) => t.id)).toEqual(['amiri']);
  });

  test('a GM with nothing controlled explains from the party', () => {
    const picked = pickExplainObservers(hovered, { isGM: true, controlled: [], owned: [], party: [token('seelah'), hovered] });
    expect(picked.map((t) => t.id)).toEqual(['seelah']);
  });
});

describe('explainEntry', () => {
  test('observed pairs need no explanation', () => {
    expect(explainEntry(token('ezren'), { state: 'observed', reasons: ['Bright light'] })).toBeNull();
    expect(explainEntry(token('ezren'), null)).toBeNull();
  });

  test('keeps the observer name, state, lighting and reasons', () => {
    expect(explainEntry(token('ezren'), { state: 'hidden', lighting: 'dim', reasons: ['Heard'] })).toEqual({
      name: 'ezren', state: 'hidden', lighting: 'dim', reasons: ['Heard'],
    });
  });
});

describe('buildExplainView', () => {
  const entry = (name, reasons = ['a', 'b', 'c', 'd']) => ({ name, state: 'hidden', lighting: 'dim', reasons });

  test('nothing to explain shows nothing', () => {
    expect(buildExplainView([null, null])).toBeNull();
  });

  test('one observer shows its state with at most three reasons', () => {
    const view = buildExplainView([entry('ezren'), null]);
    expect(view.mode).toBe('single');
    expect(view.entry.reasons).toEqual(['a', 'b', 'c']);
  });

  test('several observers show one line each, at most four, then a count', () => {
    const view = buildExplainView(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => entry(n)));
    expect(view.mode).toBe('multi');
    expect(view.entries.map((e) => e.name)).toEqual(['a', 'b', 'c', 'd']);
    expect(view.entries[0].reasons).toEqual(['a']);
    expect(view.more).toBe(2);
  });
});

describe('explainHTML', () => {
  test('single view names the observer, state, lighting and reasons', () => {
    const html = explainHTML(buildExplainView([{ name: 'Ezren', state: 'hidden', lighting: 'dim', reasons: ['Heard'] }]), text);
    expect(html).toContain('FROM:Ezren');
    expect(html).toContain('hidden');
    expect(html).toContain('dim');
    expect(html).toContain('<li>Heard</li>');
  });

  test('multi view lists observers and the overflow count', () => {
    const entries = ['A', 'B', 'C', 'D', 'E'].map((name) => ({ name, state: 'undetected', lighting: null, reasons: ['Dark'] }));
    const html = explainHTML(buildExplainView(entries), text);
    expect(html).toContain('<b>A</b>');
    expect(html).toContain('MORE:1');
  });

  test('escapes names and reasons', () => {
    const html = explainHTML(buildExplainView([{ name: '<x>', state: 'hidden', lighting: null, reasons: ['<script>'] }]), text);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;x&gt;');
  });

  test('no view renders nothing', () => {
    expect(explainHTML(null, text)).toBe('');
  });
});
