import { COVER_ADJUSTMENT_MODES, adjustCoverState, applyCoverAdjustments, resolveAdjustedCover } from '../../../scripts/cover/cover-adjustments.js';

describe('adjustCoverState', () => {
  test('step -1 walks down the ladder and clamps at none', () => {
    expect(adjustCoverState('greater', { mode: 'step', steps: -1 })).toBe('standard');
    expect(adjustCoverState('standard', { mode: 'step', steps: -1 })).toBe('lesser');
    expect(adjustCoverState('lesser', { mode: 'step', steps: -1 })).toBe('none');
    expect(adjustCoverState('none', { mode: 'step', steps: -1 })).toBe('none');
  });
  test('bonus -2 maps via AC bonus', () => {
    expect(adjustCoverState('greater', { mode: 'bonus', amount: -2 })).toBe('standard');
    expect(adjustCoverState('standard', { mode: 'bonus', amount: -2 })).toBe('none');
    expect(adjustCoverState('lesser', { mode: 'bonus', amount: -2 })).toBe('none');
    expect(adjustCoverState('none', { mode: 'bonus', amount: -2 })).toBe('none');
  });
  test('minimum lesser raises none to lesser and keeps higher cover', () => {
    expect(adjustCoverState('none', { mode: 'minimum', state: 'lesser' })).toBe('lesser');
    expect(adjustCoverState('lesser', { mode: 'minimum', state: 'lesser' })).toBe('lesser');
    expect(adjustCoverState('standard', { mode: 'minimum', state: 'lesser' })).toBe('standard');
    expect(adjustCoverState('greater', { mode: 'minimum', state: 'lesser' })).toBe('greater');
  });
  test('minimum standard and greater raise up to the given state', () => {
    expect(adjustCoverState('lesser', { mode: 'minimum', state: 'standard' })).toBe('standard');
    expect(adjustCoverState('greater', { mode: 'minimum', state: 'standard' })).toBe('greater');
    expect(adjustCoverState('standard', { mode: 'minimum', state: 'greater' })).toBe('greater');
  });
  test('minimum treats an unknown current state as none', () => {
    expect(adjustCoverState(undefined, { mode: 'minimum', state: 'lesser' })).toBe('lesser');
  });
  test('minimum with unknown or missing state is a no-op', () => {
    expect(adjustCoverState('none', { mode: 'minimum', state: 'hidden' })).toBe('none');
    expect(adjustCoverState('standard', { mode: 'minimum' })).toBe('standard');
  });
  test('unknown mode is a no-op', () => {
    expect(adjustCoverState('standard', { mode: 'wat' })).toBe('standard');
  });
});

describe('applyCoverAdjustments', () => {
  const ro = ['item:slug:shooting-star'];
  test('stacks cumulatively, highest priority first, returns applied ids', () => {
    const adjustments = [
      { id: 'a', priority: 100, mode: 'step', steps: -1 },
      { id: 'b', priority: 200, mode: 'step', steps: -1 },
    ];
    expect(applyCoverAdjustments('greater', adjustments, ro)).toEqual({ state: 'lesser', applied: ['b', 'a'] });
  });
  test('skips adjustments whose predicate fails', () => {
    const adjustments = [{ id: 'a', priority: 100, mode: 'step', steps: -1, predicate: ['item:slug:phase-bolt'] }];
    expect(applyCoverAdjustments('standard', adjustments, ro)).toEqual({ state: 'standard', applied: [] });
  });
  test('minimum stacks with a lower-priority step reduction', () => {
    const adjustments = [
      { id: 'cover', priority: 120, mode: 'minimum', state: 'lesser' },
      { id: 'reduce', priority: 100, mode: 'step', steps: -1 },
    ];
    expect(applyCoverAdjustments('none', adjustments, ro)).toEqual({ state: 'none', applied: ['cover', 'reduce'] });
  });
  test('applies adjustment whose predicate matches', () => {
    const adjustments = [{ id: 'a', priority: 100, mode: 'step', steps: -1, predicate: ['item:slug:shooting-star'] }];
    expect(applyCoverAdjustments('standard', adjustments, ro)).toEqual({ state: 'lesser', applied: ['a'] });
  });
});

function tok(id) { return { id, document: { id } }; }

describe('resolveAdjustedCover', () => {
  test('applies adjustments and consumes only next-attack ones that fired', async () => {
    const consumed = [];
    const deps = {
      getActiveCoverAdjustments: () => [
        { id: 'persist', priority: 100, mode: 'step', steps: -1, scope: 'while-active' },
        { id: 'oneshot', priority: 90, mode: 'step', steps: -1, scope: 'next-attack' },
      ],
      consumeCoverAdjustment: async (d, a, sourceId) => consumed.push(sourceId),
      isGM: () => true,
    };
    const result = await resolveAdjustedCover({ attacker: tok('a'), defender: tok('d'), baseState: 'greater', rollOptions: [], deps });
    expect(result.state).toBe('lesser');
    expect(result.applied.sort()).toEqual(['oneshot', 'persist']);
    expect(consumed).toEqual(['oneshot']);
  });

  test('no adjustments returns base unchanged, consumes nothing', async () => {
    const consumed = [];
    const deps = { getActiveCoverAdjustments: () => [], consumeCoverAdjustment: async (d, a, s) => consumed.push(s), isGM: () => true };
    const result = await resolveAdjustedCover({ attacker: tok('a'), defender: tok('d'), baseState: 'standard', rollOptions: [], deps });
    expect(result).toEqual({ state: 'standard', applied: [] });
    expect(consumed).toEqual([]);
  });

  test('non-GM does not consume', async () => {
    const consumed = [];
    const deps = {
      getActiveCoverAdjustments: () => [{ id: 'oneshot', mode: 'step', steps: -1, scope: 'next-attack' }],
      consumeCoverAdjustment: async (d, a, s) => consumed.push(s),
      isGM: () => false,
    };
    await resolveAdjustedCover({ attacker: tok('a'), defender: tok('d'), baseState: 'standard', rollOptions: [], deps });
    expect(consumed).toEqual([]);
  });

  test('consume:false does not consume next-attack even as GM', async () => {
    const consumed = [];
    const deps = {
      getActiveCoverAdjustments: () => [{ id: 'oneshot', mode: 'step', steps: -1, scope: 'next-attack' }],
      consumeCoverAdjustment: async (d, a, s) => consumed.push(s),
      isGM: () => true,
    };
    const result = await resolveAdjustedCover({ attacker: tok('a'), defender: tok('d'), baseState: 'standard', rollOptions: [], consume: false, deps });
    expect(result.state).toBe('lesser');
    expect(consumed).toEqual([]);
  });

  test('consume:true consumes next-attack as GM', async () => {
    const consumed = [];
    const deps = {
      getActiveCoverAdjustments: () => [{ id: 'oneshot', mode: 'step', steps: -1, scope: 'next-attack' }],
      consumeCoverAdjustment: async (d, a, s) => consumed.push(s),
      isGM: () => true,
    };
    const result = await resolveAdjustedCover({ attacker: tok('a'), defender: tok('d'), baseState: 'standard', rollOptions: [], consume: true, deps });
    expect(result.state).toBe('lesser');
    expect(consumed).toEqual(['oneshot']);
  });
});

describe('COVER_ADJUSTMENT_MODES', () => {
  test('lists step, bonus and minimum', () => {
    expect(COVER_ADJUSTMENT_MODES).toEqual(['step', 'bonus', 'minimum']);
  });
});
