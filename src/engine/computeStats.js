import { getNatureMultiplier } from '../data/natures.js';

export const DEFAULT_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

export function computeStats(baseStats, evs = DEFAULT_EVS, nature = 'Hardy') {
  const ev = (k) => Math.floor((evs[k] ?? 0) / 4);

  const hp = Math.floor((2 * baseStats.hp + 31 + ev('hp')) * 50 / 100) + 60;

  const stat = (k) => Math.floor(
    (Math.floor((2 * baseStats[k] + 31 + ev(k)) * 50 / 100) + 5)
    * getNatureMultiplier(nature, k)
  );

  return {
    hp,
    atk: stat('atk'),
    def: stat('def'),
    spa: stat('spa'),
    spd: stat('spd'),
    spe: stat('spe'),
  };
}
