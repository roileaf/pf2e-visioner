export const APPARITION_SENSE = 'apparition-sense';
export const APPARITION_SENSE_RANGE = 30;

const APPARITION_SENSE_FEAT_SLUG = 'apparition-sense';
const APPARITION_TARGET_TRAITS = new Set(['spirit', 'undead', 'haunt']);

function getActorFeats(actor) {
  return actor?.itemTypes?.feat ?? actor?.items?.filter?.((item) => item?.type === 'feat') ?? [];
}

function getFeatSlug(feat) {
  return String(feat?.system?.slug ?? feat?.slug ?? '').toLowerCase();
}

export function hasApparitionSenseFeat(actor) {
  if (!actor) return false;
  try {
    return getActorFeats(actor).some((feat) => getFeatSlug(feat) === APPARITION_SENSE_FEAT_SLUG);
  } catch {
    return false;
  }
}

export function getApparitionSenseFromFeats(actor) {
  if (!hasApparitionSenseFeat(actor)) return null;
  return { type: APPARITION_SENSE, acuity: 'imprecise', range: APPARITION_SENSE_RANGE };
}

export function canApparitionSenseDetect(target) {
  const traits = Array.isArray(target?.traits) ? target.traits : [];
  return traits.some((trait) => APPARITION_TARGET_TRAITS.has(String(trait).toLowerCase()));
}
