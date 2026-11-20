import { areMeasuredTemplatesRegions } from '../../../utils/legacy-scene-templates.js';
import { hideSeekSensesTooltip } from './seek-senses-tooltip.js';

export function cleanupSeekPreviewTemplate(app) {
  try {
    if (!app?.templateId || app.templateCenter || !canvas.scene) return;

    if (areMeasuredTemplatesRegions()) {
      if (canvas.scene.regions?.get?.(app.templateId)) {
        canvas.scene.deleteEmbeddedDocuments('Region', [app.templateId]);
      }
      return;
    }
    const doc =
      canvas.scene.templates?.get?.(app.templateId) ||
      canvas.scene.getEmbeddedDocument?.('MeasuredTemplate', app.templateId);
    if (doc) {
      canvas.scene.deleteEmbeddedDocuments('MeasuredTemplate', [app.templateId]);
    }
  } catch (error) {
    console.warn('Failed to remove Seek preview template:', error);
  }
}

export function cleanupSeekSelectionHook(app) {
  if (!app?._selectionHookId) return;

  try {
    Hooks.off('controlToken', app._selectionHookId);
  } catch { }

  app._selectionHookId = null;
}

export function cleanupSeekDialogLifecycle(app) {
  hideSeekSensesTooltip(app);
  cleanupSeekPreviewTemplate(app);
  cleanupSeekSelectionHook(app);
}
