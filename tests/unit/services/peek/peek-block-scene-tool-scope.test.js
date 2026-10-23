import { syncPeekBlockSceneToolElement } from '../../../../scripts/services/Peek/peek-block-mode.js';

describe('peek block scene tool sync scope', () => {
  test('searches only inside the scene controls instead of the whole page', () => {
    document.body.innerHTML = `
      <div id="board">${'<div class="filler"></div>'.repeat(50)}</div>
      <nav id="scene-controls">
        <button data-tool="pf2e-visioner-block-player-peek"></button>
      </nav>
      <button class="outside" data-tool="pf2e-visioner-block-player-peek"></button>`;
    const pageWideQuery = jest.spyOn(document, 'querySelectorAll');

    try {
      expect(syncPeekBlockSceneToolElement('both')).toBe(1);
      expect(pageWideQuery).not.toHaveBeenCalled();
      expect(document.querySelector('#scene-controls button').classList.contains('pf2e-visioner-peek-locked')).toBe(true);
      expect(document.querySelector('.outside').classList.contains('pf2e-visioner-peek-locked')).toBe(false);
    } finally {
      pageWideQuery.mockRestore();
    }
  });

  test('does nothing when the scene controls are not rendered', () => {
    document.body.innerHTML = '<button data-tool="pf2e-visioner-block-player-peek"></button>';
    expect(syncPeekBlockSceneToolElement('both')).toBe(0);
  });
});
