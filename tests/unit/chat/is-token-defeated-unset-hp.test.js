import '../../setup.js';

import { isTokenDefeated } from '../../../scripts/chat/services/infra/shared-utils.js';

function tokenWithHp(value, max) {
  return { name: 'pc', actor: { isDead: false, system: { attributes: { hp: { value, max } } }, itemTypes: { condition: [] } } };
}

describe('isTokenDefeated with unset hit points', () => {
  test('a blank actor with 0 of 0 HP is not defeated', () => {
    expect(isTokenDefeated(tokenWithHp(0, 0))).toBe(false);
  });

  test('an actor at 0 of positive max HP is defeated', () => {
    expect(isTokenDefeated(tokenWithHp(0, 20))).toBe(true);
  });

  test('an actor with HP left is not defeated', () => {
    expect(isTokenDefeated(tokenWithHp(5, 20))).toBe(false);
  });
});
