import { createAvsWriterHandoff } from '../../../scripts/services/avs-writer-handoff.js';

describe('createAvsWriterHandoff', () => {
  test('recalculates once when this client becomes the scene writer', () => {
    let writer = false;
    const recalculate = jest.fn();
    const handoff = createAvsWriterHandoff({ isWriter: () => writer, recalculate });
    expect(handoff.refresh()).toBe(false);
    writer = true;
    expect(handoff.refresh()).toBe(true);
    expect(handoff.refresh()).toBe(false);
    expect(recalculate).toHaveBeenCalledTimes(1);
  });

  test('does not recalculate when losing the writer role', () => {
    let writer = true;
    const recalculate = jest.fn();
    const handoff = createAvsWriterHandoff({ isWriter: () => writer, recalculate });
    writer = false;
    expect(handoff.refresh()).toBe(false);
    expect(recalculate).not.toHaveBeenCalled();
  });

  test('sync records the role without recalculating', () => {
    let writer = false;
    const recalculate = jest.fn();
    const handoff = createAvsWriterHandoff({ isWriter: () => writer, recalculate });
    writer = true;
    handoff.sync();
    expect(handoff.refresh()).toBe(false);
    expect(recalculate).not.toHaveBeenCalled();
  });

  test('regains recalculation after losing and retaking the role', () => {
    let writer = true;
    const recalculate = jest.fn();
    const handoff = createAvsWriterHandoff({ isWriter: () => writer, recalculate });
    writer = false;
    handoff.refresh();
    writer = true;
    handoff.refresh();
    expect(recalculate).toHaveBeenCalledTimes(1);
  });
});

describe('shouldRefreshAvsWriterForUserChange', () => {
  test('reacts to viewed scene, role and active changes only', async () => {
    const { shouldRefreshAvsWriterForUserChange } = await import('../../../scripts/services/avs-writer-handoff.js');
    expect(shouldRefreshAvsWriterForUserChange({ viewedScene: 'x' })).toBe(true);
    expect(shouldRefreshAvsWriterForUserChange({ role: 3 })).toBe(true);
    expect(shouldRefreshAvsWriterForUserChange({ active: false })).toBe(true);
    expect(shouldRefreshAvsWriterForUserChange({ color: '#fff' })).toBe(false);
    expect(shouldRefreshAvsWriterForUserChange(null)).toBe(false);
  });
});
