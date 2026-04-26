import { useState, useMemo } from 'react';
import { POKEMON } from './data/pokemon.js';
import { DAMAGING_MOVES } from './data/moves.js';
import { FORMATS, DEFAULT_FORMAT, legalPokemon, validateSlots } from './data/formats.js';
import { getFullResult } from './engine/damage.js';
import { computeStats, DEFAULT_EVS } from './engine/computeStats.js';
import PokemonSlot from './components/PokemonSlot.jsx';
import FieldConditions from './components/FieldConditions.jsx';
import AttackPanel from './components/AttackPanel.jsx';
import DamageResult from './components/DamageResult.jsx';
import FormatSelector from './components/FormatSelector.jsx';

function makeSlot(pokemonId, pool) {
  const src = pool ?? POKEMON;
  const p = src.find(pk => pk.id === pokemonId) ?? src[0];
  return {
    pokemon:  p,
    item:     'None',
    ability:  p.defaultAbility,
    nature:   'Hardy',
    evs:      { ...DEFAULT_EVS },
    atkBoost: 0,
    spaBoost: 0,
    defBoost: 0,
    spdBoost: 0,
    speBoost: 0,
  };
}

const DEFAULT_FIELD = {
  weather:     'None',
  terrain:     'None',
  helpingHand: false,
  isCrit:      false,
  tailwindA:   false,
  tailwindB:   false,
  targetCount: 1,
  isBurned:    false,
  reflect:     false,
  lightScreen:  false,
  auroraVeil:  false,
  magicRoom:   false,
  wonderRoom:  false,
  gravity:     false,
};

export default function App() {
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT.id);

  const [slots, setSlots] = useState([
    makeSlot('incineroar'),
    makeSlot('dragapult'),
  ]);

  const [field, setField] = useState(DEFAULT_FIELD);
  const [moveId, setMoveId] = useState('flare-blitz');

  const format     = useMemo(() => FORMATS.find(f => f.id === formatId) ?? DEFAULT_FORMAT, [formatId]);
  const pool       = useMemo(() => legalPokemon(format), [format]);
  const violations = useMemo(() => validateSlots(slots, format), [slots, format]);

  const enrichedSlots = useMemo(() =>
    slots.map(slot => ({
      ...slot,
      stats: computeStats(slot.pokemon.baseStats, slot.evs, slot.nature),
    })),
    [slots]
  );

  const hasAnyViolation = violations.some(Boolean);

  function changeFormat(newId) {
    const newFormat = FORMATS.find(f => f.id === newId) ?? DEFAULT_FORMAT;
    const newPool   = legalPokemon(newFormat);

    setSlots(prev => {
      const restrictedAllowed = newFormat.maxRestricted;
      let restrictedUsed = 0;

      return prev.map(slot => {
        const isInPool = newPool.some(p => p.id === slot.pokemon.id);
        const wouldExceedRestricted =
          slot.pokemon.isRestricted && restrictedUsed >= restrictedAllowed;

        if (!isInPool || wouldExceedRestricted) {
          const fallback = newPool.find(p => !p.isRestricted) ?? newPool[0];
          return makeSlot(fallback.id, newPool);
        }

        if (slot.pokemon.isRestricted) restrictedUsed++;
        return slot;
      });
    });

    setFormatId(newId);
  }

  function updateSlot(idx, newSlot) {
    setSlots(prev => prev.map((s, i) => i === idx ? newSlot : s));
  }

  function swapSlots() {
    setSlots(prev => [prev[1], prev[0]]);
  }

  const fieldForCalc = useMemo(() => ({
    weather:           field.weather === 'None' ? null : field.weather,
    terrain:           field.terrain === 'None' ? null : field.terrain,
    helpingHand:       field.helpingHand,
    isCrit:            field.isCrit,
    tailwindAttacker:  field.tailwindA,
    tailwindDefender:  field.tailwindB,
    isBurned:          field.isBurned,
    reflect:           field.reflect,
    lightScreen:       field.lightScreen,
    auroraVeil:        field.auroraVeil,
    magicRoom:         field.magicRoom,
    wonderRoom:        field.wonderRoom,
    gravity:           field.gravity,
  }), [field]);

  const result = useMemo(() => {
    const move = DAMAGING_MOVES.find(m => m.id === moveId);
    if (!move) return null;
    return getFullResult({
      attacker: enrichedSlots[0],
      defender: enrichedSlots[1],
      move,
      field: fieldForCalc,
      targetCount: field.targetCount,
    });
  }, [enrichedSlots, fieldForCalc, moveId, field.targetCount]);


  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Pokémon Champions
          </h1>
          <FormatSelector formatId={formatId} onChange={changeFormat} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 py-4 flex flex-col gap-4">

        {hasAnyViolation && (
          <div className="bg-yellow-950 border border-yellow-700 rounded-xl px-4 py-2 text-xs text-yellow-300 flex items-center gap-2">
            <span>⚠</span>
            <span>
              Some slots violate <strong>{format.name}</strong> rules — highlighted in yellow below.
              {format.maxRestricted !== Infinity && format.maxRestricted > 0 &&
                ` Max ${format.maxRestricted} restricted (★) Pokémon per team.`}
            </span>
          </div>
        )}

        <FieldConditions field={field} onChange={setField} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slots.map((slot, idx) => (
            <PokemonSlot
              key={idx}
              slot={slot}
              onChange={newSlot => updateSlot(idx, newSlot)}
              role={idx === 0 ? 'attacker' : 'defender'}
              legalPool={pool}
              violation={violations[idx]}
              hasTailwind={idx === 0 ? field.tailwindA : field.tailwindB}
            />
          ))}
        </div>

        {format.maxRestricted !== Infinity && (
          <p className="text-xs text-gray-600 text-center -mt-1">
            <span className="text-yellow-500">★ = Restricted</span> ({format.maxRestricted} allowed per team)
          </p>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col gap-4">
          <AttackPanel
            slots={slots}
            attackerIdx={0}
            targetIdx={1}
            moveId={moveId}
            onMoveChange={setMoveId}
          />
          <div className="border-t border-gray-700" />
          <DamageResult
            result={result}
            attackerName={slots[0]?.pokemon.name}
            targetName={slots[1]?.pokemon.name}
            targetHP={enrichedSlots[1]?.stats.hp}
          />
        </div>

        <button
          onClick={swapSlots}
          className="w-full text-xs py-2 rounded-xl border border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
        >
          ⇄ Swap Attacker / Defender
        </button>


      </main>
    </div>
  );
}
