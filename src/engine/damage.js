/**
 * Pokémon Champions Double Battle Damage Calculator
 *
 * Formula (Gen 9 standard):
 *   BaseDamage = floor((floor(2*Lv/5+2) * Power * atkStat / defStat) / 50) + 2
 *   Final      = floor(BaseDamage * Spread * Weather * Crit * Random * STAB * Type * Burn * Item * HelpingHand)
 */

import { getTypeMultiplier } from '../data/types.js';
import { WEIGHTS, weightRatioPower, weightBracketPower } from '../data/weights.js';

const RECOIL_FRACTION = {
  'brave-bird':   1 / 3,
  'double-edge':  1 / 3,
  'flare-blitz':  1 / 3,
  'head-smash':   1 / 2,
  'volt-tackle':  1 / 3,
  'wave-crash':   1 / 3,
  'wild-charge':  1 / 4,
  'wood-hammer':  1 / 3,
};

const LEVEL = 50;

// ─── Move category sets (for ability checks) ──────────────────────────────────

const PUNCH_MOVES = new Set([
  'bullet-punch', 'comet-punch', 'dizzy-punch', 'double-iron-bash',
  'drain-punch', 'dynamic-punch', 'fire-punch', 'focus-punch',
  'hammer-arm', 'ice-punch', 'jet-punch', 'mach-punch', 'mega-punch',
  'meteor-mash', 'power-up-punch', 'shadow-punch', 'sky-uppercut',
  'strength', 'thunder-punch', 'surging-strikes',
]);

const BITE_MOVES = new Set([
  'bite', 'crunch', 'fire-fang', 'ice-fang', 'thunder-fang',
  'hyper-fang', 'poison-fang', 'psychic-fangs', 'jaw-lock',
]);

const PULSE_MOVES = new Set([
  'aura-sphere', 'dark-pulse', 'dragon-pulse', 'heal-pulse',
  'origin-pulse', 'terrain-pulse', 'water-pulse',
]);

const SLICING_MOVES = new Set([
  'aerial-ace', 'air-cutter', 'aqua-cutter', 'bitter-blade',
  'ceaseless-edge', 'cross-poison', 'cut', 'fury-cutter',
  'kowtow-cleave', 'leaf-blade', 'night-slash', 'psycho-cut',
  'razor-leaf', 'razor-shell', 'sacred-sword', 'secret-sword',
  'slash', 'solar-blade', 'stone-axe', 'tachyon-cutter',
  'triple-axel', 'x-scissor', 'behemoth-blade',
]);

// Physical moves that do NOT make contact (Tough Claws does not boost these)
const NON_CONTACT_PHYSICAL = new Set([
  'earthquake', 'magnitude', 'bulldoze', 'fissure',
  'thousand-arrows', 'thousand-waves', 'precipice-blades', 'land-wrath',
  'rock-slide', 'rock-blast', 'rock-tomb', 'rock-wrecker', 'smack-down',
  'seed-bomb', 'bullet-seed', 'pin-missile', 'icicle-spear',
  'bone-rush', 'self-destruct', 'explosion',
  'water-shuriken', 'stone-edge', 'stomping-tantrum', 'sand-tomb',
]);

function isContactMove(move) {
  if (move.category !== 'physical') return false;
  return !NON_CONTACT_PHYSICAL.has(move.id);
}

// ─── Proto/Quark Drive helper ─────────────────────────────────────────────────

