import '../../setup.js';
import { getLegacySceneTemplates } from '../../../scripts/utils/legacy-scene-templates.js';
import { cleanupSeekPreviewTemplate } from '../../../scripts/chat/dialogs/Seek/seek-dialog-lifecycle.js';

function sceneWithTemplateSpy(templates = []) {
  const reads = { count: 0 };
  const scene = {
    get templates() {
      reads.count += 1;
      return templates;
    },
    regions: { get: jest.fn(() => null) },
    getEmbeddedDocument: jest.fn(() => {
      reads.count += 1;
      return null;
    }),
    deleteEmbeddedDocuments: jest.fn(),
  };
  return { scene, reads };
}

describe('legacy Scene#templates access', () => {
  const originalRelease = game.release;
  const originalScene = canvas.scene;

  afterEach(() => {
    game.release = originalRelease;
    canvas.scene = originalScene;
  });

  test('does not read Scene#templates on v14', () => {
    game.release = { generation: 14 };
    const { scene, reads } = sceneWithTemplateSpy([{ id: 't1' }]);

    expect(getLegacySceneTemplates(scene)).toEqual([]);
    expect(reads.count).toBe(0);
  });

  test('reads Scene#templates on v13', () => {
    game.release = { generation: 13 };
    const { scene } = sceneWithTemplateSpy([{ id: 't1' }]);

    expect(getLegacySceneTemplates(scene)).toEqual([{ id: 't1' }]);
  });

  test('seek preview cleanup deletes the region without touching templates on v14', () => {
    game.release = { generation: 14 };
    const { scene, reads } = sceneWithTemplateSpy();
    scene.regions.get.mockReturnValue({ id: 'r1' });
    canvas.scene = scene;

    cleanupSeekPreviewTemplate({ templateId: 'r1' });

    expect(reads.count).toBe(0);
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledWith('Region', ['r1']);
  });
});
