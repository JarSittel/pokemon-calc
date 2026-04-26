import { POKEMON } from './pokemon.js';

// Each format defines:
//   filter(pokemon)      → bool: is this Pokémon in the legal pool at all?
//   maxRestricted        → how many restricted Pokémon are allowed across all 4 slots
//   description          → shown in the UI tooltip

// Pokémon Champions Regulation M-A legal list (explicit allowlist)
// Source: serebii.net/pokemonchampions/rankedbattle/regulationm-a.shtml
// Bans: Paradox Pokémon, box legendaries, Treasures of Ruin, Urshifu, Rillaboom, Amoonguss, Gholdengo, etc.
const REG_MA_LEGAL = new Set([
  'incineroar', 'farigiraf', 'dragonite', 'garchomp', 'whimsicott',
  'palafin-hero', 'kingambit', 'dragapult', 'toxapex', 'corviknight',
  'gardevoir', 'tyranitar', 'arcanine', 'volcarona', 'hatterene',
  // batch 1
  'venusaur', 'charizard', 'blastoise', 'beedrill', 'pidgeot',
  'arbok', 'pikachu', 'raichu', 'raichu-alola', 'clefable',
  // batch 2
  'ninetales', 'ninetales-alola', 'arcanine-hisui', 'alakazam', 'machamp',
  'victreebel', 'slowbro', 'slowbro-galar', 'gengar', 'kangaskhan',
  // batch 3
  'starmie', 'pinsir', 'tauros', 'tauros-paldea', 'gyarados',
  'ditto', 'vaporeon', 'jolteon', 'flareon', 'aerodactyl',
  // batch 4
  'snorlax', 'meganium', 'typhlosion', 'typhlosion-hisui', 'feraligatr',
  'ariados', 'ampharos', 'azumarill', 'politoed', 'espeon',
  // batch 5
  'umbreon', 'slowking', 'slowking-galar', 'forretress', 'steelix',
  'scizor', 'heracross', 'skarmory', 'houndoom', 'pelipper',
  // batch 6
  'sableye', 'aggron', 'medicham', 'manectric', 'sharpedo',
  'camerupt', 'torkoal', 'altaria', 'milotic', 'castform',
  // batch 7
  'banette', 'chimecho', 'absol', 'glalie', 'torterra',
  'infernape', 'empoleon', 'luxray', 'roserade', 'rampardos',
  // batch 8
  'bastiodon', 'lopunny', 'spiritomb', 'lucario', 'hippowdon',
  'toxicroak', 'abomasnow', 'weavile', 'rhyperior', 'leafeon',
  // batch 9
  'glaceon', 'gliscor', 'mamoswine', 'gallade', 'froslass',
  'rotom', 'serperior', 'emboar', 'samurott', 'samurott-hisui',
  // batch 10
  'patrat', 'liepard', 'simisage', 'simisear', 'simipour',
  'excadrill', 'audino', 'conkeldurr', 'krookodile', 'cofagrigus',
  // batch 11
  'garbodor', 'zoroark', 'zoroark-hisui', 'reuniclus', 'vanilluxe',
  'emolga', 'chandelure', 'beartic', 'stunfisk', 'stunfisk-galar',
  // batch 12
  'golurk', 'hydreigon', 'chesnaught', 'delphox', 'greninja',
  'diggersby', 'talonflame', 'vivillon', 'floette', 'floette-eternal',
  // batch 13
  'florges', 'pangoro', 'furfrou', 'meowstic', 'aegislash-shield',
  'aegislash-blade', 'aromatisse', 'slurpuff', 'clawitzer', 'heliolisk',
  // batch 14
  'tyrantrum', 'aurorus', 'sylveon', 'hawlucha', 'dedenne',
  'goodra', 'goodra-hisui', 'klefki', 'trevenant', 'gourgeist',
  // batch 15
  'avalugg', 'avalugg-hisui', 'noivern', 'decidueye', 'decidueye-hisui',
  'primarina', 'toucannon', 'crabominable', 'lycanroc', 'mudsdale',
  // batch 16
  'araquanid', 'salazzle', 'tsareena', 'oranguru', 'passimian',
  'mimikyu', 'drampa', 'kommo-o', 'flapple', 'appletun',
  // batch 17
  'sandaconda', 'polteageist', 'mr-rime', 'runerigus', 'alcremie',
  'morpeko', 'wyrdeer', 'kleavor', 'basculegion', 'sneasler',
  // batch 18
  'meowscarada', 'skeledirge', 'quaquaval', 'maushold', 'garganacl',
  'armarouge', 'ceruledge', 'bellibolt', 'scovillain', 'espathra',
  // batch 19
  'tinkaton', 'orthworm', 'glimmora', 'sinistcha', 'archaludon', 'hydrapple',
  // mega batch 1
  'venusaur-mega', 'charizard-mega-x', 'charizard-mega-y', 'blastoise-mega',
  'beedrill-mega', 'pidgeot-mega', 'alakazam-mega', 'slowbro-mega',
  'gengar-mega', 'kangaskhan-mega',
  // mega batch 2
  'pinsir-mega', 'gyarados-mega', 'aerodactyl-mega', 'ampharos-mega',
  'scizor-mega', 'heracross-mega', 'houndoom-mega', 'tyranitar-mega',
  'aggron-mega', 'medicham-mega',
  // mega batch 3
  'manectric-mega', 'sharpedo-mega', 'camerupt-mega', 'altaria-mega',
  'banette-mega', 'absol-mega', 'glalie-mega', 'garchomp-mega',
  'lucario-mega', 'lopunny-mega', 'abomasnow-mega', 'gallade-mega', 'audino-mega',
  // mega batch 4
  'gardevoir-mega', 'sableye-mega', 'steelix-mega', 'clefable-mega',
  'victreebel-mega', 'starmie-mega', 'dragonite-mega', 'meganium-mega',
  'feraligatr-mega', 'skarmory-mega',
  // mega batch 5
  'chimecho-mega', 'froslass-mega', 'emboar-mega', 'excadrill-mega',
  'chandelure-mega', 'golurk-mega', 'chesnaught-mega', 'delphox-mega',
  'greninja-mega', 'floette-mega',
  // mega batch 6
  'meowstic-mega', 'hawlucha-mega', 'crabominable-mega', 'drampa-mega',
  'scovillain-mega', 'glimmora-mega',
]);

