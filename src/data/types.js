// Full Gen 9 type effectiveness chart
// chart[attackType][defendType] = multiplier

const TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

// Raw effectiveness table: rows = attacking type, cols = defending type (same order as TYPES)
const RAW = [
  // Nor  Fir  Wat  Ele  Gra  Ice  Fig  Poi  Gro  Fly  Psy  Bug  Roc  Gho  Dra  Dar  Ste  Fai
  [  1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,  .5,   0,   1,   1,  .5,   1  ], // Normal
  [  1,  .5,  .5,   1,   2,   2,   1,   1,   1,   1,   1,   2,  .5,   1,  .5,   1,   2,   1  ], // Fire
  [  1,   2,  .5,   1,  .5,   1,   1,   1,   2,   1,   1,   1,   2,   1,  .5,   1,   1,   1  ], // Water
  [  1,   1,   2,  .5,  .5,   1,   1,   1,   0,   2,   1,   1,   1,   1,  .5,   1,   1,   1  ], // Electric
  [  1,  .5,   2,   1,  .5,   1,   1,  .5,   2,  .5,   1,  .5,   2,   1,  .5,   1,  .5,   1  ], // Grass
  [  1,  .5,  .5,   1,   2,  .5,   1,   1,   2,   2,   1,   1,   1,   1,   2,   1,  .5,   1  ], // Ice
  [  2,   1,   1,   1,   1,   2,   1,  .5,   1,  .5,  .5,  .5,   2,   0,   1,   2,   2,  .5  ], // Fighting
  [  1,   1,   1,   1,   2,   1,   1,  .5,  .5,   1,   1,   1,  .5,  .5,   1,   1,   0,   2  ], // Poison
  [  1,   2,   1,   2,  .5,   1,   1,   2,   1,   0,   1,  .5,   2,   1,   1,   1,   2,   1  ], // Ground
  [  1,   1,   1,  .5,   2,   1,   2,   1,   1,   1,   1,   2,  .5,   1,   1,   1,  .5,   1  ], // Flying
  [  1,   1,   1,   1,   1,   1,   2,   2,   1,   1,  .5,   1,   1,   1,   1,   0,  .5,   1  ], // Psychic
  [  1,  .5,   1,   1,   2,   1,  .5,  .5,   1,  .5,   2,   1,   1,  .5,   1,   2,  .5,  .5  ], // Bug
  [  1,   2,   1,   1,   1,   2,  .5,   1,  .5,   2,   1,   2,   1,   1,   1,   1,  .5,   1  ], // Rock
  [  0,   1,   1,   1,   1,   1,   1,   1,   1,   1,   2,   1,   1,   2,   1,  .5,   1,   1  ], // Ghost
  [  1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   2,   1,  .5,   0  ], // Dragon
  [  1,   1,   1,   1,   1,   1,  .5,   1,   1,   1,   2,   1,   1,   2,   1,  .5,   1,  .5  ], // Dark
  [  1,  .5,  .5,  .5,   1,   2,   1,   1,   1,   1,   1,   1,   2,   1,   1,   1,  .5,   2  ], // Steel
  [  1,  .5,   1,   1,   1,   1,   2,  .5,   1,   1,   1,   1,   1,   1,   2,   2,  .5,   1  ], // Fairy
];

// Build lookup: typeEffectiveness[attackType][defendType] = multiplier
const typeEffectiveness = {};
TYPES.forEach((atk, i) => {
  typeEffectiveness[atk] = {};
  TYPES.forEach((def, j) => {
    typeEffectiveness[atk][def] = RAW[i][j];
  });
});

// Returns combined multiplier for a move type hitting a defender with 1 or 2 types
export function getTypeMultiplier(moveType, defenderTypes) {
  return defenderTypes.reduce((acc, t) => acc * (typeEffectiveness[moveType]?.[t] ?? 1), 1);
}

export { TYPES, typeEffectiveness };
