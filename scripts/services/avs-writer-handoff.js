import { isCurrentSceneAvsWriter } from './gm-election.js';

const WRITER_USER_FIELDS = ['viewedScene', 'role', 'active'];

function recalculateCurrentScene() {
  return globalThis.window?.pf2eVisioner?.services?.autoVisibilitySystem?.recalculateAll?.();
}

export function shouldRefreshAvsWriterForUserChange(changes) {
  if (!changes || typeof changes !== 'object') return false;
  return WRITER_USER_FIELDS.some((field) => field in changes);
}

export function createAvsWriterHandoff({
  isWriter = isCurrentSceneAvsWriter,
  recalculate = recalculateCurrentScene,
} = {}) {
  let wasWriter = isWriter();
  return {
    sync() {
      wasWriter = isWriter();
    },
    refresh() {
      const nowWriter = isWriter();
      const gained = nowWriter && !wasWriter;
      wasWriter = nowWriter;
      if (gained) recalculate();
      return gained;
    },
  };
}

export function registerAvsWriterHandoffHooks() {
  const handoff = createAvsWriterHandoff();
  Hooks.on('canvasReady', () => handoff.sync());
  Hooks.on('userConnected', () => handoff.refresh());
  Hooks.on('updateUser', (_user, changes) => {
    if (shouldRefreshAvsWriterForUserChange(changes)) handoff.refresh();
  });
  return handoff;
}
