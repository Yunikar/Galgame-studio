/**
 * 通用选择字段：分段按钮 或 下拉
 */
type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** segmented 适合 2~4 个短选项，select 适合更多 */
  mode?: 'segmented' | 'select';
  hint?: string;
};

export default function SelectField({ label, value, options, onChange, mode = 'select', hint }: Props) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {mode === 'segmented' ? (
        <div className="flex flex-wrap gap-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rounded-md border px-2.5 py-1 text-[12px] transition ${
                opt.value === value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-line bg-white text-ink-soft hover:border-slate-300'
              }`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {hint ? <p className="mt-1 text-[11px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}
