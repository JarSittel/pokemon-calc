import { useState, useRef } from 'react';

const WEATHERS = ['None', 'Sun', 'Rain', 'Sand', 'Snow'];
const TERRAINS  = ['None', 'Electric', 'Grassy', 'Psychic', 'Misty'];

const MODIFIERS = [
  { label: 'Aurora Veil',    key: 'auroraVeil',  color: 'bg-cyan-700 border-cyan-600'      },
  { label: 'Burned (Atk)',   key: 'isBurned',    color: 'bg-orange-600 border-orange-500'  },
  { label: 'Crit',           key: 'isCrit',      color: 'bg-red-600 border-red-500'        },
  { label: 'Gravity',        key: 'gravity',     color: 'bg-slate-600 border-slate-500'    },
  { label: 'Helping Hand',   key: 'helpingHand', color: 'bg-yellow-600 border-yellow-500'  },
  { label: 'Light Screen',   key: 'lightScreen', color: 'bg-indigo-600 border-indigo-500'  },
  { label: 'Magic Room',     key: 'magicRoom',   color: 'bg-violet-700 border-violet-600'  },
  { label: 'Reflect',        key: 'reflect',     color: 'bg-indigo-600 border-indigo-500'  },
  { label: 'Tailwind (Atk)', key: 'tailwindA',   color: 'bg-sky-600 border-sky-500'        },
  { label: 'Tailwind (Def)', key: 'tailwindB',   color: 'bg-sky-600 border-sky-500'        },
  { label: 'Wonder Room',    key: 'wonderRoom',  color: 'bg-violet-700 border-violet-600'  },
];

function ModifierSearch({ field, onToggle }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);

  const inactive = MODIFIERS.filter(m => !field[m.key]);
  const filtered = query.trim()
    ? inactive.filter(m => m.label.toLowerCase().includes(query.toLowerCase()))
    : inactive;

  function handleBlur(e) {
    if (!listRef.current?.contains(e.relatedTarget)) {
      setOpen(false);
      setQuery('');
    }
  }

  function select(mod) {
    onToggle(mod.key, true);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="select-input text-xs w-full"
        placeholder="Add condition…"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onChange={e => setQuery(e.target.value)}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 top-full mt-0.5 w-48 max-h-56 overflow-y-auto bg-gray-800 border border-gray-600 rounded shadow-lg text-xs"
        >
          {filtered.map(m => (
            <li
              key={m.key}
              onMouseDown={() => select(m)}
              className="px-3 py-1.5 cursor-pointer text-gray-200 hover:bg-gray-700"
            >
              {m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FieldConditions({ field, onChange }) {
  function update(patch) {
    onChange({ ...field, ...patch });
  }

  function toggleModifier(key, value) {
    update({ [key]: value });
  }

  const activeMods = MODIFIERS.filter(m => field[m.key]);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex flex-col gap-2">

      {/* Row 1: dropdowns + target count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">Weather</span>
            <select
              className="select-input text-xs w-24"
              value={field.weather}
              onChange={e => update({ weather: e.target.value })}
            >
              {WEATHERS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 shrink-0">Terrain</span>
            <select
              className="select-input text-xs w-28"
              value={field.terrain}
              onChange={e => update({ terrain: e.target.value })}
            >
              {TERRAINS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-1">
          {[
            { n: 1, label: 'One Target' },
            { n: 2, label: 'Two Targets' },
          ].map(({ n, label }) => (
            <button
              key={n}
              onClick={() => update({ targetCount: n })}
              className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${
                field.targetCount === n
                  ? 'bg-violet-700 border-violet-500 text-white'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-700" />

      {/* Row 2: search + active tags */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <ModifierSearch field={field} onToggle={toggleModifier} />
        {activeMods.map(m => (
          <button
            key={m.key}
            onClick={() => toggleModifier(m.key, false)}
            className={`text-xs px-2 py-0.5 rounded border font-medium text-white flex items-center gap-1 transition-opacity hover:opacity-75 ${m.color}`}
          >
            {m.label}
            <span className="text-xs opacity-70">×</span>
          </button>
        ))}
      </div>

    </div>
  );
}
