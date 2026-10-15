/**
 * 数值字段（时长 / 淡入淡出 / 打字速度）
 */
type Props = {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** 允许清空（表示"使用全局设置"） */
  allowEmpty?: boolean;
  hint?: string;
};

export default function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 60,
  step = 0.1,
  unit,
  allowEmpty,
  hint,
}: Props) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="field-label mb-0">{label}</label>
        {unit ? <span className="text-[11px] text-ink-faint">{unit}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="h-1 flex-1 accent-brand-600"
          min={min}
          max={max}
          step={step}
          value={value ?? min}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="input w-[74px]"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          placeholder={allowEmpty ? '默认' : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(allowEmpty ? undefined : min);
              return;
            }
            const num = Number(raw);
            if (Number.isFinite(num)) onChange(Math.min(max, Math.max(min, num)));
          }}
        />
      </div>
      {hint ? <p className="mt-1 text-[11px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}
