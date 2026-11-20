function attackPanelText() {
  return {
    label: 'Open Attack Consequences',
    tooltip: 'Preview and apply visibility changes after attack from hidden/undetected attacker',
    title: 'Attack Consequences',
    icon: 'fas fa-crosshairs',
  };
}

function stealthBreakPanelText() {
  return {
    label: game.i18n.localize('PF2E_VISIONER.UI.STEALTH_BREAK_OPEN'),
    tooltip: game.i18n.localize('PF2E_VISIONER.UI.STEALTH_BREAK_TOOLTIP'),
    title: game.i18n.localize('PF2E_VISIONER.UI.STEALTH_BREAK_TITLE'),
    icon: 'fas fa-eye',
  };
}

export function buildConsequencesPanel(actionData) {
  const { label, tooltip, title, icon } = actionData?.attackData?.stealthBreak
    ? stealthBreakPanelText()
    : attackPanelText();
  const actionName = 'open-consequences-results';
  const buttonClass = 'visioner-btn-consequences';
  const panelClass = 'consequences-panel';

  let actionButtonsHtml = '';
  if (game.user.isGM) {
    actionButtonsHtml = `
      <button type="button"
              class="visioner-btn ${buttonClass}"
              data-action="${actionName}"
              data-tooltip="${tooltip}">
        <i class="${icon}"></i> ${label}
      </button>
      <button type="button"
              class="visioner-btn ${buttonClass} apply-now"
              data-action="apply-now-consequences"
              data-tooltip="${game.i18n.localize('PF2E_VISIONER.UI.APPLY_WITHOUT_DIALOG')}">
        <i class="fas fa-check-double"></i> Apply Changes
      </button>`;
  }

  return { title, icon, panelClass, actionButtonsHtml };
}
