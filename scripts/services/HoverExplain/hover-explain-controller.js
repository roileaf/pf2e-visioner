import { buildExplainView, explainEntry } from './hover-explain-view.js';

export const HOVER_EXPLAIN_CLASS = 'pf2e-visioner-hover-explain';
export const HOVER_EXPLAIN_REPOSITION_MS = 250;

export function tokenCornerPoint(token, toScreen) {
  if (!token || typeof toScreen !== 'function') return null;
  const point = toScreen({ x: (Number(token.x) || 0) + (Number(token.w) || 0), y: Number(token.y) || 0 });
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

async function collectEntries(token, observers, getFactors) {
  const entries = await Promise.all(
    observers.map(async (observer) => {
      try {
        return explainEntry(observer, await getFactors(observer.id, token.id));
      } catch {
        return null;
      }
    }),
  );
  return entries;
}

export function createHoverExplain({
  document,
  enabled,
  canExplain,
  observersFor,
  getFactors,
  render,
  toScreen,
  setInterval: every = globalThis.setInterval,
  clearInterval: stop = globalThis.clearInterval,
}) {
  let el = null;
  let token = null;
  let html = '';
  let timer = null;
  let generation = 0;

  function element() {
    if (el) return el;
    el = document.createElement('div');
    el.className = HOVER_EXPLAIN_CLASS;
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.append(el);
    return el;
  }

  function conceal() {
    if (el) el.hidden = true;
  }

  function place() {
    const at = token && html ? tokenCornerPoint(token, toScreen) : null;
    if (!at) return conceal();
    const box = element();
    if (box.innerHTML !== html) box.innerHTML = html;
    box.style.left = `${at.x}px`;
    box.style.top = `${at.y}px`;
    box.hidden = false;
  }

  function startRepositioning() {
    if (timer !== null) return;
    timer = every(place, HOVER_EXPLAIN_REPOSITION_MS);
    timer?.unref?.();
  }

  function hide() {
    generation += 1;
    token = null;
    html = '';
    if (timer !== null) {
      stop(timer);
      timer = null;
    }
    conceal();
  }

  async function explain(target) {
    const mine = ++generation;
    token = target;
    html = '';
    conceal();
    if (!enabled() || !canExplain(target)) return;
    const observers = observersFor(target) ?? [];
    if (!observers.length) return;
    const entries = await collectEntries(target, observers, getFactors);
    if (mine !== generation) return;
    html = render(buildExplainView(entries)) || '';
    place();
    if (html) startRepositioning();
  }

  function isCurrent(target) {
    return !!token && (target === token || (target?.id && target.id === token.id));
  }

  return {
    async hover(target, hovered) {
      if (!hovered) {
        if (!token || isCurrent(target)) hide();
        return;
      }
      await explain(target);
    },
    async refresh() {
      if (token) await explain(token);
    },
    reposition: place,
    hide,
    destroy() {
      hide();
      el?.remove();
      el = null;
    },
  };
}
