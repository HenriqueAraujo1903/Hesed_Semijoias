import { PRESETS, resolvePreset, formatPeriod, isInvalid, type Period, type PresetKey } from '../utils/period';

/**
 * Filtro de período compartilhado dos dashboards: atalhos rápidos + intervalo
 * customizado (de/até com input date nativo). Componente controlado — o pai
 * guarda { preset, period } e recebe as mudanças.
 *
 * Uso:
 *   const [preset, setPreset] = useState<PresetKey>('30d');
 *   const [period, setPeriod] = useState<Period>(resolvePreset('30d'));
 *   <PeriodFilter preset={preset} period={period}
 *     onPreset={(k) => { setPreset(k); setPeriod(resolvePreset(k)); }}
 *     onCustom={(p) => { setPreset('custom'); setPeriod(p); }} />
 */
export default function PeriodFilter({ preset, period, onPreset, onCustom }: {
  preset: PresetKey;
  period: Period;
  onPreset: (key: PresetKey) => void;
  onCustom: (period: Period) => void;
}) {
  const invalid = isInvalid(period);

  return (
    <div className="card p-4 space-y-3">
      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              preset === p.key
                ? 'bg-gold text-white'
                : 'bg-cream-100 dark:bg-charcoal-700 text-charcoal-500 dark:text-charcoal-300 hover:bg-cream-200 dark:hover:bg-charcoal-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Intervalo customizado */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-medium text-charcoal-400 uppercase tracking-wide mb-1">De</label>
          <input
            type="date"
            value={period.from ?? ''}
            max={period.to ?? undefined}
            onChange={(e) => onCustom({ from: e.target.value || null, to: period.to })}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-charcoal-400 uppercase tracking-wide mb-1">Até</label>
          <input
            type="date"
            value={period.to ?? ''}
            min={period.from ?? undefined}
            onChange={(e) => onCustom({ from: period.from, to: e.target.value || null })}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div className="pb-1.5 text-[11px] text-charcoal-400 dark:text-charcoal-500">
          {invalid ? (
            <span className="text-red-500">Período inválido: "Até" é anterior a "De".</span>
          ) : (
            <span>Período: <span className="font-medium text-charcoal-600 dark:text-charcoal-300">{formatPeriod(period)}</span>
              {preset === 'custom' && <span className="ml-1 text-charcoal-300">(personalizado)</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
