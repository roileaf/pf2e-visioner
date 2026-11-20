import { MODULE_ID } from '../../constants.js';

const STEALTH_BREAK_CONTEXT_TYPES = new Set([
  'skill-check',
  'perception-check',
  'spell-cast',
  'self-effect',
]);
const STEALTH_BREAK_ORIGIN_TYPES = new Set(['action', 'feat', 'spell', 'consumable']);
const STEALTH_KEEPING_SLUGS = [
  'hide',
  'sneak',
  'step',
  'avoid-notice',
  'create-a-diversion',
  'seek',
  'point-out',
  'take-cover',
];

function isStealthBreakEnabled() {
  try {
    return game.settings.get(MODULE_ID, 'stealthBreakingActionConsequences') === true;
  } catch {
    return false;
  }
}

function hasActionSlug(context, contextOptions, originRollOptions, slug) {
  return (
    context?.slug === slug ||
    contextOptions.includes(`action:${slug}`) ||
    originRollOptions.includes(`origin:item:slug:${slug}`) ||
    originRollOptions.includes(`origin:item:${slug}`)
  );
}

function isStealthKeepingAction(context, contextOptions, originRollOptions) {
  return STEALTH_KEEPING_SLUGS.some((slug) =>
    hasActionSlug(context, contextOptions, originRollOptions, slug),
  );
}

function isActionMessageType(context, origin) {
  if (context) return STEALTH_BREAK_CONTEXT_TYPES.has(context.type);
  return STEALTH_BREAK_ORIGIN_TYPES.has(origin?.type);
}

export function isStealthBreakingMessage({ context, origin, contextOptions, originRollOptions }) {
  if (!isStealthBreakEnabled()) return false;
  if (!isActionMessageType(context, origin)) return false;
  if (originRollOptions.includes('origin:item:trait:attack')) return false;
  return !isStealthKeepingAction(context, contextOptions, originRollOptions);
}
