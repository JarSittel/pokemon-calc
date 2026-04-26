import { FORMATS } from '../data/formats.js';

const FORMAT_COLORS = {
  'reg-m-a':   'bg-red-700 border-red-500',
  'open':      'bg-gray-600 border-gray-500',
  'reg-h':     'bg-blue-700 border-blue-500',
  'reg-g':     'bg-violet-700 border-violet-500',
  'no-legends':'bg-emerald-700 border-emerald-500',
};

export default function FormatSelector({ formatId, onChange }) {
  const activeFormat = FORMATS.find(f => f.id === formatId);

  return (
    <div className="flex items-center gap-3 shrink-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
        Format
      </span>
      <div className="flex gap-1.5">
        {FORMATS.map(fmt => {
          const active = formatId === fmt.id;
          return (
            <button
              key={fmt.id}
              onClick={() => onChange(fmt.id)}
              className={`field-btn whitespace-nowrap ${
                active
                  ? `field-btn-on ${FORMAT_COLORS[fmt.id]}`
                  : 'field-btn-off'
              }`}
            >
              {fmt.badge}
              {fmt.isCurrent && (
                <span className="ml-1 text-yellow-300 text-xs">★</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