export const FORMATS = [
  {
    id: 'reg-m-a',
    name: 'Regulation M-A',
    badge: 'Reg M-A',
    description: 'Pokémon Champions current format. Bans Paradox Pokémon, box legendaries, Urshifu, Rillaboom, Amoonguss, Gholdengo, and more.',
    filter: (p) => REG_MA_LEGAL.has(p.id),
    maxRestricted: Infinity,
    isCurrent: true,
  },
  {
    id: 'open',
    name: 'Open',
    badge: 'All',
    description: 'No restrictions — every Pokémon and move is available.',
    filter: () => true,
    maxRestricted: Infinity,
  },
];

export const DEFAULT_FORMAT = FORMATS[0]; // Reg M-A is now the default

/** Returns the subset of POKEMON legal in a given format, sorted alphabetically. */
export function legalPokemon(format) {
  return POKEMON.filter(format.filter).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validates all 4 slots against format rules.
 * Returns an array of per-slot violation strings (empty string = no violation).
 */
export function validateSlots(slots, format) {
  const legalIds = new Set(legalPokemon(format).map(p => p.id));

  // Count how many restricted Pokémon are present across all slots
  const restrictedCount = slots.filter(s => s.pokemon.isRestricted).length;

  return slots.map((slot) => {
    if (!legalIds.has(slot.pokemon.id)) return 'Not legal in this format';
    if (slot.pokemon.isRestricted && restrictedCount > format.maxRestricted) {
      return `Restricted — max ${format.maxRestricted} per team`;
    }
    return '';
  });
}
