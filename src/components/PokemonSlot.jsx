import { useState, useRef } from 'react';
import { getSpriteUrl } from '../data/pokemon.js';
import { ALL_ITEMS, BERRY_TYPE } from '../data/items.js';
import { NATURES } from '../data/natures.js';
import { computeStats, DEFAULT_EVS } from '../engine/computeStats.js';

function PokemonSearch({ legalPool, selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = query.trim()
    ? legalPool.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : legalPool;

  function choose(p) {
    onSelect(p.id);
    setQuery('');
    setOpen(false);
  }

  function handleBlur(e) {
    // Close only if focus leaves both input and list
    if (!listRef.current?.contains(e.relatedTarget)) {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        className="select-input font-semibold w-full"
        value={open ? query : selected.name}
        placeholder="Search…"
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={handleBlur}
        onChange={e => setQuery(e.target.value)}
      />
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-0.5 max-h-48 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-lg text-xs"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-gray-500">No results</li>
          )}
          {filtered.map(p => (
            <li
              key={p.id}
              onMouseDown={() => choose(p)}
              className={`px-3 py-1.5 cursor-pointer flex items-center justify-between hover:bg-gray-700 ${
                p.id === selected.id ? 'bg-gray-700 text-white' : 'text-gray-200'
              }`}
            >
              <span>{p.name}</span>
              {p.isRestricted && <span className="text-yellow-400 ml-1">★</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemSearch({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);

  const filtered = query.trim()
    ? ALL_ITEMS.filter(it => it.toLowerCase().includes(query.toLowerCase()))
    : ALL_ITEMS;

  function handleBlur(e) {
    if (!listRef.current?.contains(e.relatedTarget)) {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="select-input text-xs w-full"
        value={open ? query : selected}
        placeholder="Search items…"
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={handleBlur}
        onChange={e => setQuery(e.target.value)}
      />
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 top-full mt-0.5 max-h-48 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-lg text-xs"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-gray-500">No results</li>
          )}
          {filtered.map(it => (
            <li
              key={it}
              onMouseDown={() => { onSelect(it); setOpen(false); setQuery(''); }}
              className={`px-3 py-1.5 cursor-pointer flex items-center justify-between hover:bg-gray-700 ${
                it === selected ? 'bg-gray-700 text-white' : 'text-gray-200'
              }`}
            >
              <span>{it}</span>
              {BERRY_TYPE[it] && (
                <span className="text-gray-400 ml-2">{BERRY_TYPE[it]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TYPE_COLORS = {
  Normal:   'bg-gray-500',   Fire:     'bg-orange-500',  Water:    'bg-blue-500',
  Electric: 'bg-yellow-400', Grass:    'bg-green-500',   Ice:      'bg-cyan-400',
  Fighting: 'bg-red-600',    Poison:   'bg-purple-500',  Ground:   'bg-yellow-700',
  Flying:   'bg-indigo-400', Psychic:  'bg-pink-500',    Bug:      'bg-lime-500',
  Rock:     'bg-yellow-600', Ghost:    'bg-violet-700',  Dragon:   'bg-indigo-600',
  Dark:     'bg-gray-700',   Steel:    'bg-slate-400',   Fairy:    'bg-pink-400',
};

function BoostRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-400">
      <span className="w-8">{label}</span>
      <button className="boost-btn text-red-400" onClick={() => onChange(Math.max(-6, value - 1))}>−</button>
      <span className={`w-5 text-center font-mono font-bold text-xs ${
        value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400'
      }`}>
        {value > 0 ? `+${value}` : value}
      </span>
      <button className="boost-btn text-green-400" onClick={() => onChange(Math.min(6, value + 1))}>+</button>
    </div>
  );
}

// role: 'attacker' | 'defender'
export default function PokemonSlot({ slot, onChange, role, legalPool, violation, hasTailwind }) {
  const pkmn = slot.pokemon;
  const isIllegal = Boolean(violation);
  const [showEvEditor, setShowEvEditor] = useState(false);

  function update(patch) {
    onChange({ ...slot, ...patch });
  }

  function selectPokemon(id) {
    const p = legalPool.find(pk => pk.id === id) ?? legalPool[0];
    if (!p) return;
    update({
      pokemon: p,
      ability: p.defaultAbility,
      item: p.id.includes('mega') ? (p.defaultItem ?? 'None') : 'None',
      nature: 'Hardy',
      evs: { ...DEFAULT_EVS },
      atkBoost: 0, spaBoost: 0, defBoost: 0, spdBoost: 0, speBoost: 0,
    });
  }

  function setEv(stat, raw) {
    const val = Math.min(252, Math.max(0, Number(raw) || 0));
    update({ evs: { ...slot.evs, [stat]: val } });
  }

  const totalEvs = Object.values(slot.evs ?? DEFAULT_EVS).reduce((a, b) => a + b, 0);
  const evOverLimit = totalEvs > 510;
  const computedStats = computeStats(pkmn.baseStats, slot.evs, slot.nature);
  const activeNature = NATURES.find(n => n.name === slot.nature) ?? NATURES[0];

  const isAttacker = role === 'attacker';

  return (
    <div className={`slot-card relative transition-all duration-200 ${
      isIllegal
        ? 'ring-2 ring-yellow-500'
        : isAttacker
        ? 'ring-2 ring-red-500'
        : 'ring-2 ring-blue-500'
    }`}>
      {/* Illegal badge */}
      {isIllegal && (
        <div className="bg-yellow-900 border border-yellow-600 text-yellow-300 text-xs px-2 py-0.5 rounded mb-1 flex items-center gap-1">
          <span>⚠</span>
          <span>{violation}</span>
        </div>
      )}

      {/* Role label */}
      <div className="flex gap-1 mb-1">
        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
          isAttacker ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'
        }`}>
          {isAttacker ? 'Attacker' : 'Defender'}
        </span>
      </div>

      {/* Sprite + name row */}
      <div className="flex items-center gap-2">
        <img
          src={getSpriteUrl(pkmn.spriteId)}
          alt={pkmn.name}
          className="w-12 h-12 object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="flex-1 min-w-0">
          <PokemonSearch
            legalPool={legalPool}
            selected={pkmn}
            onSelect={selectPokemon}
          />
          {/* Type badges */}
          <div className="flex gap-1 mt-1">
            {pkmn.types.map(t => (
              <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-semibold text-white ${TYPE_COLORS[t] ?? 'bg-gray-500'}`}>
                {t}
              </span>
            ))}
            {pkmn.isRestricted && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-yellow-300 bg-yellow-900 border border-yellow-700">
                ★ Restricted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Item + Ability */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="text-gray-400 block mb-0.5">Item</label>
          <ItemSearch selected={slot.item} onSelect={it => update({ item: it })} />
        </div>
        <div>
          <label className="text-gray-400 block mb-0.5">Ability</label>
          <select
            className="select-input text-xs"
            value={slot.ability}
            onChange={e => update({ ability: e.target.value })}
          >
            {pkmn.abilities.map(ab => <option key={ab} value={ab}>{ab}</option>)}
          </select>
        </div>
      </div>

      {/* Stat boosts */}
      <div className="border-t border-gray-700 pt-2 mt-1">
        <p className="text-xs text-gray-400 mb-1">Stat Stages</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <BoostRow label="Atk" value={slot.atkBoost} onChange={v => update({ atkBoost: v })} />
          <BoostRow label="SpA" value={slot.spaBoost} onChange={v => update({ spaBoost: v })} />
          <BoostRow label="Def" value={slot.defBoost} onChange={v => update({ defBoost: v })} />
          <BoostRow label="SpD" value={slot.spdBoost} onChange={v => update({ spdBoost: v })} />
        </div>
      </div>

      {/* EVs & Nature */}
      <div className="border-t border-gray-700 pt-2 mt-1 space-y-2">
        <p className="text-xs text-gray-400">EVs &amp; Nature</p>

        <div>
          <select
            className="select-input text-xs w-full"
            value={slot.nature ?? 'Hardy'}
            onChange={e => update({ nature: e.target.value })}
          >
            {NATURES.map(n => (
              <option key={n.name} value={n.name}>
                {n.name}{n.plus ? ` (+${n.plus.toUpperCase()} −${n.minus.toUpperCase()})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-x-2 gap-y-1">
          {[
            ['hp',  'HP'],
            ['atk', 'Atk'],
            ['def', 'Def'],
            ['spa', 'SpA'],
            ['spd', 'SpD'],
            ['spe', 'Spe'],
          ].map(([key, label]) => {
            const isPlus  = activeNature.plus  === key;
            const isMinus = activeNature.minus === key;
            return (
              <div key={key}>
                <label className={`text-xs block mb-0.5 ${
                  isPlus ? 'text-red-400' : isMinus ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  {label}
                  {isPlus ? ' ▲' : isMinus ? ' ▼' : ''}
                </label>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    min={0}
                    max={252}
                    step={4}
                    value={slot.evs?.[key] ?? 0}
                    onChange={e => setEv(key, e.target.value)}
                    className="select-input text-xs w-full text-right"
                  />
                  <span className={`text-xs w-8 text-right font-mono font-semibold ${key === 'spe' && hasTailwind ? 'text-blue-400' : 'text-gray-100'}`}>
                    {key === 'spe' && hasTailwind ? computedStats.spe * 2 : computedStats[key]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className={`text-xs ${evOverLimit ? 'text-red-400' : 'text-gray-400'}`}>
          Total: {totalEvs} / 510
        </p>
      </div>

    </div>
  );
}
