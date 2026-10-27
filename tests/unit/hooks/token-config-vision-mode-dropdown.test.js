import { MODULE_ID } from '../../../scripts/constants.js';
import { registerUIHooks } from '../../../scripts/hooks/ui.js';

jest.mock('../../../scripts/ui/dialogs/VisionMasterDialog.js', () => ({
  VisionMasterDialog: {
    selectMaster: jest.fn(async () => ({ tokenId: 'master-token', mode: 'replace' })),
  },
}));

function getRenderTokenConfigHook() {
  registerUIHooks();
  const calls = Hooks.on.mock.calls.filter(([hookName]) => hookName === 'renderTokenConfig');
  return calls.at(-1)?.[1];
}

function makeVisionRoot() {
  const root = document.createElement('div');
  root.innerHTML = `
    <form>
      <div class="tab" data-group="sheet" data-tab="vision">
        <fieldset><legend>Detection</legend></fieldset>
      </div>
    </form>
  `;
  return root;
}

function makeMinionApp() {
  const flags = { visionMasterTokenId: 'master-token', visionSharingMode: 'replace' };
  const actor = createMockActor({ type: 'npc', getFlag: jest.fn(() => null) });
  return {
    document: {
      id: 'minion-token',
      uuid: 'Token.minion',
      actor,
      flags: { [MODULE_ID]: flags },
      getFlag: jest.fn((moduleId, key) => (moduleId === MODULE_ID ? flags[key] : null)),
    },
  };
}

function modeSelects(root) {
  return root.querySelectorAll(`select[name="flags.${MODULE_ID}.visionSharingMode"]`);
}

async function flushAsync() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Token config vision sharing mode dropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    game.user.isGM = true;
    const masterToken = { id: 'master-token', name: 'Heavenly Scales', actor: { uuid: 'Actor.m' } };
    global.canvas.tokens.get = jest.fn((id) => (id === 'master-token' ? masterToken : null));
  });

  test('re-picking a master keeps a single mode dropdown', async () => {
    const hook = getRenderTokenConfigHook();
    const root = makeVisionRoot();
    hook(makeMinionApp(), root);
    expect(modeSelects(root)).toHaveLength(1);

    root.querySelector('.pv-vision-master-btn').click();
    await flushAsync();

    expect(modeSelects(root)).toHaveLength(1);
    expect(modeSelects(root)[0].value).toBe('replace');
  });
});
