import '../../../setup.js';

// PF2e builds a saving throw's context with the saver as both `token` and `target`, and the creature
// whose effect forced the save as `origin`. Reported live: a Magnetic Skink's Launch Metal ("all
// creatures adjacent to the skink") gave both adjacent targets greater cover in the save dialog,
// because cover was measured from the saver to itself.
describe('SavingThrowUseCase dialog roles', () => {
  let mockAutoCoverSystem;
  let mockCoverUIManager;

  async function loadUseCase() {
    mockAutoCoverSystem = {
      normalizeTokenRef: jest.fn((ref) => ref),
      detectCoverBetweenTokens: jest.fn(() => 'none'),
      getCoverBonusByState: jest.fn(() => 0),
    };
    mockCoverUIManager = {
      injectDialogCoverUI: jest.fn(),
      shouldShowCoverOverrideIndicator: jest.fn().mockResolvedValue(false),
      injectCoverOverrideIndicator: jest.fn(),
    };
    const mockTemplateManager = {
      getLatestTemplateForTarget: jest.fn(() => null),
      getTemplatesData: jest.fn(() => new Map()),
      getTemplateOrigin: jest.fn(() => null),
    };
    jest.doMock('../../../../scripts/cover/auto-cover/AutoCoverSystem.js', () => mockAutoCoverSystem);
    jest.doMock('../../../../scripts/cover/auto-cover/CoverUIManager.js', () => mockCoverUIManager);
    jest.doMock('../../../../scripts/cover/auto-cover/TemplateManager.js', () => mockTemplateManager);
    const { SavingThrowUseCase } = await import(
      '../../../../scripts/cover/auto-cover/usecases/SavingThrowUseCase.js'
    );
    return new SavingThrowUseCase();
  }

  function saveDialog(saver, origin) {
    return {
      context: {
        type: 'saving-throw',
        token: saver.document,
        target: { actor: saver.actor, token: saver.document },
        ...(origin ? { origin: { actor: origin.actor, token: origin.document } } : {}),
      },
      check: { modifiers: [], calculateTotal: jest.fn() },
      render: jest.fn(),
    };
  }

  function tokenWithDocument(id) {
    const token = global.createMockToken({ id });
    token.document = { ...(token.document ?? {}), id, object: token };
    return token;
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('measures cover from the creature that forced the save to the saver', async () => {
    const useCase = await loadUseCase();
    const saver = tokenWithDocument('kimerus');
    const skink = tokenWithDocument('skink');

    await useCase.handleCheckDialog(saveDialog(saver, skink), document.createElement('section'));

    const pairs = mockAutoCoverSystem.detectCoverBetweenTokens.mock.calls.map(([a, t]) => [a?.id, t?.id]);
    expect(pairs).toEqual([['skink', 'kimerus']]);
    expect(mockCoverUIManager.injectDialogCoverUI).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(HTMLElement),
      'none',
      saver,
      'none',
      expect.any(Function),
    );
  });

  test('a save rolled without the dialog measures from the origin token, not its document', async () => {
    const useCase = await loadUseCase();
    mockCoverUIManager.showPopupAndApply = jest.fn().mockResolvedValue({ chosen: null });
    const saver = tokenWithDocument('kimerus');
    const skink = tokenWithDocument('skink');
    saver.actor.getActiveTokens = () => [saver];
    const context = {
      type: 'saving-throw',
      actor: saver.actor,
      token: saver.document,
      target: { actor: saver.actor, token: saver.document },
      origin: { actor: skink.actor, token: skink.document },
      options: ['area-effect'],
    };

    await useCase.handleCheckRoll({ modifiers: [], push: jest.fn() }, context);

    const [attacker, defender] = mockAutoCoverSystem.detectCoverBetweenTokens.mock.calls[0] ?? [];
    expect(attacker).toBe(skink);
    expect(defender).toBe(saver);
  });

  test('never measures cover from the saver to itself', async () => {
    const useCase = await loadUseCase();
    const saver = tokenWithDocument('kimerus');

    await useCase.handleCheckDialog(saveDialog(saver, null), document.createElement('section'));

    const selfPairs = mockAutoCoverSystem.detectCoverBetweenTokens.mock.calls.filter(([a, t]) => a?.id === t?.id);
    expect(selfPairs).toHaveLength(0);
    expect(mockCoverUIManager.injectDialogCoverUI).not.toHaveBeenCalled();
  });
});
