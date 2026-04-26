const KO_STYLES = {
  'Guaranteed KO': 'text-red-400 bg-red-950 border-red-700',
  'Possible KO':   'text-orange-400 bg-orange-950 border-orange-700',
  '2HKO range':    'text-yellow-400 bg-yellow-950 border-yellow-800',
  'Not a KO':      'text-gray-400 bg-gray-800 border-gray-600',
  'Immune':        'text-violet-400 bg-violet-950 border-violet-700',
  'No damage':     'text-gray-500 bg-gray-900 border-gray-700',
};

const TYPE_EFFECTIVENESS_LABELS = {
  0:    { text: 'Immune',    color: 'text-gray-500'   },
  0.25: { text: '¼×',       color: 'text-blue-400'   },
  0.5:  { text: '½×',       color: 'text-blue-400'   },
  1:    { text: '1×',       color: 'text-gray-400'   },
  2:    { text: '2×',       color: 'text-orange-400' },
  4:    { text: '4×',       color: 'text-red-400'    },
};

export default function DamageResult({ result, attackerName, targetName, targetHP }) {
  if (!result) return null;

  if (result.isStatus) {
    return (
      <ResultCard title={attackerName} subtitle={targetName} koStyle={KO_STYLES['No damage']}>
        <p className="text-gray-500 text-sm text-center py-2">Status move — no damage</p>
      </ResultCard>
    );
  }

  if (result.isImmune) {
    const style = KO_STYLES['Immune'];
    return (
      <ResultCard title={attackerName} subtitle={targetName} koStyle={style}>
        <p className={`text-center font-bold py-2 ${style.split(' ')[0]}`}>Immune — No Effect</p>
      </ResultCard>
    );
  }

  const { minTotal, maxTotal, pctMin, pctMax, typeMultiplier, koChance, hits, effectivePower, recoil, activeEffects } = result;
  const koStyle = KO_STYLES[koChance] ?? KO_STYLES['Not a KO'];
  const barPct = Math.min(pctMax, 100);
  const barColor = pctMin >= 100
    ? 'bg-red-500'
    : pctMax >= 100
    ? 'bg-orange-500'
    : pctMax >= 50
    ? 'bg-yellow-500'
    : 'bg-blue-500';

  const typeLabel = TYPE_EFFECTIVENESS_LABELS[typeMultiplier];

  return (
    <ResultCard title={attackerName} subtitle={targetName} koStyle={koStyle}>
      {/* Effectiveness + BP + active ability effects */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        {typeLabel && typeMultiplier !== 1 && (
          <span className={`text-xs font-bold ${typeLabel.color}`}>
            Type: {typeLabel.text}
          </span>
        )}
        {effectivePower != null && (
          <span className="text-xs text-gray-400">BP {effectivePower}</span>
        )}
        {activeEffects?.map((e, i) => (
          <span key={i} className={`text-xs font-semibold ${e.color}`}>
            {e.label}
          </span>
        ))}
      </div>

      {/* Damage numbers */}
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-2xl font-mono font-bold text-white">
            {minTotal}–{maxTotal}
          </span>
          {hits > 1 && (
            <span className="text-xs text-gray-400 ml-1">({hits} hits)</span>
          )}
        </div>
        <div className="text-right">
          <span className="text-sm font-mono text-gray-300">
            {pctMin}%–{pctMax}%
          </span>
          <div className="text-xs text-gray-400">of {targetHP} HP</div>
        </div>
      </div>

      {/* HP bar */}
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`result-bar-fill ${barColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* KO label */}
      <div className={`text-xs font-semibold px-2 py-1 rounded border text-center ${koStyle}`}>
        {koChance}
      </div>

      {/* Recoil */}
      {recoil && (
        <div className="mt-1 text-xs text-orange-400 text-right">
          Recoil: {recoil.min === recoil.max ? recoil.min : `${recoil.min}–${recoil.max}`} HP
          {' '}({recoil.pctMin === recoil.pctMax ? recoil.pctMin : `${recoil.pctMin}–${recoil.pctMax}`}% of attacker HP)
        </div>
      )}
    </ResultCard>
  );
}

function ResultCard({ title, subtitle, koStyle, children }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
    </div>
  );
}
