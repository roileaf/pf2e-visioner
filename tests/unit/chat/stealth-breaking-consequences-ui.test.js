import '../../setup.js';

jest.mock('../../../scripts/chat/services/take-cover-expiration-service.js', () => ({
  requestTakeCoverExpirationForToken: jest.fn(),
}));

import { buildConsequencesPanel } from '../../../scripts/chat/ui/panel/consequences.js';
import { requestConsequencesTakeCoverExpiration } from '../../../scripts/chat/services/actions/Consequences/consequences-avs-application.js';
import { requestTakeCoverExpirationForToken } from '../../../scripts/chat/services/take-cover-expiration-service.js';

describe('Stealth-break consequences UI', () => {
  beforeEach(() => {
    game.user.isGM = true;
    requestTakeCoverExpirationForToken.mockClear();
  });

  test('panel uses stealth-break labels for non-attack actions', () => {
    const panel = buildConsequencesPanel({ attackData: { isAttackRoll: false, stealthBreak: true } });
    expect(panel.title).toBe('PF2E_VISIONER.UI.STEALTH_BREAK_TITLE');
    expect(panel.actionButtonsHtml).toContain('PF2E_VISIONER.UI.STEALTH_BREAK_OPEN');
  });

  test('panel keeps attack labels for attacks', () => {
    const panel = buildConsequencesPanel({ attackData: { isAttackRoll: true } });
    expect(panel.title).toBe('Attack Consequences');
  });

  test('stealth-break actions do not prompt Take Cover expiration', async () => {
    await requestConsequencesTakeCoverExpiration({
      actor: { actor: {} },
      attackData: { isAttackRoll: false, stealthBreak: true },
    });
    expect(requestTakeCoverExpirationForToken).not.toHaveBeenCalled();
  });

  test('attacks still prompt Take Cover expiration', async () => {
    const attacker = { actor: {} };
    await requestConsequencesTakeCoverExpiration({ actor: attacker, attackData: { isAttackRoll: true } });
    expect(requestTakeCoverExpirationForToken).toHaveBeenCalledWith(attacker, 'attack');
  });
});