function getProtoQuarkBoost(stats, ability, weather, terrain) {
  if (ability === 'Protosynthesis' && weather !== 'Sun') return null;
  if (ability === 'Quark Drive' && terrain !== 'Electric') return null;
  if (ability !== 'Protosynthesis' && ability !== 'Quark Drive') return null;

  const keys = ['atk', 'def', 'spa', 'spd', 'spe'];
  const highest = keys.reduce((best, k) => (stats[k] > stats[best] ? k : best), keys[0]);
  return { stat: highest, mult: highest === 'spe' ? 1.5 : 1.3 };
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function applyBoost(stat, stage) {
  if (stage === 0) return stat;
  if (stage > 0) return Math.floor(stat * (2 + stage) / 2);
  return Math.floor(stat * 2 / (2 - stage));
}

function getAtkStat(slot, category, moveId, field = {}) {
  if (moveId === 'body-press') {
    return applyBoost(slot.stats.def, slot.defBoost ?? 0);
  }
  const base  = category === 'physical' ? slot.stats.atk : slot.stats.spa;
  const boost = category === 'physical' ? (slot.atkBoost ?? 0) : (slot.spaBoost ?? 0);
  let stat = applyBoost(base, boost);

  // Huge Power / Pure Power: double physical attack
  if (category === 'physical' && (slot.ability === 'Huge Power' || slot.ability === 'Pure Power')) {
    stat *= 2;
  }

  // Hustle: ×1.5 physical attack (accuracy drop ignored)
  if (category === 'physical' && slot.ability === 'Hustle') {
    stat = Math.floor(stat * 1.5);
  }

  // Guts: ×1.5 Atk when burned (burn penalty is already bypassed in burnModifier)
  if (category === 'physical' && slot.ability === 'Guts' && field.isBurned) {
    stat = Math.floor(stat * 1.5);
  }

  // Solar Power: ×1.5 SpA in Sun
  if (category === 'special' && slot.ability === 'Solar Power' && field.weather === 'Sun') {
    stat = Math.floor(stat * 1.5);
  }

  // Protosynthesis / Quark Drive: boost highest stat
  const proto = getProtoQuarkBoost(slot.stats, slot.ability, field.weather, field.terrain);
  if (proto) {
    const relevantStat = category === 'physical' ? 'atk' : 'spa';
    if (proto.stat === relevantStat) stat = Math.floor(stat * proto.mult);
  }

  return stat;
}

function getDefStat(slot, category, wonderRoom = false, field = {}) {
  const flipped = wonderRoom ? (category === 'physical' ? 'special' : 'physical') : category;
  const base  = flipped === 'physical' ? slot.stats.def : slot.stats.spd;
  const boost = flipped === 'physical' ? (slot.defBoost ?? 0) : (slot.spdBoost ?? 0);
  let stat = applyBoost(base, boost);

  // Protosynthesis / Quark Drive on defender
  const proto = getProtoQuarkBoost(slot.stats, slot.ability, field.weather, field.terrain);
  if (proto) {
    const relevantStat = flipped === 'physical' ? 'def' : 'spd';
    if (proto.stat === relevantStat) stat = Math.floor(stat * proto.mult);
  }

  return stat;
}

/** Effective Speed after boost stages and Tailwind (×2) */
function getSpeStat(slot, hasTailwind) {
  let spe = applyBoost(slot.stats.spe, slot.speBoost ?? 0);
  if (hasTailwind) spe = spe * 2;
  return spe;
}

// ─── Variable-power move formulas ────────────────────────────────────────────

function computeEffectivePower(move, attacker, defender, atkSpe, defSpe) {
  switch (move.id) {
    case 'gyro-ball':
      return atkSpe > 0 ? Math.min(150, Math.floor(25 * defSpe / atkSpe)) : 1;

    case 'electro-ball': {
      const ratio = defSpe > 0 ? Math.floor(atkSpe / defSpe) : 4;
      if (ratio >= 4) return 150;
      if (ratio >= 3) return 120;
      if (ratio >= 2) return 80;
      if (ratio >= 1) return 60;
      return 40;
    }

    case 'heavy-slam':
    case 'heat-crash': {
      const aw = WEIGHTS[attacker.pokemon.id];
      const dw = WEIGHTS[defender.pokemon.id];
      if (aw == null || dw == null) return 80;
      return weightRatioPower(aw, dw);
    }

    case 'grass-knot':
    case 'low-kick': {
      const dw = WEIGHTS[defender.pokemon.id];
      if (dw == null) return 80;
      return weightBracketPower(dw);
    }

    case 'acrobatics':
      return (attacker.item === 'None' || !attacker.item) ? 110 : 55;

    case 'stored-power': {
      const boosts = [
        attacker.atkBoost ?? 0,
        attacker.spaBoost ?? 0,
        attacker.defBoost ?? 0,
        attacker.spdBoost ?? 0,
        attacker.speBoost ?? 0,
      ];
      const total = boosts.reduce((sum, b) => sum + Math.max(0, b), 0);
      return 20 + 20 * total;
    }

    default:
      return move.power;
  }
}

// ─── Modifier calculators ─────────────────────────────────────────────────────

function spreadModifier(move, targetCount) {
  if (move.spread && targetCount > 1) return 0.75;
  return 1;
}

function weatherModifier(moveType, weather) {
  if (weather === 'Sun') {
    if (moveType === 'Fire')  return 1.5;
    if (moveType === 'Water') return 0.5;
  }
  if (weather === 'Rain') {
    if (moveType === 'Water') return 1.5;
    if (moveType === 'Fire')  return 0.5;
  }
  return 1;
}

function terrainModifier(moveType, terrain, attackerTypes, defenderTypes, gravity = false) {
  if (!terrain || terrain === 'None') return 1;
  const isGrounded = (types) => gravity || !types.includes('Flying');
  if (terrain === 'Electric' && moveType === 'Electric' && isGrounded(attackerTypes)) return 1.3;
  if (terrain === 'Grassy'   && moveType === 'Grass'    && isGrounded(attackerTypes)) return 1.3;
  if (terrain === 'Psychic'  && moveType === 'Psychic'  && isGrounded(attackerTypes)) return 1.3;
  if (terrain === 'Misty'    && moveType === 'Dragon'   && isGrounded(defenderTypes)) return 0.5;
  return 1;
}

function critModifier(isCrit) {
  return isCrit ? 1.5 : 1;
}

function stabModifier(effectiveMoveType, attackerTypes, ability) {
  if (!attackerTypes.includes(effectiveMoveType)) return 1;
  return ability === 'Adaptability' ? 2 : 1.5;
}

function burnModifier(isBurned, category, ability) {
  if (isBurned && category === 'physical' && ability !== 'Guts') return 0.5;
  return 1;
}

function screenModifier(field, category, isCrit, attackerAbility) {
  if (isCrit || attackerAbility === 'Infiltrator') return 1;
  if (field.auroraVeil) return 2 / 3;
  if (field.reflect && category === 'physical') return 2 / 3;
  if (field.lightScreen && category === 'special') return 2 / 3;
  return 1;
}

function itemModifier(item, category, moveType, magicRoom = false) {
  if (magicRoom) return 1;
  if (item === 'Choice Band'    && category === 'physical') return 1.5;
  if (item === 'Choice Specs'   && category === 'special')  return 1.5;
  if (item === 'Life Orb')                                   return 1.3;
  if (item === 'Muscle Band'    && category === 'physical') return 1.1;
  if (item === 'Wise Glasses'   && category === 'special')  return 1.1;
  if (item === 'Black Glasses'  && moveType === 'Dark')     return 1.2;
  if (item === 'Charcoal'       && moveType === 'Fire')     return 1.2;
  if (item === 'Mystic Water'   && moveType === 'Water')    return 1.2;
  if (item === 'Never-Melt Ice' && moveType === 'Ice')      return 1.2;
  if (item === 'Miracle Seed'   && moveType === 'Grass')    return 1.2;
  if (item === 'Twisted Spoon'  && moveType === 'Psychic')  return 1.2;
  if (item === 'Sharp Beak'     && moveType === 'Flying')   return 1.2;
  if (item === 'Dragon Fang'    && moveType === 'Dragon')   return 1.2;
  if (item === 'Silk Scarf'     && moveType === 'Normal')   return 1.2;
  if (item === 'Silver Powder'  && moveType === 'Bug')      return 1.2;
  if (item === 'Hard Stone'     && moveType === 'Rock')     return 1.2;
  if (item === 'Spell Tag'      && moveType === 'Ghost')    return 1.2;
  if (item === 'Poison Barb'    && moveType === 'Poison')   return 1.2;
  if (item === 'Soft Sand'      && moveType === 'Ground')   return 1.2;
  if (item === 'Magnet'         && moveType === 'Electric') return 1.2;
  if (item === 'Metal Coat'     && moveType === 'Steel')    return 1.2;
  if (item === 'Black Belt'     && moveType === 'Fighting') return 1.2;
  if (item === 'Fairy Feather'  && moveType === 'Fairy')    return 1.2;
  return 1;
}

/**
 * Attacker ability damage multiplier.
 * effectiveMoveType: after Pixilate/etc. transformation
 * originalMoveType: before transformation
 */
function abilityAtkModifier(ability, move, effectiveMoveType, originalMoveType, weather, terrain) {
  // Type-changing abilities: ×1.2 boost when a Normal move is transformed
  if (
    originalMoveType === 'Normal' && effectiveMoveType !== 'Normal' &&
    (ability === 'Pixilate' || ability === 'Refrigerate' || ability === 'Aerilate' || ability === 'Galvanize')
  ) return 1.2;

  // Ancient power boost (SpA in Sun via Hadron/Orichalcum already existed)
  if (ability === 'Hadron Engine'    && terrain === 'Electric') return 1.3333;
  if (ability === 'Orichalcum Pulse' && weather === 'Sun')      return 1.3333;

  // Technician: ×1.5 for moves with base power ≤ 60
  if (ability === 'Technician' && move.power > 0 && move.power <= 60) return 1.5;

  // Strong Jaw: ×1.5 for biting moves
  if (ability === 'Strong Jaw'   && BITE_MOVES.has(move.id))  return 1.5;

  // Iron Fist: ×1.2 for punching moves
  if (ability === 'Iron Fist'    && PUNCH_MOVES.has(move.id)) return 1.2;

  // Mega Launcher: ×1.5 for pulse moves
  if (ability === 'Mega Launcher' && PULSE_MOVES.has(move.id)) return 1.5;

  // Sharpness: ×1.5 for slicing moves
  if (ability === 'Sharpness'    && SLICING_MOVES.has(move.id)) return 1.5;

  // Reckless: ×1.2 for recoil moves and Struggle
  if (ability === 'Reckless' && (RECOIL_FRACTION[move.id] || move.id === 'struggle')) return 1.2;

  // Tough Claws: ×1.3 for contact moves
  if (ability === 'Tough Claws'  && isContactMove(move)) return 1.3;

  // Sand Force: ×1.3 for Rock/Steel/Ground in Sand
  if (ability === 'Sand Force' && weather === 'Sand' &&
      ['Rock', 'Steel', 'Ground'].includes(effectiveMoveType)) return 1.3;

  // Water Bubble: ×2 for Water moves (attack)
  if (ability === 'Water Bubble' && effectiveMoveType === 'Water') return 2;

  return 1;
}

/**
 * Defender ability immunity check — returns true if the move is fully negated.
 */
function abilityDefImmune(ability, moveType, gravity) {
  if (ability === 'Water Absorb'  && moveType === 'Water')    return true;
  if (ability === 'Flash Fire'    && moveType === 'Fire')      return true;
  if (ability === 'Lightning Rod' && moveType === 'Electric')  return true;
  if (ability === 'Motor Drive'   && moveType === 'Electric')  return true;
  if (ability === 'Storm Drain'   && moveType === 'Water')     return true;
  if (ability === 'Sap Sipper'    && moveType === 'Grass')     return true;
  if (ability === 'Volt Absorb'   && moveType === 'Electric')  return true;
  if (ability === 'Earth Eater'   && moveType === 'Ground')    return true;
  if (ability === 'Levitate'      && moveType === 'Ground' && !gravity) return true;
  return false;
}

/**
 * Defender ability damage multiplier (non-immunity reductions).
 * Applied after type effectiveness is known.
 */
function abilityDefModifier(ability, moveType, category, rawTypeMultiplier) {
  // Thick Fat: ×0.5 vs Fire and Ice
  if (ability === 'Thick Fat' && (moveType === 'Fire' || moveType === 'Ice')) return 0.5;

  // Filter / Solid Rock: ×0.75 for super-effective hits
  if ((ability === 'Filter' || ability === 'Solid Rock') && rawTypeMultiplier > 1) return 0.75;

  // Fur Coat: ×0.5 for physical moves
  if (ability === 'Fur Coat' && category === 'physical') return 0.5;

  // Water Bubble (defense): ×0.5 for Fire moves
  if (ability === 'Water Bubble' && moveType === 'Fire') return 0.5;

  // Heatproof: ×0.5 for Fire moves
  if (ability === 'Heatproof' && moveType === 'Fire') return 0.5;

  // Purifying Salt: ×0.5 for Ghost moves
  if (ability === 'Purifying Salt' && moveType === 'Ghost') return 0.5;

  // Multiscale: ×0.5 (assumed full HP)
  if (ability === 'Multiscale') return 0.5;

  return 1;
}

function defenderItemModifier(item, rawTypeMultiplier, magicRoom = false) {
  if (magicRoom) return 1;
  if (item === 'Resistance Berry' && rawTypeMultiplier > 1) return 0.5;
  return 1;
}

function ruinAbilityDefModifier(attackerAbility, category) {
  if (attackerAbility === 'Sword of Ruin'   && category === 'physical') return 0.75;
  if (attackerAbility === 'Beads of Ruin'   && category === 'special')  return 0.75;
  if (attackerAbility === 'Tablets of Ruin' && category === 'physical') return 0.75;
  if (attackerAbility === 'Vessel of Ruin'  && category === 'special')  return 0.75;
  return 1;
}

// ─── Core formula ─────────────────────────────────────────────────────────────

export function calculateDamage({ attacker, defender, move, field, targetCount = 1 }) {
  if (!move || move.category === 'status') {
    return { min: 0, max: 0, typeMultiplier: 0, isStatus: true };
  }

  const { category } = move;
  const gravity = field.gravity ?? false;

  // Resolve effective move type (Pixilate/Refrigerate/Aerilate/Galvanize change Normal moves)
  const originalMoveType = move.type;
  let effectiveMoveType = originalMoveType;
  if (originalMoveType === 'Normal') {
    if (attacker.ability === 'Pixilate')   effectiveMoveType = 'Fairy';
    else if (attacker.ability === 'Refrigerate') effectiveMoveType = 'Ice';
    else if (attacker.ability === 'Aerilate')    effectiveMoveType = 'Flying';
    else if (attacker.ability === 'Galvanize')   effectiveMoveType = 'Electric';
  }

  // Type effectiveness
  let rawTypeMultiplier = getTypeMultiplier(effectiveMoveType, defender.pokemon.types);

  // Gravity grounds Flying types — remove their Ground immunity
  if (gravity && effectiveMoveType === 'Ground' && defender.pokemon.types.includes('Flying')) {
    rawTypeMultiplier = getTypeMultiplier(effectiveMoveType, defender.pokemon.types.filter(t => t !== 'Flying'));
    if (rawTypeMultiplier === 0) rawTypeMultiplier = 1;
  }

  // Scrappy: Normal and Fighting moves ignore Ghost immunity
  if (attacker.ability === 'Scrappy' &&
      (effectiveMoveType === 'Normal' || effectiveMoveType === 'Fighting') &&
      rawTypeMultiplier === 0) {
    rawTypeMultiplier = 1;
  }

  // Immunity abilities
  if (abilityDefImmune(defender.ability, effectiveMoveType, gravity)) {
    return { min: 0, max: 0, typeMultiplier: 0, isImmune: true };
  }

  if (rawTypeMultiplier === 0) {
    return { min: 0, max: 0, typeMultiplier: 0, isImmune: true };
  }

  // Defender damage modifiers (Thick Fat, Filter, Fur Coat, Multiscale, etc.)
  const defAbilMod = abilityDefModifier(defender.ability, effectiveMoveType, category, rawTypeMultiplier);

  // Effective speeds (needed for Gyro Ball / Electro Ball)
  const atkSpe = getSpeStat(attacker, field.tailwindAttacker ?? false);
  const defSpe = getSpeStat(defender, field.tailwindDefender ?? false);

  // Effective power
  const power = computeEffectivePower(move, attacker, defender, atkSpe, defSpe);
  if (power === 0) return { min: 0, max: 0, typeMultiplier: 0, isStatus: true };

  // Offensive and defensive stats
  const atkStat = getAtkStat(attacker, category, move.id, field);
  const defStat = getDefStat(defender, category, field.wonderRoom ?? false, field);

  // Base damage
  const base = Math.floor(
    (Math.floor(2 * LEVEL / 5 + 2) * power * atkStat / defStat) / 50
  ) + 2;

  // Modifiers
  const spread   = spreadModifier(move, targetCount);
  const weather  = weatherModifier(effectiveMoveType, field.weather);
  const terrain  = terrainModifier(effectiveMoveType, field.terrain, attacker.pokemon.types, defender.pokemon.types, gravity);
  const crit     = critModifier(field.isCrit || move.alwaysCrit);
  const stab     = stabModifier(effectiveMoveType, attacker.pokemon.types, attacker.ability);
  const type     = rawTypeMultiplier;
  const burn     = burnModifier(field.isBurned, category, attacker.ability);
  const item     = itemModifier(attacker.item, category, effectiveMoveType, field.magicRoom ?? false);
  const atkAbil  = abilityAtkModifier(attacker.ability, move, effectiveMoveType, originalMoveType, field.weather, field.terrain);
  const ruin     = ruinAbilityDefModifier(attacker.ability, category);
  const defItem  = defenderItemModifier(defender.item, rawTypeMultiplier, field.magicRoom ?? false);
  const hh       = field.helpingHand ? 1.5 : 1;
  const screen   = screenModifier(field, category, field.isCrit || move.alwaysCrit, attacker.ability);
  const grassyEQ = (field.terrain === 'Grassy' && move.id === 'earthquake') ? 0.5 : 1;

  // Apply pre-random modifiers
  let dmg = base;
  dmg = Math.floor(dmg * spread);
  dmg = Math.floor(dmg * weather);
  dmg = Math.floor(dmg * terrain);
  dmg = Math.floor(dmg * grassyEQ);
  dmg = Math.floor(dmg * crit);

  const preRandom    = dmg;
  const minPreRandom = Math.floor(preRandom * 0.85);

  const applyPost = (v) => {
    let x = v;
    x = Math.floor(x * stab);
    x = Math.floor(x * type);
    x = Math.floor(x * defAbilMod);
    x = Math.floor(x * burn);
    x = Math.floor(x * item);
    x = Math.floor(x * atkAbil);
    x = Math.floor(x * ruin);
    x = Math.floor(x * defItem);
    x = Math.floor(x * hh);
    x = Math.floor(x * screen);
    return x;
  };

  // Collect active ability/item effects for UI display
  const fmt = (n) => {
    if (Math.abs(n - 4 / 3) < 0.001) return '×4/3';
    if (Math.abs(n - 2 / 3) < 0.001) return '×2/3';
    const s = n.toString();
    return `×${s}`;
  };

  const activeEffects = [];

  // Type-changing abilities (combine with their ×1.2 boost into one label)
  if (effectiveMoveType !== originalMoveType) {
    activeEffects.push({ label: `${attacker.ability} → ${effectiveMoveType} ×1.2`, color: 'text-pink-400' });
  } else if (atkAbil !== 1) {
    // Attacker ability damage multiplier (only when not already shown via type change)
    activeEffects.push({ label: `${attacker.ability} ${fmt(atkAbil)}`, color: 'text-green-400' });
  }

  // Stat-boosting abilities (affect atkStat, not a post modifier)
  if (category === 'physical' && (attacker.ability === 'Huge Power' || attacker.ability === 'Pure Power')) {
    activeEffects.push({ label: `${attacker.ability} ×2 Atk`, color: 'text-green-400' });
  }
  if (category === 'physical' && attacker.ability === 'Hustle') {
    activeEffects.push({ label: 'Hustle ×1.5 Atk', color: 'text-green-400' });
  }
  if (category === 'physical' && attacker.ability === 'Guts' && field.isBurned) {
    activeEffects.push({ label: 'Guts ×1.5 Atk', color: 'text-green-400' });
  }
  if (category === 'special' && attacker.ability === 'Solar Power' && field.weather === 'Sun') {
    activeEffects.push({ label: 'Solar Power ×1.5 SpA', color: 'text-green-400' });
  }
  const proto = getProtoQuarkBoost(attacker.stats, attacker.ability, field.weather, field.terrain);
  if (proto) {
    const relevantStat = category === 'physical' ? 'atk' : 'spa';
    if (proto.stat === relevantStat) {
      activeEffects.push({ label: `${attacker.ability} ${fmt(proto.mult)} ${proto.stat.toUpperCase()}`, color: 'text-green-400' });
    }
  }

  // Adaptability STAB
  if (attacker.ability === 'Adaptability' && stab === 2) {
    activeEffects.push({ label: 'Adaptability ×2 STAB', color: 'text-green-400' });
  }

  // Ruin abilities
  if (ruin !== 1) {
    activeEffects.push({ label: `${attacker.ability} ${fmt(ruin)} Def`, color: 'text-green-400' });
  }

  // Defender ability damage modifier
  if (defAbilMod !== 1) {
    activeEffects.push({ label: `${defender.ability} ${fmt(defAbilMod)}`, color: 'text-red-400' });
  }

  // Defender item
  if (defItem !== 1) {
    activeEffects.push({ label: `Resist Berry ${fmt(defItem)}`, color: 'text-red-400' });
  }

  return {
    min: applyPost(minPreRandom),
    max: applyPost(preRandom),
    typeMultiplier: rawTypeMultiplier,
    effectivePower: power,
    activeEffects,
    isImmune: false,
    isStatus: false,
  };
}

export function getFullResult({ attacker, defender, move, field, targetCount = 1 }) {
  const raw = calculateDamage({ attacker, defender, move, field, targetCount });

  if (raw.isStatus || raw.isImmune) return { ...raw, pctMin: 0, pctMax: 0, koChance: 'No damage' };

  const defHP = defender.stats.hp;
  const atkHP = attacker.stats.hp;

  let hits = (move.id === 'dragon-darts' && targetCount === 2) ? 1 : (move.hits ?? 1);
  let minTotal, maxTotal;

  // Triple Axel: three hits at escalating power 20 / 40 / 60
  if (move.id === 'triple-axel' && !raw.isStatus && !raw.isImmune) {
    const h1 = calculateDamage({ attacker, defender, move: { ...move, power: 20 }, field, targetCount });
    const h2 = calculateDamage({ attacker, defender, move: { ...move, power: 40 }, field, targetCount });
    const h3 = calculateDamage({ attacker, defender, move: { ...move, power: 60 }, field, targetCount });
    minTotal = h1.min + h2.min + h3.min;
    maxTotal = h1.max + h2.max + h3.max;
    hits = 3;
  } else if (attacker.ability === 'Parental Bond' && move.hits == null && !raw.isStatus && !raw.isImmune) {
    const secondMin = Math.floor(raw.min * 0.25);
    const secondMax = Math.floor(raw.max * 0.25);
    minTotal = raw.min + secondMin;
    maxTotal = raw.max + secondMax;
    hits = 2;
  } else {
    minTotal = raw.min * hits;
    maxTotal = raw.max * hits;
  }

  const pctMin = +((minTotal / defHP) * 100).toFixed(1);
  const pctMax = +((maxTotal / defHP) * 100).toFixed(1);

  let koChance;
  if (raw.isImmune)       koChance = 'Immune';
  else if (pctMin >= 100) koChance = 'Guaranteed KO';
  else if (pctMax >= 100) koChance = 'Possible KO';
  else if (pctMax >= 50)  koChance = '2HKO range';
  else                    koChance = 'Not a KO';

  // Recoil
  let recoil = null;
  if (move.id === 'struggle') {
    const hp = Math.floor(atkHP / 4);
    recoil = { min: hp, max: hp, pctMin: +((hp / atkHP) * 100).toFixed(1), pctMax: +((hp / atkHP) * 100).toFixed(1) };
  } else if (RECOIL_FRACTION[move.id]) {
    const frac = RECOIL_FRACTION[move.id];
    const rMin = Math.floor(minTotal * frac);
    const rMax = Math.floor(maxTotal * frac);
    recoil = {
      min: rMin,
      max: rMax,
      pctMin: +((rMin / atkHP) * 100).toFixed(1),
      pctMax: +((rMax / atkHP) * 100).toFixed(1),
    };
  }

  return { ...raw, minTotal, maxTotal, pctMin, pctMax, koChance, hits, recoil };
}
