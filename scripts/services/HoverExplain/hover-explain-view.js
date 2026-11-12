import { normalizeVisibilityFactorLightingKey } from '../HoverTooltip/hover-tooltip-factor-overlay.js';

export const EXPLAIN_REASON_LIMIT = 3;
export const EXPLAIN_OBSERVER_LIMIT = 4;

const I18N = 'PF2E_VISIONER.HOVER_EXPLAIN';

export function canExplainTarget(token, { isGM = false, playersAllowed = false } = {}) {
  if (!token || token.destroyed) return false;
  if (isGM) return true;
  if (!playersAllowed || token.isOwner) return false;
  return token.visible !== false && !token.document?.hidden;
}

function isOtherToken(hovered) {
  return (token) => !!token && token !== hovered && token.id !== hovered?.id;
}

export function pickExplainObservers(hovered, { isGM = false, controlled = [], owned = [], party = [] } = {}) {
  const other = isOtherToken(hovered);
  const fromControl = controlled.filter(other);
  if (fromControl.length) return fromControl;
  return (isGM ? party : owned).filter(other);
}

export function explainEntry(observer, factors) {
  if (!factors?.state || factors.state === 'observed') return null;
  return {
    name: observer?.name ?? '',
    state: factors.state,
    lighting: factors.lighting ?? null,
    reasons: Array.isArray(factors.reasons) ? factors.reasons.filter((r) => typeof r === 'string') : [],
  };
}

function withReasons(entry, limit) {
  return { ...entry, reasons: entry.reasons.slice(0, limit) };
}

export function buildExplainView(entries, { reasonLimit = EXPLAIN_REASON_LIMIT, observerLimit = EXPLAIN_OBSERVER_LIMIT } = {}) {
  const shown = (entries ?? []).filter(Boolean);
  if (!shown.length) return null;
  if (shown.length === 1) return { mode: 'single', entry: withReasons(shown[0], reasonLimit) };
  return {
    mode: 'multi',
    entries: shown.slice(0, observerLimit).map((entry) => withReasons(entry, 1)),
    more: Math.max(0, shown.length - observerLimit),
  };
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function stateLabel(state, { localize }) {
  return esc(localize(`PF2E_VISIONER.VISIBILITY_STATES.${state}`));
}

function lightingLabel(lighting, { localize }) {
  if (!lighting) return '';
  const key = normalizeVisibilityFactorLightingKey(lighting);
  return esc(localize(`PF2E_VISIONER.VISIBILITY_FACTORS.LIGHTING.${key}`));
}

function stateLine(entry, text) {
  const lighting = lightingLabel(entry.lighting, text);
  const tail = lighting ? `<span class="pvhe-detail"> · ${lighting}</span>` : '';
  return `<div class="pvhe-state"><b class="pvhe-${esc(entry.state)}">${stateLabel(entry.state, text)}</b>${tail}</div>`;
}

function singleHTML(entry, text) {
  const header = `${esc(text.localize(`${I18N}.TITLE`))} · ${esc(text.format(`${I18N}.FROM`, { name: entry.name }))}`;
  const reasons = entry.reasons.map((r) => `<li>${esc(r)}</li>`).join('');
  return `<header>${header}</header>${stateLine(entry, text)}${reasons ? `<ul>${reasons}</ul>` : ''}`;
}

function observerLine(entry, text) {
  const reason = entry.reasons[0] ? `<small>${esc(entry.reasons[0])}</small>` : '';
  return `<li><b>${esc(entry.name)}</b> <span class="pvhe-${esc(entry.state)}">${stateLabel(entry.state, text)}</span>${reason}</li>`;
}

function multiHTML(view, text) {
  const lines = view.entries.map((entry) => observerLine(entry, text)).join('');
  const more = view.more ? `<footer>${esc(text.format(`${I18N}.MORE`, { count: view.more }))}</footer>` : '';
  return `<header>${esc(text.localize(`${I18N}.TITLE`))}</header><ul class="pvhe-observers">${lines}</ul>${more}`;
}

export function explainHTML(view, text) {
  if (!view) return '';
  return view.mode === 'single' ? singleHTML(view.entry, text) : multiHTML(view, text);
}
