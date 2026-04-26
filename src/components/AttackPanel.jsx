import { useState, useRef, useEffect } from 'react';
import { MOVES, DAMAGING_MOVES } from '../data/moves.js';
import { LEARNSETS } from '../data/learnsets.js';

const MOVE_TYPE_COLORS = {
  Normal:'text-gray-400',   Fire:'text-orange-400',   Water:'text-blue-400',
  Electric:'text-yellow-400', Grass:'text-green-400',  Ice:'text-cyan-400',
  Fighting:'text-red-400',  Poison:'text-purple-400', Ground:'text-yellow-600',
  Flying:'text-indigo-400', Psychic:'text-pink-400',  Bug:'text-lime-400',
  Rock:'text-yellow-600',   Ghost:'text-violet-400',  Dragon:'text-indigo-400',
  Dark:'text-gray-300',     Steel:'text-slate-400',   Fairy:'text-pink-400',
};

function MoveSearch({ movePool, selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);

  const filtered = query.trim()
    ? movePool.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    : movePool;

  function handleBlur(e) {
    if (!listRef.current?.contains(e.relatedTarget)) {
      setOpen(false);
      setQuery('');
    }
  }

  const displayName = selected ? selected.name : 'Select move…';

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="select-input w-full text-sm"
        value={open ? query : displayName}
        placeholder="Search moves…"
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={handleBlur}
        onChange={e => setQuery(e.target.value)}
      />
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-0.5 max-h-56 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-lg text-xs"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-gray-500">No results</li>
          )}
          {filtered.map(m => (
            <li
              key={m.id}
              onMouseDown={() => { onSelect(m.id); setOpen(false); setQuery(''); }}
              className={`px-3 py-1.5 cursor-pointer flex items-center justify-between hover:bg-gray-700 ${
                m.id === selected?.id ? 'bg-gray-700 text-white' : 'text-gray-200'
              }`}
            >
              <span className={MOVE_TYPE_COLORS[m.type] ?? 'text-gray-300'}>{m.name}</span>
              <span className="text-gray-500 ml-2 shrink-0">
                {m.type} · {m.category === 'physical' ? 'Phys' : 'Spec'} · BP {m.power}
                {m.spread ? ' · Spread' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AttackPanel({ slots, attackerIdx, targetIdx, moveId, onMoveChange }) {
  const attacker = slots[attackerIdx];
  const target   = slots[targetIdx];

  // Build move pool: only damaging moves the attacker can learn
  const attackerLearnset = attacker ? (LEARNSETS[attacker.pokemon.id] ?? []) : [];
  const movePool = attackerLearnset.length > 0
    ? DAMAGING_MOVES.filter(m => attackerLearnset.includes(m.id))
    : DAMAGING_MOVES;

  const selectedMove = MOVES.find(m => m.id === moveId) ?? null;

  // If the current move isn't in the new pool, reset to first available
  const effectiveMoveId = movePool.some(m => m.id === moveId)
    ? moveId
    : movePool[0]?.id ?? moveId;

  useEffect(() => {
    if (effectiveMoveId !== moveId && movePool.length > 0) {
      onMoveChange(effectiveMoveId);
    }
  }, [effectiveMoveId]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wide">Move</h2>
        {attacker && (
          <span className="text-xs text-red-400 font-medium">
            {attacker.pokemon.name}
          </span>
        )}
        {target && (
          <>
            <span className="text-gray-600">→</span>
            <span className="text-xs text-blue-400 font-medium">
              {target.pokemon.name}
            </span>
          </>
        )}
        {attackerLearnset.length > 0 && (
          <span className="ml-auto text-xs text-gray-600">{movePool.length} moves</span>
        )}
      </div>

      <MoveSearch
        movePool={movePool}
        selected={movePool.find(m => m.id === effectiveMoveId) ?? null}
        onSelect={onMoveChange}
      />

      {/* Move detail badge row */}
      {effectiveMoveId && (() => {
        const m = MOVES.find(mv => mv.id === effectiveMoveId);
        if (!m || m.power === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge label={m.type} color={MOVE_TYPE_COLORS[m.type]} />
            <Badge label={m.category === 'physical' ? 'Physical' : 'Special'} color="text-gray-300" />
            <Badge label={`BP ${m.power}`} color="text-amber-400" />
            <Badge label={`PP ${m.pp}`} color="text-gray-400" />
            {m.accuracy && m.accuracy < 101 && <Badge label={`Acc ${m.accuracy}%`} color="text-gray-300" />}
            {m.spread    && <Badge label="Spread"    color="text-violet-400" />}
            {m.hits      && <Badge label={`${m.hits} hits`} color="text-cyan-400" />}
            {m.alwaysCrit&& <Badge label="Always Crit" color="text-yellow-400" />}
          </div>
        );
      })()}
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded bg-gray-700 ${color}`}>
      {label}
    </span>
  );
}
