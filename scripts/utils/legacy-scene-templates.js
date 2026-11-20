export function areMeasuredTemplatesRegions() {
  return (game?.release?.generation ?? 0) >= 14;
}

export function getLegacySceneTemplates(scene) {
  if (areMeasuredTemplatesRegions()) return [];
  try {
    return Array.from(scene?.templates ?? []);
  } catch (_) {
    return [];
  }
}
